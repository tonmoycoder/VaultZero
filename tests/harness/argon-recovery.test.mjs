// V-35: the recovery slot must also use Argon2id, and must open the
// vault with the recovery key.
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

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

const RECOVERY_KEY = "ABCD-EFGH-IJKL-MNOP-QRST-UVWX";

const session = await m.createNewVault(
  "recovery-test-password",
  [],
  undefined,
  undefined,
  RECOVERY_KEY
);

const raw = store.get(m.VAULT_STORAGE_KEY);
const container = JSON.parse(raw);
console.log("recovery slot kdf:", container.recoveryKeySlot?.kdf);

t("the recovery slot exists", !!container.recoveryKeySlot);
t("the recovery slot uses Argon2id", container.recoveryKeySlot?.kdf === "argon2id");

m.clearActiveSession();
const viaRecovery = await m.unlockVault(RECOVERY_KEY);
t("the vault opens with the recovery key", !!viaRecovery);

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
