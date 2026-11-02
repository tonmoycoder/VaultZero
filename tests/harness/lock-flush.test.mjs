// V-36: the final coalesced write must survive a vault lock.
//
// The bug: `lockVault()` fired `vaultWriter.flush()` without awaiting it and
// then immediately bumped the mutation-queue epoch. The queued write had
// scheduled itself against the old epoch, so the bump invalidated it and
// the write was rejected with `LOCKED` — the user's last edit was silently
// lost at exactly the moment they pressed "Lock".
//
// This harness reproduces the sequence at the storage layer: schedule a
// write, then lock (flush -> bump epoch -> clear session) and assert that
// the stored container reflects the final state.
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
  sessionStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
};

const m = await import(BUNDLE_DIR + "storage-built.mjs");

let failures = 0;
const check = (name, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failures++;
};

// 1. Create a vault with one item.
const session = await m.createNewVault(
  "lock-flush-test-password",
  [],
  undefined,
  undefined,
  undefined
);

const item = {
  id: "item-1",
  brand: "github",
  category: "login",
  label: "Original label",
  username: "user@example.com",
  password: "s3cret-password",
  url: "https://github.com",
  notes: "",
  favorite: false,
  createdAt: 1,
  updatedAt: 1,
  strength: "strong",
};

await m.persistVaultChanges([item], session);

// 2. Schedule a coalesced write with an UPDATED value, then flush it as the
//    final write before bumping the epoch — the exact lock sequence.
const writer = new m.CoalescingVaultWriter(10_000); // never auto-flush
const updated = { ...item, label: "Edited right before lock", password: "edited-password" };
writer.schedule([updated], session);

check("writer has a pending write", writer.hasPending);

// Simulate `lockVault()`: await the final flush, then bump the epoch.
await writer.flush(true);
m.vaultMutationQueue.bumpEpoch();
m.clearActiveSession();

// 3. The stored container must contain the edited value.
const raw = store.get(m.VAULT_STORAGE_KEY);
check("container was written", !!raw);

const container = JSON.parse(raw);
check("payload present", !!container.payload);

// 4. Unlock again and read the item back.
const reopened = await m.unlockVault("lock-flush-test-password");
const items = reopened.items ?? reopened;
const found = Array.isArray(items) ? items.find((i) => i.id === "item-1") : undefined;

check("edited item is present after lock+unlock", !!found);
check("label survived the lock", found?.label === "Edited right before lock");
check("password survived the lock", found?.password === "edited-password");

// 5. A final flush must not be rejected by the epoch bump that follows it.
let rejected = false;
try {
  const w2 = new m.CoalescingVaultWriter(10_000);
  w2.schedule([{ ...updated, label: "Second final write" }], session);
  await w2.flush(true);
} catch (err) {
  rejected = true;
  console.log("   error:", err && err.code ? err.code : err);
}
check("final flush is not rejected with LOCKED", !rejected);

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
