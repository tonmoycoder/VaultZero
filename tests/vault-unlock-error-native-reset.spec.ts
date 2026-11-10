/**
 * V-99 / D-01 + D-02 — end-to-end reproduction of the two Windows photos.
 *
 * The photos were taken from a real desktop `.pmv` vault (the beta build's
 * source is `2280e33` + V-97, i.e. the same code as `main`). A mocked
 * `__TAURI_INTERNALS__.invoke` is enough to drive the native branch in a
 * browser: it is the exact seam `src/lib/platform.ts` uses.
 *
 *   D-01  unlock_vault rejecting the password used to surface
 *         "Some of the values entered were not valid." (VALIDATION).
 *   D-02  "Forgot master password? Recover vault" opened a recovery-key form
 *         that can never work on a native vault, and "Fresh Reset" cleared
 *         only localStorage, so the app returned to "Welcome back" with the
 *         same unopenable file.
 */
import { expect, test } from "@playwright/test";

/** Install a minimal native IPC mock BEFORE the app's first module runs. */
const mockNative = (page: import("@playwright/test").Page, opts: { resettable?: boolean } = {}) =>
  page.addInitScript((resettable) => {
    const calls: string[] = [];
    let vaultExists = true;
    Object.defineProperty(window, "__vaultCalls", { value: calls, configurable: true });
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {
        invoke: async (cmd: string) => {
          calls.push(cmd);
          if (cmd === "has_vault_file") return vaultExists;
          if (cmd === "vault_file_path") return "C:\\VaultZero\\local-vault.pmv";
          if (cmd === "unlock_vault") {
            throw new Error("Authentication failed: invalid master password or corrupted key");
          }
          if (cmd === "reset_vault" && resettable) {
            vaultExists = false;
            return "local-vault.archived-1731000000000.pmv";
          }
          if (cmd === "list_entries") return [];
          return null;
        },
      },
    });
  }, opts.resettable ?? false);

test("D-01 a wrong master password reports AUTH_FAILED, not 'invalid values'", async ({ page }) => {
  await mockNative(page);
  await page.goto("/");

  await expect(page.getByText("Welcome back, Vault Owner.")).toBeVisible();
  await page.locator('input[type="password"]').first().fill("123456123456");
  await page.getByRole("button", { name: /Unlock vault/i }).click();

  await expect(page.getByText("Incorrect master password or keyfile. Nothing was changed.")).toBeVisible();
  await expect(page.getByText("Some of the values entered were not valid.")).toHaveCount(0);
  await expect(page.getByText("Welcome back, Vault Owner.")).toBeVisible(); // still locked
});

test("D-02 native recovery offers only the working archive + reset path", async ({ page }) => {
  await mockNative(page, { resettable: true });
  page.on("dialog", (d) => d.accept()); // window.confirm + alert
  await page.goto("/");

  await expect(page.getByText("Welcome back, Vault Owner.")).toBeVisible();
  await page.getByRole("button", { name: /Forgot master password/i }).click();

  // The impossible 24-character key form must not be offered on a .pmv vault.
  await expect(page.getByRole("button", { name: /24-Char Recovery Key/i })).toHaveCount(0);
  await expect(page.getByPlaceholder("VZRO-XXXX-XXXX-XXXX-XXXX-XXXX")).toHaveCount(0);
  await expect(page.getByText("Why no recovery key?")).toBeVisible();
  await expect(page.getByRole("button", { name: /Archive & Reset Vault/i })).toBeVisible();

  await page.getByRole("button", { name: /Archive & Reset Vault/i }).click();

  await expect.poll(() => page.evaluate(() => (window as unknown as { __vaultCalls: string[] }).__vaultCalls)).toContain("reset_vault");
  await expect(page.getByText("Create your VaultZero vault")).toBeVisible();
  await expect(page.getByText("Welcome back, Vault Owner.")).toHaveCount(0);
  const calls = await page.evaluate(() => (window as unknown as { __vaultCalls: string[] }).__vaultCalls);
  expect(calls.filter((c) => c === "reset_vault")).toHaveLength(1);
});
