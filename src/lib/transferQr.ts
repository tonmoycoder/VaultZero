/**
 * QR-First One-Time Transfer Protocol (WP-07)
 * Implements ephemeral peer-to-peer data transfers with optical chunking,
 * 120s TTL expiration, 8-attempt lockout defense, and 16 MiB payload limit.
 */

export const MAX_TRANSFER_PAYLOAD_SIZE = 16 * 1024 * 1024; // 16 MiB
export const DEFAULT_TRANSFER_TTL_SECS = 120; // 120 seconds TTL
export const MAX_DECRYPT_ATTEMPTS = 8;
export const DEFAULT_QR_CHUNK_SIZE = 800; // Optimal chars for high-density mobile QR reading

export interface VaultZeroTransferChunk {
  schema: "vaultzero-transfer";
  v: 1;
  sessionId: string;
  seq: number;
  total: number;
  payload: string;
  checksum: string;
  created: number;
  ttl: number;
}

export interface VaultZeroFileKey {
  schema: "vaultzero-file-key";
  k: string;
  created: number;
  ttl: number;
}

/**
 * Computes a simple deterministic 32-bit hash checksum.
 */
export function computeChecksum(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Chunks a payload into multiple QR-ready schemas.
 */
export function createTransferChunks(
  payload: string,
  options: {
    sessionId?: string;
    chunkSize?: number;
    ttl?: number;
  } = {}
): VaultZeroTransferChunk[] {
  if (payload.length > MAX_TRANSFER_PAYLOAD_SIZE) {
    throw new Error(
      `Payload exceeds maximum 16 MiB transfer limit (${(payload.length / 1024 / 1024).toFixed(1)} MiB)`
    );
  }

  const chunkSize = options.chunkSize || DEFAULT_QR_CHUNK_SIZE;
  const ttl = options.ttl || DEFAULT_TRANSFER_TTL_SECS;
  const sessionId =
    options.sessionId ||
    `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const created = Math.floor(Date.now() / 1000);

  const total = Math.max(1, Math.ceil(payload.length / chunkSize));
  const chunks: VaultZeroTransferChunk[] = [];

  for (let seq = 0; seq < total; seq++) {
    const chunkSlice = payload.slice(seq * chunkSize, (seq + 1) * chunkSize);
    chunks.push({
      schema: "vaultzero-transfer",
      v: 1,
      sessionId,
      seq,
      total,
      payload: chunkSlice,
      checksum: computeChecksum(chunkSlice),
      created,
      ttl,
    });
  }

  return chunks;
}

/**
 * Reconstructs chunks received from optical QR scans.
 */
export class TransferReconstructor {
  private chunks: Map<number, VaultZeroTransferChunk> = new Map();
  private sessionId: string | null = null;
  private total: number = 0;
  private failedAttempts: number = 0;
  private locked: boolean = false;

  /**
   * Feed a chunk into the reconstructor.
   */
  public addChunk(chunk: VaultZeroTransferChunk): {
    completed: boolean;
    progress: number;
    missing: number[];
    assembledPayload?: string;
  } {
    if (this.locked) {
      throw new Error("Transfer locked: maximum 8 failed attempts exceeded");
    }

    if (chunk.schema !== "vaultzero-transfer" || chunk.v !== 1) {
      this.failedAttempts++;
      if (this.failedAttempts >= MAX_DECRYPT_ATTEMPTS) {
        this.locked = true;
      }
      throw new Error("Invalid transfer chunk schema");
    }

    // TTL check
    const nowSecs = Math.floor(Date.now() / 1000);
    if (nowSecs - chunk.created > chunk.ttl) {
      throw new Error(`Transfer expired: chunk exceeded ${chunk.ttl}s TTL`);
    }

    // Checksum verification
    const expectedChecksum = computeChecksum(chunk.payload);
    if (expectedChecksum !== chunk.checksum) {
      this.failedAttempts++;
      if (this.failedAttempts >= MAX_DECRYPT_ATTEMPTS) {
        this.locked = true;
      }
      throw new Error(`Checksum mismatch on chunk seq ${chunk.seq}`);
    }

    // Session consistency
    if (this.sessionId === null) {
      this.sessionId = chunk.sessionId;
      this.total = chunk.total;
    } else if (this.sessionId !== chunk.sessionId) {
      this.failedAttempts++;
      if (this.failedAttempts >= MAX_DECRYPT_ATTEMPTS) {
        this.locked = true;
      }
      throw new Error(
        `Session mismatch: expected ${this.sessionId}, received ${chunk.sessionId}`
      );
    }

    this.chunks.set(chunk.seq, chunk);

    const missing: number[] = [];
    for (let i = 0; i < this.total; i++) {
      if (!this.chunks.has(i)) {
        missing.push(i);
      }
    }

    const completed = missing.length === 0 && this.chunks.size === this.total;
    const progress = this.total > 0 ? this.chunks.size / this.total : 0;

    let assembledPayload: string | undefined;
    if (completed) {
      const parts: string[] = [];
      for (let i = 0; i < this.total; i++) {
        parts.push(this.chunks.get(i)!.payload);
      }
      assembledPayload = parts.join("");
    }

    return {
      completed,
      progress,
      missing,
      assembledPayload,
    };
  }

  public reset(): void {
    this.chunks.clear();
    this.sessionId = null;
    this.total = 0;
    this.failedAttempts = 0;
    this.locked = false;
  }
}

/**
 * Creates an ephemeral key sharing payload for QR transfer.
 */
export function createFileKeyQrPayload(
  rawKeyBase64: string,
  ttl: number = DEFAULT_TRANSFER_TTL_SECS
): string {
  const payload: VaultZeroFileKey = {
    schema: "vaultzero-file-key",
    k: rawKeyBase64,
    created: Math.floor(Date.now() / 1000),
    ttl,
  };
  return JSON.stringify(payload);
}

/**
 * Parses and validates an ephemeral file key payload.
 */
export function parseFileKeyQrPayload(jsonStr: string): VaultZeroFileKey {
  const parsed = JSON.parse(jsonStr) as VaultZeroFileKey;
  if (parsed.schema !== "vaultzero-file-key" || !parsed.k) {
    throw new Error("Invalid vaultzero-file-key schema");
  }

  const nowSecs = Math.floor(Date.now() / 1000);
  if (nowSecs - parsed.created > parsed.ttl) {
    throw new Error(`File key expired: exceeded ${parsed.ttl}s TTL`);
  }

  return parsed;
}

