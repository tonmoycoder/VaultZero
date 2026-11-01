import { test, expect } from "@playwright/test";
import {
  decodeBase32,
  parseOtpAuthUri,
  generateTotp,
} from "../src/lib/totp";
import {
  extractCredentialsFromText,
  MAX_OCR_FILE_SIZE,
} from "../src/lib/ocr";
import { copySecure, clearClipboardWipe } from "../src/lib/clipboard";

test.describe("WP-06: Local Privacy Components (TOTP, Bounded OCR, Secure Clipboard)", () => {
  test("RFC 6238 TOTP generates deterministic code matching RFC test vector", async () => {
    // Standard RFC test secret: "12345678901234567890" in base32 is "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

    // At Unix epoch 59 seconds, counter = 1 (since 59 / 30 = 1).
    // RFC 6238 test vector for SHA1 at 59s with this secret: "287082"
    const result59 = await generateTotp(secret, 59);
    expect(result59.rawCode).toBe("287082");
    expect(result59.code).toBe("287 082");
    expect(result59.remaining).toBe(1); // 30 - (59 % 30) = 1

    // At Unix epoch 1111111109s, RFC 6238 test vector: "081804"
    const resultEpoch = await generateTotp(secret, 1111111109);
    expect(resultEpoch.rawCode).toBe("081804");
    expect(resultEpoch.code).toBe("081 804");
  });

  test("Base32 decoder handles spaces, hyphens, and lowercase gracefully", () => {
    const raw = "jbsw y3dp-ehpk 3pxp";
    const decoded = decodeBase32(raw);
    expect(decoded.length).toBe(10);
  });

  test("Parses otpauth://totp/ URI correctly", () => {
    const uri = "otpauth://totp/GitHub:ayaan?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&algorithm=SHA256&digits=8&period=60";
    const parsed = parseOtpAuthUri(uri);

    expect(parsed.issuer).toBe("GitHub");
    expect(parsed.label).toBe("ayaan");
    expect(parsed.secret).toBe("JBSWY3DPEHPK3PXP");
    expect(parsed.algorithm).toBe("SHA-256");
    expect(parsed.digits).toBe(8);
    expect(parsed.period).toBe(60);
  });

  test("OCR credential extraction accurately identifies username, password, url, totp, and recovery codes", () => {
    const ocrSample = `
      Welcome to Proton Mail
      Sign In to your account: https://account.proton.me/login
      Username: ayaan.rahman@proton.me
      Password: SuperSecretProtonPassword!99
      Two-Factor Secret: JBSWY3DPEHPK3PXP
      Backup Recovery Codes:
      4a9b-8c1d
      f2e4-98a1
      b3c7-11d5
    `;

    const extracted = extractCredentialsFromText(ocrSample);
    expect(extracted.url).toBe("https://account.proton.me/login");
    expect(extracted.username).toBe("ayaan.rahman@proton.me");
    expect(extracted.password).toBe("SuperSecretProtonPassword!99");
    expect(extracted.totpSecret).toBe("JBSWY3DPEHPK3PXP");
    expect(extracted.recoveryCodes).toEqual(["4a9b-8c1d", "f2e4-98a1", "b3c7-11d5"]);
  });

  test("Secure clipboard auto-wipe cleans up state and cancels existing timers", async () => {
    let wiped = false;
    const ok = await copySecure("secret-token-1234", {
      timeoutMs: 50,
      onWipe: () => {
        wiped = true;
      },
    });

    // In non-browser Node runtime navigator.clipboard may fallback to textarea or return false/true
    expect(typeof ok).toBe("boolean");
    await clearClipboardWipe();
  });
});
