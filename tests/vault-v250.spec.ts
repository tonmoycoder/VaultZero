import { test, expect } from "@playwright/test";
import { validateGoogleAuthSecret, generateTotp } from "../src/lib/totp";
import { APP_VERSION, compareSemver } from "../src/lib/version";
import { buildFormattedQuickCopy, initialItems } from "../src/lib/vault";
import { calculatePasswordAnatomy, checkPasswordBreach } from "../src/lib/breachScanner";

test.describe("VaultZero v2.5.0 Master Verification Suite", () => {
  test("1. Strict Google Authenticator 2FA Validation (RFC 4226 / Base32)", async () => {
    // Valid 16-char Base32
    const res = validateGoogleAuthSecret("JBSWY3DPEHPK3PXP");
    expect(res.valid).toBe(true);
    expect(res.cleanKey).toBe("JBSWY3DPEHPK3PXP");

    // Cleans spaces & dashes
    const resWithSpaces = validateGoogleAuthSecret("jbsw y3dp - ehpk 3pxp");
    expect(resWithSpaces.valid).toBe(true);
    expect(resWithSpaces.cleanKey).toBe("JBSWY3DPEHPK3PXP");

    // Rejects single character or < 16 characters
    const singleChar = validateGoogleAuthSecret("A");
    expect(singleChar.valid).toBe(false);

    const shortKey = validateGoogleAuthSecret("JBSWY3DP");
    expect(shortKey.valid).toBe(false);
    expect(shortKey.error).toContain("16");

    // Rejects invalid Base32 characters (0, 1, 8, 9, symbols)
    const invalidChar = validateGoogleAuthSecret("JBSWY3DPEHPK3PX8");
    expect(invalidChar.valid).toBe(false);

    const zeroChar = validateGoogleAuthSecret("JBSWY3DPEHPK3PX0");
    expect(zeroChar.valid).toBe(false);

    // Empty key rejected
    expect(validateGoogleAuthSecret("").valid).toBe(false);

    // Valid TOTP generation
    const totp = await generateTotp("JBSWY3DPEHPK3PXP", 1700000000);
    expect(totp.code).toMatch(/^\d{3}\s\d{3}$/);
    expect(totp.rawCode).toMatch(/^\d{6}$/);
  });

  test("2. Strict Semantic Versioning Comparison Engine", () => {
    expect(APP_VERSION).toBe("2.5.1");

    // Identifies newer versions
    expect(compareSemver("2.5.2", "2.5.1")).toBe(1);
    expect(compareSemver("v2.6.0", "v2.5.0")).toBe(1);
    expect(compareSemver("3.0.0", "2.5.0")).toBe(1);

    // Same version returns 0
    expect(compareSemver("2.5.0", "2.5.0")).toBe(0);
    expect(compareSemver("v2.5.0", "2.5.0")).toBe(0);

    // Older versions return -1 (never trigger false update)
    expect(compareSemver("2.4.1", "2.5.0")).toBe(-1);
    expect(compareSemver("v2.4.0", "2.5.0")).toBe(-1);
    expect(compareSemver("v2.2.0", "2.5.0")).toBe(-1);
  });

  test("3. Multi-Line Formatted Quick Copy Engine", () => {
    const demo = initialItems[0];
    const formatted = buildFormattedQuickCopy(demo, "123 456");

    expect(formatted).toContain("Account: VaultZero Demo Account");
    expect(formatted).toContain("Username / Email: demo@vaultzero.local");
    expect(formatted).toContain("Password: V0-Secure$Demo2026");
    expect(formatted).toContain("Website: vaultzero.me");
    expect(formatted).toContain("2FA Code (TOTP): 123 456");
    expect(formatted).toContain("Recovery Codes: VZ01-DEMO-9942");
    expect(formatted).toContain("Folder: Personal");
  });

  test("4. Zero-Knowledge Breach Scanner & Cryptographic Anatomy", async () => {
    // Offline dataset match
    const res1 = await checkPasswordBreach("123456");
    expect(res1.breached).toBe(true);
    expect(res1.source).toMatch(/offline/i);

    const res2 = await checkPasswordBreach("password");
    expect(res2.breached).toBe(true);

    // Cryptographic anatomy & crack time
    const weak = calculatePasswordAnatomy("123456");
    expect(weak.entropyBits).toBeLessThan(30);
    expect(weak.crackTimeHuman).toBe("< 1 second");

    const strong = calculatePasswordAnatomy("K9#mQ$8x!vL2@pZ1");
    expect(strong.entropyBits).toBeGreaterThan(80);
    expect(strong.hasLower).toBe(true);
    expect(strong.hasUpper).toBe(true);
    expect(strong.hasDigits).toBe(true);
    expect(strong.hasSymbols).toBe(true);
    expect(strong.crackTimeHuman).toContain("Centuries");
  });

  test("5. Factory Clean Default State", () => {
    expect(initialItems.length).toBe(1);
    expect(initialItems[0].id).toBe("demo-account");
    expect(initialItems[0].tags).toContain("Deletable");
  });
});
