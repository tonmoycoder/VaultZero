// V-39: the app must not grow `localStorage` without bound.
//
// `createPreUpdateBackup` used to write a **new timestamped key on every
// update check** and never removed the old ones. Each snapshot is a full
// copy of the encrypted vault, so the storage quota could be exhausted
// after a modest number of update checks — at which point the app could no
// longer save anything, including the very update the user was installing.
//
// `archiveAndResetVault` had the same unbounded-archive problem.
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
const u = await import(BUNDLE_DIR + "updater-built.mjs");

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

console.log("=== pre-update snapshots ===");

// Put a realistic encrypted container in place.
const session = await m.createNewVault(
  "storage-growth-password",
  [],
  undefined,
  undefined,
  undefined
);
const raw = store.get(m.VAULT_STORAGE_KEY);
t("a vault container exists", !!raw);

// Simulate 50 update checks.
for (let i = 0; i < 50; i += 1) {
  u.createPreUpdateBackup();
}

const backupKeys = [...store.keys()].filter((k) =>
  k.startsWith("vaultzero_pre_update_backup_")
);
t("no timestamped snapshots accumulate", backupKeys.length === 0, `found ${backupKeys.length}`);
t("exactly one canonical snapshot exists", store.has(u.PRE_UPDATE_BACKUP_KEY));
t("the snapshot matches the vault container", store.get(u.PRE_UPDATE_BACKUP_KEY) === raw);
t("the total storage does not grow with the number of checks", store.size <= 3, `store size ${store.size}`);

console.log("=== stale snapshots from an older build ===");

// Simulate the state an older build would have left behind.
store.set("vaultzero_pre_update_backup_2020-01-01T00-00-00-000Z", raw);
store.set("vaultzero_pre_update_backup_2021-01-01T00-00-00-000Z", raw);
t("stale snapshots exist before the cleanup", store.size >= 3);

u.createPreUpdateBackup();
const remainingStale = [...store.keys()].filter((k) =>
  k.startsWith("vaultzero_pre_update_backup_")
);
t("stale snapshots are cleaned up", remainingStale.length === 0, `found ${remainingStale.length}`);

console.log("=== emergency vault archives ===");

for (let i = 0; i < 8; i += 1) {
  m.archiveAndResetVault("emergency_reset");
  // Put a container back so the next archive has something to copy.
  store.set(m.VAULT_STORAGE_KEY, raw);
}

const archives = [...store.keys()].filter((k) => k.startsWith("vaultzero_archived_"));
t(
  "the archive count is bounded",
  archives.length <= m.MAX_VAULT_ARCHIVES,
  `${archives.length} archives, limit ${m.MAX_VAULT_ARCHIVES}`
);
t("at least one archive is kept", archives.length >= 1);

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
