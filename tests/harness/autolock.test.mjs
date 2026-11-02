// The auto-lock timer must lock the vault after a period of inactivity,
// and the setting must be clamped and persisted.
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
  addEventListener: () => {},
  removeEventListener: () => {},
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id),
  document: { visibilityState: "visible" },
};

const m = await import(BUNDLE_DIR + "autoLock-built.mjs");

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

console.log("=== the setting is clamped and persisted ===");

m.writeAutoLockMinutes(-5);
t("a negative value reads back as 0", m.readAutoLockMinutes() === 0, `got ${m.readAutoLockMinutes()}`);

m.writeAutoLockMinutes(9999);
t(
  "a huge value is clamped",
  m.readAutoLockMinutes() <= 1440,
  `got ${m.readAutoLockMinutes()}`
);

m.writeAutoLockMinutes(15);
t("a normal value is preserved", m.readAutoLockMinutes() === 15);
t(
  "the setting is written to storage",
  store.get(m.AUTO_LOCK_STORAGE_KEY) === "15",
  `got ${store.get(m.AUTO_LOCK_STORAGE_KEY)}`
);

console.log("=== the default ===");

store.delete(m.AUTO_LOCK_STORAGE_KEY);
t(
  "an unset value falls back to the default",
  m.readAutoLockMinutes() === m.DEFAULT_AUTO_LOCK_MINUTES,
  `got ${m.readAutoLockMinutes()}`
);

console.log("=== the controller ===");

let lockReason = null;
let beforeLockRan = false;
const controller = m.createAutoLock({
  onLock: (reason) => {
    lockReason = reason;
  },
  onBeforeLock: () => {
    beforeLockRan = true;
  },
});

t("a controller is returned", !!controller);
t("the controller exposes the timeout", controller.timeoutMinutes === m.DEFAULT_AUTO_LOCK_MINUTES);
t("the controller can report the remaining time", typeof controller.remainingMs() === "number");

// A manual lock must fire the hook and the callback.
controller.lockNow("manual");
t("a manual lock calls onLock", lockReason === "manual", `got ${lockReason}`);
t("a manual lock calls onBeforeLock", beforeLockRan === true);

// Activity must not lock the vault.
controller.noteActivity();
t("noting activity does not lock", lockReason === "manual");

controller.stop();

console.log("=== a zero timeout disables auto-lock ===");

m.writeAutoLockMinutes(0);
let zeroLocked = false;
const zero = m.createAutoLock({
  onLock: () => {
    zeroLocked = true;
  },
});
zero.setTimeoutMinutes(0);
zero.noteActivity();
t("a zero timeout does not auto-lock", zeroLocked === false);
zero.stop();

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
