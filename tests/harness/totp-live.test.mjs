// V-60: a "2FA code" must be computed from a real Base32 secret, never a
// hardcoded string and never the secret itself.
import { webcrypto } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const BUNDLE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".harness-build") + "/";
const m = await import(pathToFileURL(join(BUNDLE_DIR, "totp-built.mjs")).href);

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

console.log("=== secret validation ===");
t("RFC 6238 test secret is valid", m.isValidTotpSecret("JBSWY3DPEHPK3PXP"));
t("otpauth URI is valid", m.isValidTotpSecret("otpauth://totp/GitHub:ayaan?secret=JBSWY3DPEHPK3PXP&issuer=GitHub"));
t("the old hardcoded demo 'code' is NOT a secret", !m.isValidTotpSecret("839 201"));
t("a 6-digit code is NOT a setup secret", !m.isValidTotpSecret("123456"));
t("empty / null is rejected", !m.isValidTotpSecret("") && !m.isValidTotpSecret(null));

console.log("=== RFC 6238 / RFC 4226 vectors ===");
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const r59 = await m.generateTotp({ secret: RFC_SECRET, digits: 8, algorithm: "SHA-1", period: 30 }, 59);
t("SHA-1 @ T=59 is 94287082", r59.rawCode === "94287082", r59.rawCode);
const r111 = await m.generateTotp({ secret: RFC_SECRET, digits: 8, algorithm: "SHA-1", period: 30 }, 1111111109);
t("SHA-1 @ T=1111111109 is 07081804", r111.rawCode === "07081804", r111.rawCode);
t("8-digit RFC code is formatted as four plus four", /^\d{4} \d{4}$/.test(r59.code));
const six = await m.generateTotp("JBSWY3DPEHPK3PXP", 59);
t("default 6-digit code is three plus three", /^\d{3} \d{3}$/.test(six.code));

console.log("=== config resolution ===");
const cfg = m.resolveTotpConfig("otpauth://totp/Acme:bob?secret=JBSWY3DPEHPK3PXP&algorithm=SHA256&digits=8&period=60");
t("URI resolves the secret", cfg.secret === "JBSWY3DPEHPK3PXP");
t("URI resolves algorithm / digits / period", cfg.algorithm === "SHA-256" && cfg.digits === 8 && cfg.period === 60, JSON.stringify(cfg));

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
