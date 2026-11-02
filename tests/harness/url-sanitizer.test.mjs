// V-40: user-supplied URLs must never reach a sink that can execute code.
//
// A vault entry's URL comes from user data (typed, imported from CSV, or
// received over the local network). It ends up in an `href`, in
// `window.open`, and in the clipboard. A `javascript:` URL in an imported
// CSV would run inside the app's origin the moment the user clicked the
// link — in a password manager that can read the DOM and the decrypted
// vault.
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const m = await import("/tmp/vz-tests/url-built.mjs");

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

console.log("=== dangerous schemes are rejected ===");
for (const bad of [
  "javascript:alert(1)",
  "JavaScript:alert(1)",
  "  javascript:alert(1)  ",
  "java\tscript:alert(1)",
  "java\nscript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "DATA:text/html;base64,PHNjcmlwdD4=",
  "vbscript:msgbox(1)",
  "file:///etc/passwd",
  "blob:https://evil.com/uuid",
  "about:blank",
]) {
  t(`rejects ${JSON.stringify(bad).slice(0, 40)}`, m.sanitizeVaultUrl(bad) === null);
  t(
    `isSafeVaultUrl rejects ${JSON.stringify(bad).slice(0, 30)}`,
    m.isSafeVaultUrl(bad) === false
  );
}

console.log("=== legitimate URLs are accepted ===");
const cases = [
  ["https://github.com/login", "https://github.com/login"],
  ["http://example.com", "http://example.com/"],
  ["github.com", "https://github.com/"],
  ["  https://example.com/path?q=1  ", "https://example.com/path?q=1"],
  ["https://example.com:8443/x", "https://example.com:8443/x"],
];
for (const [input, expected] of cases) {
  const got = m.sanitizeVaultUrl(input);
  t(`accepts ${JSON.stringify(input).slice(0, 32)}`, got === expected, `got ${got}`);
}

console.log("=== isSafeVaultUrl does not rewrite ===");
t("keeps a bare host as-is", m.isSafeVaultUrl("github.com") === true);
t("keeps an https URL as-is", m.isSafeVaultUrl("https://github.com") === true);
t("rejects an empty string", m.isSafeVaultUrl("") === false);
t("rejects null", m.isSafeVaultUrl(null) === false);
t("rejects undefined", m.isSafeVaultUrl(undefined) === false);

console.log("=== displayHost ===");
t("extracts the hostname", m.displayHost("https://www.github.com/login") === "github.com");
t("handles a bare host", m.displayHost("github.com") === "github.com");
t(
  "falls back to the raw string for a bad URL",
  m.displayHost("javascript:alert(1)") === "javascript:alert(1)"
);

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
