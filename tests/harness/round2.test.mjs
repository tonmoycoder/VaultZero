// V-24 / V-23: passphrase entropy and uniqueness, and V-32: updater URL
// trust.
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const gen = await import("/tmp/vz-tests/generate-built.mjs");
const up = await import("/tmp/vz-tests/updater-built.mjs");

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

console.log("=== V-24: entropy ===");

t("5 words >= 64 bits", gen.passphraseEntropy(5) >= 64, `got ${gen.passphraseEntropy(5)}`);
t("6 words >= 77 bits", gen.passphraseEntropy(6) >= 77, `got ${gen.passphraseEntropy(6)}`);
t(
  "entropy grows with words",
  gen.passphraseEntropy(8) > gen.passphraseEntropy(5)
);
t("the wordlist has 7772 entries", gen.WORDLIST_LEN === 7772, `got ${gen.WORDLIST_LEN}`);
t(
  "bits per word matches the documented value",
  Math.abs(gen.BITS_PER_WORD - 12.92407) < 0.001,
  `got ${gen.BITS_PER_WORD}`
);

console.log("=== V-23: no repeated words ===");

let allUnique = true;
let allLen5 = true;
for (let i = 0; i < 100; i += 1) {
  const p = await gen.generatePassphrase(5, "-", false);
  const words = p.split("-");
  if (words.length !== 5) allLen5 = false;
  if (new Set(words).size !== 5) allUnique = false;
}
t("always 5 words", allLen5);
t("never a repeated word", allUnique);

console.log("=== V-32: updater trust ===");

t(
  "a trusted release URL is accepted",
  up.isTrustedDownloadUrl(
    "https://github.com/tonmoycoder/VaultZero/releases/download/v1.2.3/app.exe"
  )
);
t("an evil host is rejected", !up.isTrustedDownloadUrl("https://evil.com/app.exe"));
t("http is rejected", !up.isTrustedDownloadUrl("http://github.com/tonmoycoder/VaultZero/releases/download/v1/app.exe"));
t(
  "a wrong repo is rejected",
  !up.isTrustedDownloadUrl("https://github.com/evil/repo/releases/download/v1/app.exe")
);
t("javascript: is rejected", !up.isTrustedDownloadUrl("javascript:alert(1)"));
t("a non-URL is rejected", !up.isTrustedDownloadUrl("not-a-url"));

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
