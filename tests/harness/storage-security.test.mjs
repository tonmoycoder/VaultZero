// V-29: no plaintext secret may survive in the frontend session object.
//
// The `UnlockedSession` used to carry the master password, the keyfile
// bytes and the derived key. Everything secret now lives in module-scoped
// memory that is cleared on lock, and the session carries only non-
// sensitive flags.
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

const SECRET_FIELDS = [
  "password",
  "masterPassword",
  "keyfileBytes",
  "keyfile",
  "dataKey",
  "cryptoKey",
  "key",
  "secret",
];

console.log("=== the session object carries no secrets ===");

const session = await m.createNewVault(
  "session-secret-check",
  [],
  undefined,
  undefined,
  undefined
);

for (const field of SECRET_FIELDS) {
  t(`the session has no "${field}" field`, !(field in session));
}

const serialized = JSON.stringify(session);
t("the serialized session contains no password", !serialized.includes("session-secret-check"));

console.log("=== sessionStorage carries no secrets ===");

const sessionRaw = store.get(m.VAULT_STORAGE_KEY);
t("the vault container is stored (encrypted)", !!sessionRaw);
t(
  "the container does not contain the master password in the clear",
  !String(sessionRaw).includes("session-secret-check")
);

console.log("=== locking clears the in-memory session ===");

m.clearActiveSession();
t("getActiveSession returns null after a lock", m.getActiveSession() === null);

console.log("=== the wrong password is rejected ===");

let wrongRejected = false;
try {
  await m.unlockVault("definitely-wrong");
} catch {
  wrongRejected = true;
}
t("the wrong password is rejected", wrongRejected);

console.log("=== the right password still unlocks ===");

const reopened = await m.unlockVault("session-secret-check");
t("the vault opens", !!reopened);
t("getActiveSession returns the session", m.getActiveSession() !== null);

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
