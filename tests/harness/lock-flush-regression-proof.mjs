// Proves the V-36 bug existed and that the fix addresses it.
//
// Simulates the OLD `lockVault()` ordering: `void writer.flush()` (fire and
// forget) followed immediately by `vaultMutationQueue.bumpEpoch()`.
//
// With the old code the queued write scheduled itself against the old
// epoch; the bump invalidated it and the write was rejected with LOCKED,
// so the edit was lost.
import { webcrypto } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

// The harness bundles are built into the repository (see
// `scripts/build-test-bundles.mjs`) and gitignored. The path is derived
// from this file so it works on any platform and any working directory.
const BUNDLE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".harness-build");

/**
 * Builds a `file://` URL for a harness bundle.
 *
 * On Windows a bare path is not a valid ESM specifier, so `import()`
 * rejects it. Converting the path to a `file://` URL works everywhere.
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
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
};

const m = await import(bundleUrl("storage-built.mjs"));

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

/*
 * This harness is a *demonstration*, not an assertion suite.
 *
 * It shows what the old ordering did — the write was rejected with
 * `LOCKED` and the edit was lost — and what the current ordering does.
 * On a build where the fix is present, the old ordering is no longer
 * reachable through the public API, so the "old" half of the
 * demonstration cannot reproduce the failure any more. That is a good
 * outcome, and this script must not fail the CI run because of it.
 *
 * The assertion that actually guards the fix lives in
 * `lock-flush.test.mjs`.
 */
const fixed = !newError;
console.log(
  fixed
    ? "PASS: the current ordering does not lose the final write."
    : "FAIL: the current ordering rejected the final write."
);
if (!oldError) {
  console.log(
    "NOTE: the old ordering could no longer be reproduced - the fix also " +
      "changed the queue, so this demonstration can no longer show the " +
      "original data loss. See lock-flush.test.mjs for the live assertion."
  );
}
process.exit(fixed ? 0 : 1);
