import { test, expect } from "@playwright/test";

test.describe("VaultZero Architectural Hardening & Cryptographic Gate", () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before each test for clean state
    await page.goto("/?unlocked=false");
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
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
    await expect(page.getByRole("heading", { name: "Good morning, Ayaan." })).toBeVisible();

    // Exactly 1 demo account exists
    const cards = page.locator(".vault-card");
    await expect(cards).toHaveCount(1);
    await expect(page.locator(".vault-card").getByRole("heading", { name: "VaultZero Demo Account" })).toBeVisible();
  });

  test("Deleting the Demo Account leaves vault 100% empty and displays EmptyVault state", async ({ page }) => {
    // Start unlocked
    await page.goto("/?unlocked=true");
    await expect(page.getByRole("heading", { name: "Good morning, Ayaan." })).toBeVisible();

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

    // Real Handshake status defaults to Waiting
    await expect(dialog.getByText("Waiting for peer connection…")).toBeVisible();

    // Verify Clean QR code without center logo
    const qrSvg = dialog.locator("svg").first();
    await expect(qrSvg).toBeVisible();
    // Center logo image is not present inside QR
    await expect(qrSvg.locator("image")).toHaveCount(0);

    // Host info
    await expect(dialog.getByText("PIN: 729 184")).toBeVisible();

    // Switch to Scan tab
    await dialog.getByRole("button", { name: "Scan QR / Connect" }).click();
    await expect(dialog.getByPlaceholder("e.g. 192.168.1.103:1420 or 729184")).toBeVisible();
  });

  test("Panic auto-lock on Ctrl+L wipes session and returns to LockScreen", async ({ page }) => {
    await page.goto("/?unlocked=true");
    await expect(page.getByRole("heading", { name: "Good morning, Ayaan." })).toBeVisible();

    // Press Ctrl+L
    await page.keyboard.press("Control+l");

    // Immediately shows locked gate
    await expect(page.getByRole("dialog", { name: "VaultZero is locked" })).toBeVisible();
  });
});
