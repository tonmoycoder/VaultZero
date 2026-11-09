/**
 * Batch 5 / V-94 — three "is it actually WORKABLE?" contracts in a real
 * browser:
 *
 *  B-21  OCR returns the worker's REAL recognised text, never the image
 *        filename / size / dimensions, and streams real progress 10 → 100.
 *  B-22  `eng+ben` dual-language offline worker actually recognises text.
 *  B-23  random short 2FA inputs (including short `otpauth://` inner keys)
 *        are rejected, while RFC 6238 SHA-1/256/512 still produce real codes.
 *
 * The screenshot complaint ("OCR returns image metadata") came from an old
 * published APK; these tests pin the CURRENT source to real behaviour.
 */
import { expect, test } from "@playwright/test";

/** Draws a high-contrast text image on a canvas and runs the real OCR engine. */
async function scanTextImage(page: import("@playwright/test").Page, lang: "eng" | "eng+ben") {
  return page.evaluate(async (ocrLang) => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 220;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 900, 220);
    ctx.fillStyle = "#000";
    ctx.font = "bold 54px sans-serif";
    ctx.fillText("USER: demo@vaultzero.local", 30, 90);
    ctx.fillText("PASS: S3cret-42", 30, 170);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
    const file = new File([blob], "secret-screenshot-900x220.png", { type: "image/png" });
    const mod = await import("/src/lib/ocr.ts");
    const progress: number[] = [];
    const out = await mod.runLocalOcr(file, (p: number) => progress.push(p), ocrLang as "eng" | "ben" | "eng+ben");
    return {
      rawText: out.rawText,
      creds: out.creds,
      progress,
      fileName: file.name,
      size: file.size,
      width: canvas.width,
      height: canvas.height,
    };
  }, lang);
}

const expectNoMetadata = (
  result: Awaited<ReturnType<typeof scanTextImage>>
) => {
  // The extracted result must be the pixels' TEXT, not a description of the file.
  expect(result.rawText).not.toContain(result.fileName);
  expect(result.rawText).not.toContain(`${result.width}x${result.height}`);
  expect(result.rawText).not.toContain(String(result.size));
  expect(result.rawText).not.toMatch(/\b\d+(\.\d+)?\s?(KB|MiB|MB)\b/i);
  expect(result.rawText).not.toMatch(/\b(width|height|dimensions|file size)\b/i);
};

test("B-21 offline OCR returns real text (not metadata) and streams real progress", async ({ page }) => {
  await page.goto("/");
  const result = await scanTextImage(page, "eng");

  expect(result.rawText).toContain("demo@vaultzero.local");
  expect(result.rawText).toContain("S3cret-42");
  expect(result.creds.rawText).toBe(result.rawText);
  expect(result.creds.username).toBe("demo@vaultzero.local");
  expectNoMetadata(result);

  // Real engine stages: 10 (validated) → 25 (preprocessed) → worker logger → 100.
  expect(result.progress.length).toBeGreaterThanOrEqual(3);
  expect(result.progress[0]).toBe(10);
  expect(result.progress[result.progress.length - 1]).toBe(100);
  for (let i = 1; i < result.progress.length; i++) {
    expect(result.progress[i]).toBeGreaterThanOrEqual(result.progress[i - 1]);
  }
  expect(new Set(result.progress).size).toBeGreaterThanOrEqual(3);
});

test("B-22 dual eng+ben offline worker really recognises text", async ({ page }) => {
  await page.goto("/");
  const result = await scanTextImage(page, "eng+ben");

  expect(result.rawText).toContain("demo@vaultzero.local");
  expectNoMetadata(result);
  expect(result.progress[result.progress.length - 1]).toBe(100);
});

test("B-23 strict RFC 6238 setup keys reject short/random inputs", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const m = await import("/src/lib/totp.ts");
    const shortUris = [
      "otpauth://totp/Acme:bob?secret=abc",
      "otpauth://totp/Acme:bob?secret=123456",
      "otpauth://totp/Acme:bob?secret=839201",
      "otpauth://totp/Acme:bob?issuer=Acme",
    ];
    let resolutionThrew = false;
    try {
      m.resolveTotpConfig("otpauth://totp/Acme:bob?secret=abc");
    } catch {
      resolutionThrew = true;
    }
    const sha256 = await m.generateTotp(
      {
        secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA",
        algorithm: "SHA-256",
        digits: 8,
        period: 30,
      },
      59
    );
    return {
      shortUrisRejected: shortUris.every((u) => !m.isValidTotpSecret(u)),
      bareShortRejected: !m.isValidTotpSecret("abc") && !m.isValidTotpSecret("839 201"),
      validUriAccepted: m.isValidTotpSecret("otpauth://totp/GitHub:ayaan?secret=JBSWY3DPEHPK3PXP&issuer=GitHub"),
      validBase32Accepted: m.isValidTotpSecret("JBSWY3DPEHPK3PXP"),
      resolutionThrew,
      sha256: sha256.rawCode,
    };
  });

  expect(result.shortUrisRejected).toBe(true);
  expect(result.bareShortRejected).toBe(true);
  expect(result.validUriAccepted).toBe(true);
  expect(result.validBase32Accepted).toBe(true);
  expect(result.resolutionThrew).toBe(true);
  expect(result.sha256).toBe("46119246"); // RFC 6238 Appendix B
});
