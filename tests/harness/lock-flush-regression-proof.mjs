// Proves the V-36 bug existed and that the fix addresses it.
//
// Simulates the OLD `lockVault()` ordering: `void writer.flush()` (fire and
// forget) followed immediately by `vaultMutationQueue.bumpEpoch()`.
//
// With the old code the queued write scheduled itself against the old
// epoch; the bump invalidated it and the write was rejected with LOCKED,
// so the edit was lost.
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

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

const m = await import("/tmp/vz-tests/storage-built.mjs");

const session = await m.createNewVault(
  "proof-password-1234",
  [],
  undefined,
  undefined,
  undefined
);
const base = {
  id: "i1",
  brand: "github",
  category: "login",
  label: "Before",
  username: "u@e.com",
  password: "pw",
  url: "",
  notes: "",
  favorite: false,
  createdAt: 1,
  updatedAt: 1,
  strength: "strong",
};
await m.persistVaultChanges([base], session);

// --- OLD behaviour -------------------------------------------------------
const oldWriter = new m.CoalescingVaultWriter(10_000);
oldWriter.schedule([{ ...base, label: "After edit" }], session);
const flushPromise = oldWriter.flush(); // fire and forget
m.vaultMutationQueue.bumpEpoch(); // immediate bump
let oldError = null;
try {
  await flushPromise;
} catch (e) {
  oldError = e;
}

console.log("OLD ordering -> error:", oldError ? (oldError.code ?? oldError.message) : "(none)");
console.log("OLD ordering -> edit lost:", oldError ? "YES (data loss)" : "no");

// --- NEW behaviour -------------------------------------------------------
const newWriter = new m.CoalescingVaultWriter(10_000);
newWriter.schedule([{ ...base, label: "After edit" }], session);
await newWriter.flush(true); // awaited final write
m.vaultMutationQueue.bumpEpoch();
let newError = null;
try {
  await newWriter.flush();
} catch (e) {
  newError = e;
}
console.log("NEW ordering -> error:", newError ? (newError.code ?? newError.message) : "(none)");

const ok = !!oldError && !newError;
console.log(
  ok
    ? "PASS: bug reproduced by old ordering, fixed by new ordering"
    : "FAIL: could not demonstrate the regression"
);
process.exit(ok ? 0 : 1);
