import { test, expect } from "@playwright/test";
import {
  createTransferChunks,
  TransferReconstructor,
  createFileKeyQrPayload,
  parseFileKeyQrPayload,
  MAX_TRANSFER_PAYLOAD_SIZE,
} from "../src/lib/transferQr";

test.describe("WP-07: QR-First One-Time Transfer Protocol", () => {
  test("chunks a large payload and reconstructs it successfully out-of-order", () => {
    const originalText = "A".repeat(1500) + "B".repeat(1200) + "C".repeat(800);
    const chunks = createTransferChunks(originalText, { chunkSize: 500 });

    expect(chunks.length).toBe(7); // 3500 / 500 = 7 chunks
    chunks.forEach((c, idx) => {
      expect(c.schema).toBe("vaultzero-transfer");
      expect(c.v).toBe(1);
      expect(c.seq).toBe(idx);
      expect(c.total).toBe(7);
      expect(c.ttl).toBe(120);
    });

    const reconstructor = new TransferReconstructor();

    // Feed in shuffled out-of-order sequence
    const shuffled = [chunks[3], chunks[0], chunks[6], chunks[1], chunks[4], chunks[2], chunks[5]];

    let finalPayload: string | undefined;
    for (const chunk of shuffled) {
      const res = reconstructor.addChunk(chunk);
      if (res.completed) {
        finalPayload = res.assembledPayload;
      }
    }

    expect(finalPayload).toBe(originalText);
  });

  test("rejects corrupted chunk and locks out after 8 failed attempts", () => {
    const chunks = createTransferChunks("Test Sensitive Vault Zero Data", { chunkSize: 10 });
    const reconstructor = new TransferReconstructor();

    const badChunk = { ...chunks[0], checksum: "badbad00" };

    for (let i = 0; i < 7; i++) {
      expect(() => reconstructor.addChunk(badChunk)).toThrow(/Checksum mismatch/);
    }

    // 8th failure triggers lock
    expect(() => reconstructor.addChunk(badChunk)).toThrow(/Checksum mismatch/);

    // 9th call triggers lockout error
    expect(() => reconstructor.addChunk(chunks[0])).toThrow(/Transfer locked: maximum 8 failed attempts exceeded/);
  });

  test("enforces 120s TTL expiration on chunks", () => {
    const chunks = createTransferChunks("Ephemeral Secret", { ttl: 120 });
    const reconstructor = new TransferReconstructor();

    // Fabricate an expired chunk (created 130s ago)
    const expiredChunk = {
      ...chunks[0],
      created: Math.floor(Date.now() / 1000) - 130,
    };

    expect(() => reconstructor.addChunk(expiredChunk)).toThrow(/Transfer expired/);
  });

  test("creates and parses ephemeral file-key payload with TTL", () => {
    const rawKey = "dGVzdC1yYXcta2V5LTEyMzQ1Njc4OTA=";
    const jsonStr = createFileKeyQrPayload(rawKey, 120);

    const parsed = parseFileKeyQrPayload(jsonStr);
    expect(parsed.schema).toBe("vaultzero-file-key");
    expect(parsed.k).toBe(rawKey);
    expect(parsed.ttl).toBe(120);

    // Expired file key
    const expiredJson = JSON.stringify({
      schema: "vaultzero-file-key",
      k: rawKey,
      created: Math.floor(Date.now() / 1000) - 125,
      ttl: 120,
    });

    expect(() => parseFileKeyQrPayload(expiredJson)).toThrow(/File key expired/);
  });

  test("rejects payloads exceeding 16 MiB ceiling", () => {
    const hugePayload = "X".repeat(MAX_TRANSFER_PAYLOAD_SIZE + 10);
    expect(() => createTransferChunks(hugePayload)).toThrow(/exceeds maximum 16 MiB transfer limit/);
  });
});

