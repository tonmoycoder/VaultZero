/**
 * Batch 1 / V-90 — first-run vault creation & Setup-vs-Unlock detection.
 *
 * Reproduces the two live-screenshot defects:
 *   IMG_20261107_110608.jpg      -> "Failed to create vault." with aA2525@ on PC
 *   Screenshot_...02-10-31.jpg   -> "Welcome back, Vault Owner." on a fresh install
 *
 * The external local fix (ebe805e) already repaired the native Entry shape,
 * the async `has_vault_file` probe and the safe error message. These tests
 * GUARD that work and expose the one direction the async probe still got
 * wrong: a stale `vaultzero_has_native_vault` flag kept the app on the
 * Unlock screen even when the .pmv file was gone.
 */
import { expect, test, type Page } from "@playwright/test";

const SETUP = /Create your VaultZero vault/i;
const WELCOME = /Welcome back/i;
const NATIVE_FLAG = "vaultzero_has_native_vault";
const BROWSER_VAULT = "vaultzero_encrypted_vault_v2";

/** Simulate the Tauri runtime: `isNativeRuntime()` only needs the marker. */
async function stubNative(page: Page, hasVaultFile: boolean, staleFlag: boolean) {
  await page.addInitScript(
    ({ exists, stale }) => {
      const w = window as unknown as {
        __TAURI_INTERNALS__: { invoke: (cmd: string) => Promise<unknown> };
        localStorage: Storage;
      };
      w.__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => (cmd === "has_vault_file" ? exists : undefined),
      };
      w.localStorage.removeItem("vaultzero_encrypted_vault_v2");
      if (stale) w.localStorage.setItem("vaultzero_has_native_vault", "true");
      else w.localStorage.removeItem("vaultzero_has_native_vault");
    },
    { exists: hasVaultFile, stale: staleFlag },
  );
}

async function freshBrowser(page: Page) {
  // Deliberately NOT an addInitScript: that would re-run on page.reload()
  // and wipe the vault container B-02 needs to prove a returning user.
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.removeItem("vaultzero_encrypted_vault_v2");
    window.localStorage.removeItem("vaultzero_has_native_vault");
  });
  await page.reload();
}

async function createVault(page: Page, password: string) {
  const dialog = page.locator('[role="dialog"][aria-modal="true"]');
  await dialog.getByRole("textbox", { name: "Master password", exact: true }).fill(password);
  await dialog.getByRole("textbox", { name: "Confirm master password", exact: true }).fill(password);
  // Duress decoy and .vzkey keyfile are OPTIONAL and stay empty on purpose.
  await dialog.getByRole("button", { name: "Create local vault" }).click();
  await expect(page.getByText(/Failed to create vault|ভল্ট তৈরিতে সমস্যা/i)).toHaveCount(0);
  await expect(dialog).toHaveCount(0, { timeout: 20000 });
}

test("B-01 a fresh PC install creates a vault with aA2525@, empty duress and no keyfile", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await freshBrowser(page);
  await expect(page.getByRole("heading", { name: SETUP })).toBeVisible();
  await expect(page.getByText(WELCOME)).toHaveCount(0);
  await createVault(page, "aA2525@");
  // The container really exists; not a fake success toast.
  const stored = await page.evaluate((key) => Boolean(localStorage.getItem(key)), BROWSER_VAULT);
  expect(stored).toBe(true);
});

test("B-02 a returning user (vault present after an app update) sees Welcome back", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await freshBrowser(page);
  await createVault(page, "MasterPass2026!");
  await page.reload();
  await expect(page.getByText(WELCOME)).toBeVisible();
  await expect(page.getByRole("heading", { name: SETUP })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /unlock vault/i })).toBeVisible();
});

test("B-03 native .pmv present but no localStorage flag still shows Welcome back", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubNative(page, true, false);
  await page.goto("/");
  await expect(page.getByText(WELCOME)).toBeVisible();
  await expect(page.getByRole("heading", { name: SETUP })).toHaveCount(0);
});

test("B-04 a stale native flag with NO .pmv file must fall back to SETUP", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubNative(page, false, true);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: SETUP })).toBeVisible();
  await expect(page.getByText(WELCOME)).toHaveCount(0);
  const flag = await page.evaluate((key) => localStorage.getItem(key), NATIVE_FLAG);
  expect(flag, "the stale flag must be cleared when the vault file is gone").toBeNull();
});

test("B-05 a browser launch must ignore a leftover native-only flag", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    window.localStorage.removeItem("vaultzero_encrypted_vault_v2");
    window.localStorage.setItem("vaultzero_has_native_vault", "true");
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: SETUP })).toBeVisible();
  await expect(page.getByText(WELCOME)).toHaveCount(0);
});
