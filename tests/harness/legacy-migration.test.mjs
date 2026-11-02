// V-35: a legacy PBKDF2 vault must still open, and must be migrated.
//
// The browser KDF moved from PBKDF2-SHA256 (600,000 iterations) to Argon2id.
// A vault created by an older build carries a `pbkdf2-sha256` slot and must
// still be readable — otherwise every existing user's vault would be
// bricked by the upgrade.
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

const hex = (bytes) => Buffer.from(bytes).toString("hex");

const PASSWORD = "legacy-vault-password";
const ITEM = {
  id: "legacy-1",
  brand: "github",
  category: "login",
  label: "Legacy entry",
  username: "legacy@example.com",
  password: "legacy-secret",
  url: "https://github.com",
  notes: "",
  favorite: false,
  createdAt: 1,
  updatedAt: 1,
  strength: "strong",
};

// --- Build a legacy PBKDF2 container by hand ---------------------------
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const iterations = 600000;

// PBKDF2-SHA256 with the same mixing the legacy code used. With no keyfile
// the legacy path feeds the **raw password bytes** to PBKDF2 (see
// `deriveKek` in `src/lib/storage.ts`).
const secret = new TextEncoder().encode(PASSWORD);

const pbkdf2Kek = await crypto.subtle.importKey(
  "raw",
  secret,
  { name: "PBKDF2" },
  false,
  ["deriveKey"]
);
const kek = await crypto.subtle.deriveKey(
  { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
  pbkdf2Kek,
  { name: "AES-GCM", length: 256 },
  false,
  ["encrypt", "decrypt"]
);

const rawDataKey = crypto.getRandomValues(new Uint8Array(32));
const wrapped = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, kek, rawDataKey);

// Encrypt the payload with the data key.
const dataKey = await crypto.subtle.importKey(
  "raw",
  rawDataKey,
  { name: "AES-GCM" },
  false,
  ["encrypt", "decrypt"]
);
const payloadIv = crypto.getRandomValues(new Uint8Array(12));
const payload = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv: payloadIv },
  dataKey,
  new TextEncoder().encode(JSON.stringify([ITEM]))
);

const legacyContainer = {
  version: 3,
  primaryKeySlot: {
    salt: hex(salt),
    iv: hex(iv),
    wrappedKey: hex(new Uint8Array(wrapped)),
    iterations,
    kdf: "pbkdf2-sha256",
  },
  payload: {
    iv: hex(payloadIv),
    ciphertext: hex(new Uint8Array(payload)),
  },
  createdAt: Date.now(),
};

store.set(m.VAULT_STORAGE_KEY, JSON.stringify(legacyContainer));

console.log("=== legacy PBKDF2 vault ===");

const session = await m.unlockVault(PASSWORD);
t("a legacy PBKDF2 vault opens", !!session);
const items = session.items ?? session;
const found = Array.isArray(items) ? items.find((i) => i.id === "legacy-1") : undefined;
t("the legacy entry is readable", !!found);
t("the legacy password decrypts correctly", found?.password === "legacy-secret");

// The wrong password must still be rejected.
let wrongRejected = false;
try {
  await m.unlockVault("not-the-password");
} catch {
  wrongRejected = true;
}
t("the wrong password is rejected", wrongRejected);

console.log("=== migration to Argon2id ===");
await m.persistVaultChanges(items, session);
const after = JSON.parse(store.get(m.VAULT_STORAGE_KEY));
t(
  "the slot is migrated to Argon2id after a write",
  after.primaryKeySlot?.kdf === "argon2id",
  `kdf=${after.primaryKeySlot?.kdf}`
);

// The migrated vault must still open with the same password.
m.clearActiveSession();
const reopened = await m.unlockVault(PASSWORD);
const reopenedItems = reopened.items ?? reopened;
const refound = Array.isArray(reopenedItems)
  ? reopenedItems.find((i) => i.id === "legacy-1")
  : undefined;
t("the migrated vault opens with the same password", !!refound);
t("the migrated entry is intact", refound?.password === "legacy-secret");

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
