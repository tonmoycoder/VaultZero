// V-99 — two more real defects visible in the Windows photos:
//
//   D-02  "Forgot master password? Recover vault" opens a 24-char recovery-key
//         form that CANNOT work in the desktop app. The native vault is a
//         `.pmv` file in app-data; the Rust header has NO recovery-key slot,
//         `create_vault` is called with `None`, and `recoverVaultWithRecoveryKey()`
//         only ever reads `localStorage`. Even "Fresh Reset" only cleared
//         localStorage, so the native `.pmv` stayed and the user was sent back
//         to "Welcome back" with the same unopenable vault.
//
//   D-03  Selecting an item shows a 654px-wide floating bulk bar pinned at
//         `bottom-8`. Measured in Chromium: 390x844 -> x=-132..522 (clipped on
//         both sides, Delete button right=476); 700x1000 -> overlaps the mobile
//         nav by 36px. The 1440px desktop was fine because `lg:hidden` removes
//         the nav.
//
// This harness asserts the real reset flow (browser AND mocked native IPC) plus
// the geometry contract in source. The Playwright spec measures the pixels.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const has = (rel) => existsSync(join(ROOT, rel));
const bundle = (name) => pathToFileURL(join(ROOT, ".harness-build", name)).href;

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

const rust = read("src-tauri/src/lib.rs");
const storage = read("src/lib/storage.ts");
const modal = read("src/components/VaultRecoveryModal.tsx");
const home = read("src/components/VaultHome.tsx");
const css = read("src/index.css");
const app = read("src/App.tsx");
const bulkBar = home.slice(home.indexOf("function FloatingBulkBar"), home.indexOf("export type SortMode"));
const bulkRules = [...css.matchAll(/\.floating-bulk-bar[^{]*\{([^}]*)\}/g)].map((m) => m[1]).join("\n");
const resetStart = storage.indexOf("export async function resetVaultForForgotPassword");
const resetFnBody = resetStart >= 0 ? storage.slice(resetStart, resetStart + 1800) : "";
const modalResetStart = modal.indexOf("const handleResetVault");
const modalResetBody = modalResetStart >= 0 ? modal.slice(modalResetStart, modalResetStart + 1200) : "";

