import type { Page } from "@playwright/test";

/**
 * The storage key the persisted vault lives under.
 *
 * It matches `src/lib/storage.ts`.
 */
export const VAULT_STORAGE_KEY = "vaultzero_encrypted_vault_v2";

/**
 * Every storage key the application writes.
 *
 * A test that leaves one of these behind changes the behaviour of
 * whichever test runs next, because the browser context is shared by the
 * whole run. A corrupted vault container makes the next test fail to
 * unlock — and the application is right to refuse it, so the failure
 * looks like a product defect in a file that never touched it.
 */
const APPLICATION_KEYS = [
  VAULT_STORAGE_KEY,
  "vaultzero_font_scale_v2",
  "vaultzero_auto_lock_minutes",
  "vaultzero-feel",
  "vaultzero_theme",
  "vaultzero_language",
  "vaultzero_breach_consent",
  "vaultzero_test_seed",
];

/**
 * Removes everything the application persisted.
 *
 * The page has to be on the origin for this to work — `localStorage` is
 * scoped to an origin — so the caller navigates first.
 */
export async function clearApplicationStorage(page: Page): Promise<void> {
  await page.evaluate((keys) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    for (const key of keys) {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    }
  }, APPLICATION_KEYS);
}

/**
 * Starts a test from a clean storage.
 *
 * The page is loaded, the storage is cleared, and the page is reloaded,
 * so the application reads the cleared storage on its next mount. Clearing
 * the storage and staying on the page would leave the running application
 * holding the vault it already had in memory.
 */
export async function startFromCleanStorage(page: Page, url = "/"): Promise<void> {
  await page.goto(url);
  await clearApplicationStorage(page);
  await page.reload();
}
