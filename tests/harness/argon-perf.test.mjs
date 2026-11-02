// V-35: the Argon2id KDF must be used for the primary and recovery slots,
// must be fast enough for a mobile device, and must reject a wrong
// password.
import { webcrypto } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

// The harness bundles are built into the repository (see
// `scripts/build-test-bundles.mjs`) and gitignored. The path is derived
// from this file so it works on any platform and any working directory.
const BUNDLE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".harness-build") + "/";

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
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
};

const m = await import(BUNDLE_DIR + "storage-built.mjs");

const t0 = Date.now();
const session = await m.createNewVault(
  "correct-horse-battery-staple",
  [],
  undefined,
  undefined,
  undefined
);
const createMs = Date.now() - t0;

const t1 = Date.now();
const unlocked = await m.unlockVault("correct-horse-battery-staple");
const unlockMs = Date.now() - t1;

console.log(`create: ${createMs} ms`);
console.log(`unlock: ${unlockMs} ms`);

const raw = store.get(m.VAULT_STORAGE_KEY);
const container = JSON.parse(raw);
console.log("primary slot kdf:", container.primaryKeySlot.kdf);
console.log("recovery slot kdf:", container.recoveryKeySlot?.kdf);

let failures = 0;
const check = (name, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failures++;
};

check("the primary slot uses Argon2id", container.primaryKeySlot.kdf === "argon2id");
check("the vault unlocks", !!unlocked);

// PERFORMANCE TARGET: the 64 MiB Argon2id profile must complete well
// inside the 1.5 s budget on the target hardware class, otherwise the app
// feels broken on an old Android phone.
check(`create stays under 1500 ms (${createMs} ms)`, createMs < 1500);
check(`unlock stays under 1500 ms (${unlockMs} ms)`, unlockMs < 1500);

let wrongFailed = false;
try {
  await m.unlockVault("wrong-password");
} catch {
  wrongFailed = true;
}
check("a wrong password is rejected", wrongFailed);

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
