// V-99 — the Windows unlock screen said "Some of the values entered were not
// valid." after a WRONG master password. The user read that as the app being
// broken. Root cause: `classifyNativeError()` matched the substring 'VALID',
// which is present in "Authentication failed: invalid master password ..." and
// in "File header is invalid ...". Real AUTH_FAILED / INVALID_FORMAT /
// TAMPERED failures were therefore reported as VALIDATION.
//
// This harness runs the REAL `src/lib/platform.ts` (bundled browserlessly) so
// the regression cannot come back, and guards the Rust side that still leaked
// `e.to_string()` from unlock_vault.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const BUNDLE = pathToFileURL(join(ROOT, ".harness-build", "platform-built.mjs")).href;

const { classifyNativeError } = await import(BUNDLE);

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

console.log("=== positive controls: the assertions really detect misclassification ===");
t("the classifier is a function", typeof classifyNativeError === "function");
t("VALIDATION is a distinct code, not the fallback", classifyNativeError("invalid value: string \"x\", expected a u16") === "VALIDATION");
t("an unknown message is UNKNOWN, never VALIDATION", classifyNativeError("totally unexpected IPC text") === "UNKNOWN");

console.log("=== D-01: wrong password must say AUTH_FAILED, not VALIDATION ===");
t(
  "raw Rust AuthenticationFailed text -> AUTH_FAILED",
  classifyNativeError("Authentication failed: invalid master password or corrupted key") === "AUTH_FAILED",
  `got ${classifyNativeError("Authentication failed: invalid master password or corrupted key")}`
);
t(
  "safe AUTH_FAILED message -> AUTH_FAILED",
  classifyNativeError("Incorrect master password or keyfile. Nothing was changed.") === "AUTH_FAILED"
);
t(
  "raw InvalidHeader text -> INVALID_FORMAT (not VALIDATION)",
  classifyNativeError("File header is invalid or has wrong magic bytes (expected PMV1)") === "INVALID_FORMAT"
);
t(
  "safe INVALID_FORMAT message -> INVALID_FORMAT",
  classifyNativeError("This file is not a VaultZero vault, or it is corrupted.") === "INVALID_FORMAT"
);
t(
  "safe TAMPERED message -> TAMPERED",
  classifyNativeError("The vault failed its integrity check and was not modified.") === "TAMPERED"
);
t(
  "safe VAULT_MISSING message (Rust wording) -> VAULT_MISSING",
  classifyNativeError("No vault was found at this location. Create one to get started.") === "VAULT_MISSING"
);
t(
  "safe LOCKED message -> LOCKED",
  classifyNativeError("The vault is locked. Unlock it and try again.") === "LOCKED"
);
t(
  "safe IO message -> IO",
  classifyNativeError("The vault file could not be read or written.") === "IO"
);
t(
  "safe CRYPTO_FAILED message -> CRYPTO_FAILED",
  classifyNativeError("A cryptographic operation failed. The vault was not modified.") === "CRYPTO_FAILED"
);
t(
  "a structured code-only error is accepted",
  classifyNativeError("AUTH_FAILED") === "AUTH_FAILED"
);

console.log("=== D-01 guards: no raw internal text crosses the IPC boundary ===");
const platform = read("src/lib/platform.ts");
t("the 'VALID' substring heuristic is gone", !/upper\.includes\(['"]VALID['"]\)/.test(platform));
t("raw messages are still replaced by fixed safe messages", /safeMessage:\s*SAFE_MESSAGES\[code\]/.test(platform));
t("UNSUPPORTED is still used when Tauri is absent", /code:\s*'UNSUPPORTED'/.test(platform));

const rust = read("src-tauri/src/lib.rs");
const unlockBody = rust.slice(rust.indexOf("pub fn unlock_vault("), rust.indexOf("pub fn list_entries("));
t("unlock_vault uses safe_error instead of e.to_string()", /safe_error\(&e\)/.test(unlockBody) && !/e\.to_string\(\)/.test(unlockBody));
t("the other create_vault call sites still use safe_error", (rust.match(/safe_error\(&e\)/g) || []).length >= 5);

const lock = read("src/components/LockScreen.tsx");
const handleUnlock = lock.slice(lock.indexOf("const handleUnlock"), lock.indexOf("const handleSetup"));
const unlockCatch = handleUnlock.slice(handleUnlock.indexOf("catch"));
t("the unlock screen prefers err.safeMessage", /err\?\.safeMessage/.test(handleUnlock));
t("a failed unlock does not fire the success haptic", !/hapticSuccess\(\)/.test(unlockCatch));

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
