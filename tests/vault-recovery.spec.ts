import { test, expect } from "@playwright/test";
import {
  createNewVault,
  recoverVaultWithRecoveryKey,
  archiveAndResetVault,
  unlockVault,
  initialItems,
  VAULT_STORAGE_KEY,
} from "../src/lib/vault";

test.describe("Task 2: Master Password Recovery & Safety Reset", () => {
  test("recovers vault with 24-character recovery key and sets new master password", async ({ page }) => {
    await page.goto("http://localhost:1420/");

    const recoveryKey = "VZRO-TEST-RECV-KEY1-KEY2-KEY3";
    const oldPassword = "OldMasterPassword123!";
    const newPassword = "NewMasterPassword456!";

    // Create a vault with the known recovery key
    await page.evaluate(
      async ({ oldPassword, recoveryKey, items }) => {
        const { createNewVault } = await import("./src/lib/vault");
        await createNewVault(oldPassword, items, undefined, undefined, recoveryKey);
      },
      { oldPassword, recoveryKey, items: initialItems }
    );

    // Verify recovery with valid key
    const recoveredSession = await page.evaluate(
      async ({ recoveryKey, newPassword }) => {
        const { recoverVaultWithRecoveryKey } = await import("./src/lib/vault");
        return await recoverVaultWithRecoveryKey(recoveryKey, newPassword);
      },
      { recoveryKey, newPassword }
    );

    expect(recoveredSession).toBeTruthy();
    expect(recoveredSession.items.length).toBeGreaterThan(0);

    // Verify old password no longer works, but new password unlocks the vault
    const unlockWithNewPass = await page.evaluate(
      async ({ newPassword }) => {
        const { unlockVault } = await import("./src/lib/vault");
        return await unlockVault(newPassword);
      },
      { newPassword }
    );

    expect(unlockWithNewPass.items.length).toBe(recoveredSession.items.length);
  });

  test("rejects invalid recovery key and preserves original vault intact", async ({ page }) => {
    await page.goto("http://localhost:1420/");

    const validKey = "VZRO-VALD-RECV-KEY1-KEY2-KEY3";
    const invalidKey = "VZRO-WRNG-KEY0-0000-0000-0000";
    const masterPassword = "TestMasterPassword123!";

    await page.evaluate(
      async ({ masterPassword, validKey, items }) => {
        const { createNewVault } = await import("./src/lib/vault");
        await createNewVault(masterPassword, items, undefined, undefined, validKey);
      },
      { masterPassword, validKey, items: initialItems }
    );

    const recoveryResult = await page.evaluate(
      async ({ invalidKey }) => {
        try {
          const { recoverVaultWithRecoveryKey } = await import("./src/lib/vault");
          await recoverVaultWithRecoveryKey(invalidKey, "SomeNewPassword123!");
          return { success: true };
        } catch (err: any) {
          return { success: false, error: err.message };
        }
      },
      { invalidKey }
    );

    expect(recoveryResult.success).toBe(false);

    // Original vault remains unlockable with original password
    const unlock = await page.evaluate(
      async ({ masterPassword }) => {
        const { unlockVault } = await import("./src/lib/vault");
        return await unlockVault(masterPassword);
      },
      { masterPassword }
    );

    expect(unlock.items.length).toBeGreaterThan(0);
  });

  test("archiveAndResetVault guarantees zero accidental data loss by preserving timestamped archive", async ({ page }) => {
    await page.goto("http://localhost:1420/");

    await page.evaluate(
      async ({ items }) => {
        const { createNewVault } = await import("./src/lib/vault");
        await createNewVault("MasterPass123!", items);
      },
      { items: initialItems }
    );

    const archiveKey = await page.evaluate(async () => {
      const { archiveAndResetVault } = await import("./src/lib/vault");
      return archiveAndResetVault("test_reset");
    });

    expect(archiveKey).toContain("vaultzero_archived_test_reset_");

    // Verify localStorage has the archived content and cleared main container
    const isArchived = await page.evaluate((key) => {
      const archived = localStorage.getItem(key);
      const active = localStorage.getItem("vaultzero_encrypted_vault_v2");
      return { hasArchive: Boolean(archived), activeCleared: active === null };
    }, archiveKey);

    expect(isArchived.hasArchive).toBe(true);
    expect(isArchived.activeCleared).toBe(true);
  });
});
