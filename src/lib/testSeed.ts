import type { VaultItem } from "./vault";

/**
 * The key the end-to-end suite seeds the vault with.
 *
 * The browser tests need a vault with known items so they can assert on
 * the interface. The application deliberately does not keep the vault in
 * `sessionStorage` — every cleartext password would live there — so the
 * tests cannot seed the vault the way they used to.
 *
 * This module provides the seam. The seed is read **only** when the
 * application runs in development or in a test build, and it only ever
 * seeds the in-memory state. It never writes a password to storage, and
 * it has no effect on a production build.
 */
export const TEST_SEED_KEY = "vaultzero_test_seed";

/**
 * Whether the test seam is available.
 *
 * `import.meta.env.DEV` is true for the development server and for a
 * build started with `--mode test`. A production build has it false, so
 * the seed is ignored entirely.
 */
export function testSeedEnabled(): boolean {
  try {
    return import.meta.env.DEV || import.meta.env.MODE === "test";
  } catch {
    return false;
  }
}

/**
 * Reads the seeded items.
 *
 * Returns an empty list when the seam is disabled, when nothing was
 * seeded, or when the seed is malformed. A malformed seed must never
 * break the application.
 */
export function readTestSeed(): VaultItem[] {
  if (!testSeedEnabled() || typeof window === "undefined") return [];

  const raw = window.sessionStorage.getItem(TEST_SEED_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is VaultItem =>
        !!item &&
        typeof item === "object" &&
        typeof (item as VaultItem).id === "string" &&
        typeof (item as VaultItem).title === "string"
    );
  } catch {
    return [];
  }
}

/**
 * Removes the seed.
 *
 * The suite calls this once the vault is open, so a later reload does not
 * silently resurrect the seeded items.
 */
export function clearTestSeed(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(TEST_SEED_KEY);
  } catch {
    // Nothing to do.
  }
}
