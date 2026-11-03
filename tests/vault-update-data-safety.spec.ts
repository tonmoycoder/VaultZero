// V-63: an update must never cost the user their vault. The pre-update
// snapshot is restored when the container is missing and cleared only
// after a successful unlock.
import { test, expect } from "@playwright/test";
import { seedVault } from "./helpers/seedVault";

const VAULT_KEY = "vaultzero_encrypted_vault_v2";
const BACKUP_KEY = "pre-update-backup.pmv";

test.beforeEach(async ({ page }) => {
  await seedVault(page, [{ id: "a", title: "Account", username: "u", password: "p", url: "example.com", category: "login", score: 80, modified: "Today" }]);
});

test("a missing vault container is restored from the pre-update snapshot", async ({ page }) => {
  const result = await page.evaluate(async ([vaultKey, backupKey]) => {
    window.localStorage.removeItem(vaultKey as string);
    window.localStorage.setItem(backupKey as string, '{"v":1,"ciphertext":"sealed"}');
    const updater = await import("/src/lib/updater.ts");
    const restored = updater.restorePreUpdateBackupIfNeeded();
    return { restored, value: window.localStorage.getItem(vaultKey as string) };
  }, [VAULT_KEY, BACKUP_KEY] as const);
  expect(result.restored).toBe(true);
  expect(result.value).toBe('{"v":1,"ciphertext":"sealed"}');
});

test("a healthy vault is never overwritten by a stale snapshot", async ({ page }) => {
  const result = await page.evaluate(async ([vaultKey, backupKey]) => {
    window.localStorage.setItem(vaultKey as string, '{"v":2,"ciphertext":"current"}');
    window.localStorage.setItem(backupKey as string, '{"v":1,"ciphertext":"old"}');
    const updater = await import("/src/lib/updater.ts");
    const restored = updater.restorePreUpdateBackupIfNeeded();
    return { restored, value: window.localStorage.getItem(vaultKey as string) };
  }, [VAULT_KEY, BACKUP_KEY] as const);
  expect(result.restored).toBe(false);
  expect(result.value).toBe('{"v":2,"ciphertext":"current"}');
});

test("a corrupt snapshot is rejected instead of destroying the vault", async ({ page }) => {
  const result = await page.evaluate(async ([vaultKey, backupKey]) => {
    window.localStorage.removeItem(vaultKey as string);
    window.localStorage.setItem(backupKey as string, "not-json");
    const updater = await import("/src/lib/updater.ts");
    const restored = updater.restorePreUpdateBackupIfNeeded();
    return { restored, value: window.localStorage.getItem(vaultKey as string) };
  }, [VAULT_KEY, BACKUP_KEY] as const);
  expect(result.restored).toBe(false);
  expect(result.value).toBeNull();
});

test("the snapshot survives startup and is cleared only on explicit cleanup", async ({ page }) => {
  await page.evaluate(async ([backupKey]) => {
    window.localStorage.setItem(backupKey as string, '{"v":1,"ciphertext":"sealed"}');
    const updater = await import("/src/lib/updater.ts");
    // Simulate the startup restore call without a missing container.
    updater.restorePreUpdateBackupIfNeeded();
  }, [BACKUP_KEY] as const);
  expect(await page.evaluate((k) => window.localStorage.getItem(k), BACKUP_KEY)).not.toBeNull();
  await page.evaluate(async () => {
    const updater = await import("/src/lib/updater.ts");
    updater.clearPreUpdateBackup();
  });
  expect(await page.evaluate((k) => window.localStorage.getItem(k), BACKUP_KEY)).toBeNull();
});
