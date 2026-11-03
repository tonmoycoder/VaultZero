// V-35 edge case: a vault created with an EMPTY keyfile file.
//
// The native Rust core mixes a keyfile in whenever one was supplied
// (`if let Some(kf) = keyfile_bytes`), even when the file is empty. The
// browser used to skip the mixing for an empty file, and the container
// flagged `hasKeyfile: false`. The combination bricked the vault: the key
// was derived with a keyfile, but the vault claimed it had none.
//
// These tests cover the whole lifecycle with an empty keyfile.
import { webcrypto } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

// The harness bundles are built into the repository (see
// `scripts/build-test-bundles.mjs`) and gitignored. The path is derived
// from this file so it works on any platform and any working directory.
const BUNDLE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".harness-build") + "/";

/**
 * Builds a `file://` URL for a harness bundle.
 *
 * On Windows a bare `C:\\...\\.harness-build/storage-built.mjs` path is
 * not a valid ESM specifier, so `import()` rejects it. Converting the path
 * to a `file://` URL works on every platform.
 */
function bundleUrl(name) {
  return pathToFileURL(join(BUNDLE_DIR, name)).href;
}

const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  },
  sessionStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
};

const m = await import(bundleUrl("storage-built.mjs"));

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

const PASSWORD = "edge-case-password";
const emptyKeyfile = new Uint8Array(0);

console.log("=== creating a vault with an empty keyfile ===");

const session = await m.createNewVault(PASSWORD, [], emptyKeyfile, undefined, undefined);
t("the vault is created", !!session);

const container = JSON.parse(store.get(m.VAULT_STORAGE_KEY));
// The flag must be true: a keyfile *was* supplied.
t("hasKeyfile is true for an empty keyfile", container.hasKeyfile === true);
t("the slot records Argon2id", container.primaryKeySlot.kdf === "argon2id");

console.log("=== unlocking ===");
m.clearActiveSession();

let opened = null;
try {
  opened = await m.unlockVault(PASSWORD, emptyKeyfile);
} catch (err) {
  t("unlocking with the empty keyfile works", false, String(err && err.message));
}
if (opened) {
  t("unlocking with the empty keyfile works", true);
}

// Unlocking WITHOUT the keyfile must fail — the vault genuinely needs it.
m.clearActiveSession();
let rejectedWithout = false;
try {
  await m.unlockVault(PASSWORD);
} catch {
  rejectedWithout = true;
}
t("unlocking without the keyfile is rejected", rejectedWithout);

// Unlocking with the WRONG keyfile bytes must fail.
m.clearActiveSession();
let rejectedWrong = false;
try {
  await m.unlockVault(PASSWORD, new TextEncoder().encode("a different keyfile"));
} catch {
  rejectedWrong = true;
}
t("unlocking with a different keyfile is rejected", rejectedWrong);

// Unlocking with the wrong password but the right keyfile must fail.
m.clearActiveSession();
let rejectedWrongPw = false;
try {
  await m.unlockVault("wrong password", emptyKeyfile);
} catch {
  rejectedWrongPw = true;
}
t("unlocking with the wrong password is rejected", rejectedWrongPw);

// The correct password + correct keyfile must still work after the failures.
m.clearActiveSession();
const final = await m.unlockVault(PASSWORD, emptyKeyfile);
t("the vault still opens after failed attempts", !!final);

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
