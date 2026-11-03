import type { Page } from "@playwright/test";

/**
 * The key the test seam reads.
 *
 * It matches `src/lib/testSeed.ts`.
 */
export const TEST_SEED_KEY = "vaultzero_test_seed";

/**
 * Seeds the vault with the given items and opens the app.
 *
 * The application keeps the vault out of `sessionStorage` — every
 * cleartext password would live there — so the suite cannot put items
 * there and expect them back. The seam in `src/lib/testSeed.ts` reads
 * this key instead, and only in a development or test build.
 *
 * The seed only fills the in-memory state. Nothing is written to storage.
 */
export async function seedVault(page: Page, items: unknown[]): Promise<void> {
  await page.addInitScript(
    ([key, payload]) => {
      window.sessionStorage.setItem(key as string, payload as string);
    },
    [TEST_SEED_KEY, JSON.stringify(items)] as const
  );
  await page.goto("/?unlocked=true");
}

/**
 * The same as {@link seedVault}, but for a page that is already open.
 */
export async function seedVaultInPlace(page: Page, items: unknown[]): Promise<void> {
  await page.evaluate(
    ([key, payload]) => {
      window.sessionStorage.setItem(key as string, payload as string);
    },
    [TEST_SEED_KEY, JSON.stringify(items)] as const
  );
  await page.reload();
}
