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

  /*
   * The storage is cleared before the vault is opened.
   *
   * The browser context is shared by the whole run, so a vault container
   * that a previous test left behind — a tampered one, a legacy one, or
   * an unlocked session — would still be in storage when this test opens
   * the application. The application would correctly refuse a damaged
   * container and show the lock screen, and the failure would look like a
   * defect in this file rather than in the one that left the state
   * behind.
   *
   * The page is loaded first, because `localStorage` is scoped to an
   * origin and cannot be touched before the application is on it.
   */
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.goto("/?unlocked=true");

  /*
   * The pending lock is settled.
   *
   * The application locks the vault when the window loses focus, after a
   * grace period, and when the document becomes hidden. A page that is
   * reloaded or navigated away from does both, and the timer that starts
   * then can fire long after the next test has begun. The next test
   * would then find a locked vault, and the failure would look like a
   * defect in whichever file happened to run next.
   *
   * Bringing the page back into focus and making it visible again
   * settles the state: the vault is unlocked and the pending lock is
   * cancelled.
   */
  await settleLockState(page);
}

/**
 * Cancels a pending auto-lock and makes sure the vault is open.
 *
 * The application locks the vault when the document is hidden and when
 * the window loses focus. A test run navigates and reloads, which does
 * both, so a lock can be scheduled by one test and land in the middle of
 * the next one.
 */
export async function settleLockState(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
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