const inViewport = (box, vp) => box.x >= -1 && box.right <= vp.width + 1;
console.log("=== positive controls: the detectors really detect the defects ===");
t("'bottom-8' is recognised as the old broken position", /bottom-8/.test("className=\"glass-strong fixed bottom-8 left-1/2 z-[70]\""));
t("a missing reset_vault command is recognised", !/pub fn reset_vault\(/.test("pub fn has_vault_file() {}"));
t("the measured 390px clipped bar is rejected", !inViewport({ x: -132, right: 522 }, { width: 390 }));
t("a viewport-constrained bar is accepted", inViewport({ x: 12, right: 378 }, { width: 390 }));

console.log("=== D-02: a real native archive + reset command ===");
t("Rust exposes reset_vault", /pub fn reset_vault\(/.test(rust));
t("reset_vault is registered with Tauri", /commands::reset_vault,/.test(rust));
t("reset_vault archives the .pmv file instead of deleting it", /local-vault\.archived-/.test(rust) && /std::fs::rename/.test(rust));
t("native archives are bounded (no unbounded disk growth)", /MAX_ARCHIVES/.test(rust));
t("has_vault_file guard is unchanged", /pub fn has_vault_file\(/.test(rust));
t("storage exports resetVaultForForgotPassword", /export async function resetVaultForForgotPassword/.test(storage));
t("the native branch calls the reset_vault command", /"reset_vault"/.test(storage));
t("the browser branch keeps archiveAndResetVault", /archiveAndResetVault\(/.test(storage));
t("reset clears the in-memory session and the native flag", /clearActiveSession\(\)/.test(resetFnBody) && /removeItem\(NATIVE_VAULT_FLAG\)/.test(resetFnBody));
t("MAX_VAULT_ARCHIVES is still 3", /export const MAX_VAULT_ARCHIVES = 3/.test(storage));

console.log("=== D-02: the recovery UI tells the truth on desktop ===");
t("the modal detects the native runtime", /isNativeRuntime\(\)/.test(modal));
t("the modal calls the new reset function", /await resetVaultForForgotPassword\(/.test(modalResetBody));
t("the modal no longer calls archiveAndResetVault directly", !/archiveAndResetVault\(/.test(modal));
t("the recovery-key form is not offered for native vaults", /nativeRuntime/.test(modal) && /nativeRuntime\s*\?/.test(modal));
t("browser recovery-key tests still exist (feature preserved)", has("tests/vault-recovery.spec.ts") && /recoverVaultWithRecoveryKey/.test(read("tests/vault-recovery.spec.ts")));

console.log("=== D-03: the floating bulk bar fits and clears the nav ===");
t("the bar uses the dedicated CSS class", /floating-bulk-bar/.test(bulkBar));
t("the bar no longer hard-codes bottom-8", !/bottom-8/.test(bulkBar));
t("CSS lifts the bar above the mobile nav", /bottom:\s*calc\(94px \+ var\(--safe-bottom\)\)/.test(bulkRules));
t("CSS keeps the desktop position at 32px", /@media \(min-width:\s*1024px\)[\s\S]{0,260}?bottom:\s*calc\(32px \+ var\(--safe-bottom\)\)/.test(css));
t("CSS constrains the bar to the viewport", /max-width:\s*calc\(100vw - 24px\)/.test(bulkRules));
t("CSS makes the overflow scrollable", /overflow-x:\s*auto/.test(bulkRules));
t("flex children do not shrink into unreadable text", /flex-shrink:\s*0/.test(bulkRules));
t("phone: the row wraps so Export / Delete are visible", /flex-wrap:\s*wrap/.test(bulkRules));
t("tablet/desktop: the single-row pill is preserved", /@media \(min-width:\s*640px\)[\s\S]{0,200}?flex-wrap:\s*nowrap/.test(css));
t("the mobile nav still uses z-[60] and lg:hidden", /z-\[60\]/.test(app) && /lg:hidden/.test(app));
t("the V-95 modal safe-area fix is unchanged", /\.modal-footer\s*\{[^}]*calc\(14px \+ var\(--safe-bottom\)\)/s.test(css));

console.log("=== runtime: resetVaultForForgotPassword in both runtimes ===");
const makeWindow = (native) => {
  const store = new Map();
  const calls = [];
  const w = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      key: (i) => Array.from(store.keys())[i] ?? null,
      get length() { return store.size; },
    },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  };
  if (native) {
    w.__TAURI_INTERNALS__ = {
      invoke: async (cmd, args) => {
        calls.push([cmd, args]);
        if (cmd === "reset_vault") return "local-vault.archived-1731000000.pmv";
        return null;
      },
    };
  }
  return { w, store, calls };
};

const m = await import(bundle("vault-built.mjs"));
if (typeof m.resetVaultForForgotPassword !== "function") {
  t("resetVaultForForgotPassword is exported at runtime", false, "missing from the built bundle");
} else {
  // Browser (WebCrypto/localStorage) vault.
  const browser = makeWindow(false);
  globalThis.window = browser.w;
  browser.store.set(m.VAULT_STORAGE_KEY, "{\"version\":3,\"payload\":\"sealed\"}");
  const browserArchive = await m.resetVaultForForgotPassword("user_forgot_password");
  t("browser reset returns an archive key", /^vaultzero_archived_user_forgot_password_/.test(browserArchive), browserArchive);
  t("browser reset clears the active container", browser.store.get(m.VAULT_STORAGE_KEY) === undefined);
  t("browser reset preserves the encrypted container in the archive", browser.store.get(browserArchive) === "{\"version\":3,\"payload\":\"sealed\"}");

  // Native (.pmv) vault with a mocked Tauri IPC.
  const native = makeWindow(true);
  globalThis.window = native.w;
  native.store.set("vaultzero_has_native_vault", "true");
  const nativeArchive = await m.resetVaultForForgotPassword("user_forgot_password");
  t("native reset invokes reset_vault", native.calls.some(([cmd]) => cmd === "reset_vault"), JSON.stringify(native.calls.map(([c]) => c)));
  t("native reset returns the archived file name", /local-vault\.archived-/.test(nativeArchive), nativeArchive);
  t("native reset clears the stale 'Welcome back' flag", native.store.get("vaultzero_has_native_vault") === undefined);
  t("native reset uses only native IPC commands", native.calls.length > 0 && native.calls.every(([cmd]) => cmd === "reset_vault" || cmd === "lock_vault"), JSON.stringify(native.calls.map(([c]) => c)));
}

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
