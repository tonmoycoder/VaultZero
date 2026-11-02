// V-24: Copy All must never carry a TOTP setup secret or recovery codes.
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const v = await import("/tmp/vz-tests/vault-built.mjs");

let failures = 0;
const t = (name, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failures++;
};

const item = {
  id: "i1",
  title: "GitHub",
  brand: "github",
  category: "login",
  username: "user@example.com",
  password: "s3cret",
  url: "https://github.com",
  note: "a note",
  folder: "Work",
  totp: "JBSWY3DPEHPK3PXP",
  totpSecret: "JBSWY3DPEHPK3PXP",
  recoveryCodes: ["aaaa-bbbb", "cccc-dddd"],
  passwordHistory: [{ password: "old-password", changedAt: 1 }],
  strength: "strong",
  favorite: false,
  createdAt: 1,
  updatedAt: 1,
};

const copied = v.buildFormattedQuickCopy(item, "123456");

console.log("=== what Copy All must contain ===");
t("has the account title", copied.includes("GitHub"));
t("has the username", copied.includes("user@example.com"));
t("has the password", copied.includes("s3cret"));
t("has the totp code", copied.includes("123456"));

console.log("=== what Copy All must NOT contain ===");
t("NO totp setup secret", !copied.includes("JBSWY3DPEHPK3PXP"));
t("NO recovery codes", !copied.includes("aaaa-bbbb") && !copied.includes("cccc-dddd"));
t("NO Setup Key label", !copied.includes("Setup Key"));
t("NO Recovery Codes label", !copied.includes("Recovery Codes"));
t("NO old password from the history", !copied.includes("old-password"));

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
