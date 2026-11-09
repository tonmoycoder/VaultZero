// V-94 / Batch 5 — an `otpauth://` URI is only as trustworthy as the Base32
// setup key it carries. `parseOtpAuthUri()` used to accept ANY non-empty
// `secret=` parameter, so `?secret=abc` was treated as a valid 2FA account
// and produced a bogus 6-digit code from a 1-byte HMAC key. This harness
// locks the RFC 6238 rule down for the URI path as well as the raw path.
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

console.log("=== positive control: the old parse-only check is insufficient ===");
// A URL parser happily returns a 3-character secret. If the app only asked
// "does a secret parameter exist?", this random short input would be accepted.
t(
  "a short secret survives a bare URL parse (so a guard is needed)",
  new URL("otpauth://totp/Acme:bob?secret=abc").searchParams.get("secret") === "abc"
);

console.log("=== strict otpauth URI validation ===");
const GOOD = "otpauth://totp/GitHub:ayaan?secret=JBSWY3DPEHPK3PXP&issuer=GitHub";
const BAD = [
  "otpauth://totp/Acme:bob?secret=abc", // too short, valid chars
  "otpauth://totp/Acme:bob?secret=123456", // numeric, invalid Base32 chars
  "otpauth://totp/Acme:bob?secret=839201", // the old hardcoded demo "code"
  "otpauth://totp/Acme:bob?secret=JBSWY3DPEHPK3PXP0", // '0' is not Base32
  "otpauth://totp/Acme:bob?issuer=Acme", // no secret at all
  "otpauth://hotp/Acme:bob?secret=JBSWY3DPEHPK3PXP", // HOTP, not TOTP
];
for (const uri of BAD) {
  t(`rejects ${uri.slice(0, 52)}`, !m.isValidTotpSecret(uri));
}
t("accepts a URI with a valid 16+ Base32 secret", m.isValidTotpSecret(GOOD));
t(
  "accepts a URI with SHA256/digits/period and a valid secret",
  m.isValidTotpSecret("otpauth://totp/Acme:bob?secret=JBSWY3DPEHPK3PXP&algorithm=SHA256&digits=8&period=60")
);
t("still rejects a bare short secret", !m.isValidTotpSecret("abc"));
t("still rejects the old static demo code", !m.isValidTotpSecret("839 201"));

console.log("=== resolution fails closed ===");
let threw = false;
try {
  m.resolveTotpConfig("otpauth://totp/Acme:bob?secret=abc");
} catch {
  threw = true;
}
t("resolveTotpConfig throws on a short inner secret", threw);
const cfg = m.resolveTotpConfig(GOOD);
t("resolveTotpConfig normalises a valid URI secret", cfg.secret === "JBSWY3DPEHPK3PXP", JSON.stringify(cfg));

console.log("=== RFC 6238 Appendix B vectors (8 digits @ T=59) ===");
const SECRETS = {
  "SHA-1": "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
  "SHA-256": "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA",
  "SHA-512": "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNA",
};
const EXPECTED = { "SHA-1": "94287082", "SHA-256": "46119246", "SHA-512": "90693936" };
for (const [algorithm, secret] of Object.entries(SECRETS)) {
  const r = await m.generateTotp({ secret, digits: 8, algorithm, period: 30 }, 59);
  t(`${algorithm} @ T=59 is ${EXPECTED[algorithm]}`, r.rawCode === EXPECTED[algorithm], r.rawCode);
  t(`${algorithm} secret is valid`, m.isValidTotpSecret(secret));
}

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
