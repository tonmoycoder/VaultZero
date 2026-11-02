import { test, expect } from "@playwright/test";

test.describe("VaultZero Architectural Hardening & Cryptographic Gate", () => {
  test.beforeEach(async ({ page }) => {
    /*
     * Clear the storage before each test so every test starts from the
     * factory state.
     *
     * The clear has to happen on a page that is already loaded, and the
     * page has to be reloaded afterwards. Clearing the storage and then
     * staying on the same page leaves the running application with the
     * vault it already had in memory, so the next assertion sees a vault
     * that should not exist.
     */
    await page.goto("/");
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload();
  });

  test("Cryptographic Vault Gate displays on initial launch with Setup Mode", async ({ page }) => {
    await page.goto("/");
    // Gate should be visible
    const dialog = page.getByRole("dialog", { name: "VaultZero is locked" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Create your VaultZero vault" })).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Master password", exact: true })).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Confirm master password", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Generate keyfile (.vzkey)" })).toBeVisible();
  });

  test("Password strength meter responds to complexity and confirms match", async ({ page }) => {
    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: "VaultZero is locked" });
    const pwdInput = dialog.getByRole("textbox", { name: "Master password", exact: true });
    await pwdInput.fill("weak");
    await expect(dialog.getByText("Weak")).toBeVisible();

    await pwdInput.fill("Strong$Pass2026!");
    await expect(dialog.getByText("Strong")).toBeVisible();

    // Mismatched confirm password shows error
    await dialog.getByRole("textbox", { name: "Confirm master password", exact: true }).fill("Mismatch123!");
    await dialog.getByRole("button", { name: "Create local vault" }).click();
    await expect(dialog.getByText("Passwords do not match.")).toBeVisible();
  });

  test("Generate Keyfile (.vzkey) downloads 32-byte CSPRNG keyfile and attaches badge", async ({ page }) => {
    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: "VaultZero is locked" });
    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Generate keyfile (.vzkey)" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("vaultzero.vzkey");

    // Keyfile badge displayed
    await expect(dialog.getByText("Keyfile attached: vaultzero.vzkey (32-bytes CSPRNG)")).toBeVisible();
  });

  test("Creating a vault unlocks into dashboard with exactly 1 deletable Demo Account", async ({ page }) => {
    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: "VaultZero is locked" });
    await dialog.getByRole("textbox", { name: "Master password", exact: true }).fill("MasterPass2026!");
    await dialog.getByRole("textbox", { name: "Confirm master password", exact: true }).fill("MasterPass2026!");
    await dialog.getByRole("button", { name: "Create local vault" }).click();

    // Should arrive at main vault dashboard
    await expect(page.getByRole("heading", { name: /Good morning/i })).toBeVisible();

    // Exactly 1 demo account exists
    const cards = page.locator(".vault-card");
    await expect(cards).toHaveCount(1);
    await expect(page.locator(".vault-card").getByRole("heading", { name: "VaultZero Demo Account" })).toBeVisible();
  });

  test("Deleting the Demo Account leaves vault 100% empty and displays EmptyVault state", async ({ page }) => {
    // Start unlocked
    await page.goto("/?unlocked=true");
    await expect(page.getByRole("heading", { name: /Good morning/i })).toBeVisible();

    // Find the demo card
    const demoCard = page.locator('[data-item-id="demo-account"]');
    await expect(demoCard).toBeVisible();

    // Delete item from card quick actions
    const deleteBtn = demoCard.getByRole("button", { name: "Delete item" });
    await deleteBtn.click();

    // Should now show 0 cards and empty vault view
    await expect(page.locator(".vault-card")).toHaveCount(0);
    await expect(page.getByText("Your vault is empty")).toBeVisible();
    await expect(page.getByText("Zero secrets stored.")).toBeVisible();
  });

  test("Multi-select checkboxes trigger Floating Bulk Actions Bar", async ({ page }) => {
    await page.goto("/?unlocked=true");
    await expect(page.locator(".vault-card").getByRole("heading", { name: "VaultZero Demo Account" })).toBeVisible();

    // Select the demo card checkbox
    const checkbox = page.locator('[data-item-id="demo-account"]').getByRole("checkbox");
    await checkbox.click({ force: true });

    // Floating bulk bar appears
    await expect(page.getByRole("button", { name: "Delete selected" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Toggle favorite" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export selected" })).toBeVisible();
  });

  test("Inspector exhibits Password History time-machine with restore capability", async ({ page }) => {
    await page.goto("/?unlocked=true");
    // Click demo card to open inspector
    await page.locator('[data-item-id="demo-account"]').click();
    await expect(page.getByTestId("detail-inspector")).toBeVisible();

    // Inspect Password History section
    await expect(page.getByText("Password history")).toBeVisible();
    await expect(page.getByRole("button", { name: "Restore" })).toBeVisible();

    // Restore previous password
    await page.getByRole("button", { name: "Restore" }).first().click();
    await expect(page.getByText("Previous password restored")).toBeVisible();
  });

  test("Nearby P2P Sync modal has clean QR (no center logo) and Waiting status", async ({ page }) => {
    await page.goto("/?unlocked=true");
    await page.keyboard.press("Control+Shift+Y");

    const dialog = page.getByRole("dialog", { name: "Nearby P2P Sync" });
    await expect(dialog).toBeVisible();

    /*
     * V-17: the status is "Waiting for peer **selection**", not
     * "connection". A scanned QR selects a peer; the authenticated
     * handshake only succeeds when the transfer actually runs, so the
     * interface must not claim a connection that does not exist.
     */
    await expect(dialog.getByText("Waiting for peer selection…")).toBeVisible();

    // Verify Clean QR code without center logo
    const qrSvg = dialog.locator("svg").first();
    await expect(qrSvg).toBeVisible();
    // Center logo image is not present inside QR
    await expect(qrSvg.locator("image")).toHaveCount(0);

    /*
     * Host info.
     *
     * The pairing PIN is generated with a CSPRNG on every launch and is
     * never hard-coded, so the assertion is on the shape of the value
     * rather than on one particular number.
     *
     * The PIN is rendered inside the copy button, so the text node also
     * holds the copy glyph and cannot be matched on its own.
     */
    const pin = await dialog
      .getByRole("button", { name: "Copy pairing PIN" })
      .innerText();
    expect(pin).toMatch(/PIN:\s*\d{3}\s*\d{3}/);

    // Switch to Scan tab
    await dialog.getByRole("button", { name: "Scan QR / Connect" }).click();
    /*
     * The manual field accepts either the host address or the pairing PIN.
     * The example PIN is a shape, not a value — the real code is random on
     * every launch, so no particular number can be asserted.
     */
    await expect(dialog.getByPlaceholder(/192\.168\.1\.103:1420 or \d{6}/)).toBeVisible();
  });

  test("Panic auto-lock on Ctrl+L wipes session and returns to LockScreen", async ({ page }) => {
    await page.goto("/?unlocked=true");
    await expect(page.getByRole("heading", { name: /Good morning/i })).toBeVisible();

    // Press Ctrl+L
    await page.keyboard.press("Control+l");

    // Immediately shows locked gate
    await expect(page.getByRole("dialog", { name: "VaultZero is locked" })).toBeVisible();
  });
});
