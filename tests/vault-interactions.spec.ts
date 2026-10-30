import { test, expect, type Page } from "@playwright/test";

const inspector = (page: Page) => page.getByTestId("detail-inspector");
const card = (page: Page, id: string) => page.locator(`[data-item-id="${id}"]`);
const openItem = async (page: Page, id: string) => {
  await card(page, id).getByRole("heading").click();
  await expect(inspector(page)).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Good morning, Ayaan." })).toBeVisible();
});

for (const width of [1440, 1366, 1280]) {
  test(`opens, switches and reopens a docked inspector at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openItem(page, "github");
    await expect(inspector(page)).toHaveAttribute("data-mode", "panel");
    await expect(inspector(page).getByRole("heading", { name: "GitHub", exact: true })).toBeVisible();
    await expect(inspector(page).locator(".inspector-field-value").first()).toHaveText("ayaan-dev");
    await inspector(page).getByRole("button", { name: "Reveal", exact: true }).click();
    await expect(inspector(page)).toContainText("Gh#Secure!2026");
    await openItem(page, "google");
    await expect(inspector(page).getByRole("heading", { name: "Google", exact: true })).toBeVisible();
    await expect(inspector(page).getByRole("button", { name: "Reveal", exact: true })).toBeVisible();
    await expect(inspector(page)).not.toContainText("Nova$unrise_88!");
    await inspector(page).getByRole("button", { name: "Close inspector", exact: true }).click();
    await expect(inspector(page)).toHaveCount(0);
    await expect(card(page, "google")).toHaveAttribute("aria-expanded", "false");
    await openItem(page, "figma");
    await expect(inspector(page).getByRole("heading", { name: "Figma", exact: true })).toBeVisible();
    await expect.poll(async () => (await inspector(page).boundingBox())!.x).toBeGreaterThan(width - 400);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}

for (const width of [1180, 1024, 900, 768]) {
  test(`right drawer is visible and dismissible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await page.reload();
    await expect(inspector(page)).toHaveCount(0);
    await openItem(page, "github");
    await expect(inspector(page)).toHaveAttribute("data-mode", "drawer");
    await expect(inspector(page).getByRole("heading", { name: "GitHub", exact: true })).toBeVisible();
    await expect.poll(async () => (await inspector(page).boundingBox())!.x).toBeGreaterThan(width - 410);
    await page.keyboard.press("Escape");
    await expect(inspector(page)).toHaveCount(0);
    await openItem(page, "apple");
    await page.locator(".inspector-scrim").click({ position: { x: 20, y: 100 } });
    await expect(inspector(page)).toHaveCount(0);
  });
}

for (const width of [390, 320]) {
  test(`mobile ${width}px uses a scrollable, swipe-dismissable sheet`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.reload();
    await expect(inspector(page)).toHaveCount(0);
    await openItem(page, "google");
    await expect(inspector(page)).toHaveAttribute("data-mode", "sheet");
    await expect(inspector(page).getByRole("heading", { name: "Google", exact: true })).toBeVisible();
    const scroll = inspector(page).locator(".inspector-body");
    await scroll.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(inspector(page).getByText("Last edited", { exact: true })).toBeVisible();
    const handle = inspector(page).getByRole("button", { name: "Drag down to close details" });
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 250, { steps: 14 });
    await page.mouse.up();
    await expect(inspector(page)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}

test("inspector survives resizing without duplicate panels", async ({ page }) => {
  await openItem(page, "github");
  for (const [width, mode] of [[1180, "drawer"], [390, "sheet"], [1440, "panel"]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await expect(inspector(page)).toHaveCount(1);
    await expect(inspector(page)).toHaveAttribute("data-mode", mode);
    await expect(inspector(page).getByRole("heading", { name: "GitHub", exact: true })).toBeVisible();
  }
});

test("brand rail supports wheel, arrows, filtering and keyboard navigation", async ({ page }) => {
  const rail = page.getByTestId("brand-scroll");
  await rail.hover();
  await page.mouse.wheel(0, 300);
  await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(80);
  await page.getByRole("button", { name: "Scroll brands right" }).click();
  await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(300);
  await page.getByRole("button", { name: "Scroll brands left" }).click();
  await page.getByRole("button", { name: "Filter by Figma", exact: true }).click();
  await expect(page.locator(".vault-card")).toHaveCount(1);
  await expect(card(page, "figma")).toBeVisible();
  await expect(page.getByRole("button", { name: "Filter by Figma", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Filter by All", exact: true }).click();
  await expect(page.locator(".vault-card")).toHaveCount(11);
  await page.getByRole("button", { name: "Filter by All", exact: true }).focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("button", { name: "Filter by Spotify", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".vault-card")).toHaveCount(1);
  await expect(card(page, "spotify")).toBeVisible();
});

test("dragging the brand rail never accidentally selects a brand", async ({ page }) => {
  const rail = page.getByTestId("brand-scroll");
  const box = (await rail.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.7, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7 - 190, box.y + 20, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(100);
  await expect(page.getByRole("button", { name: "Filter by All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".vault-card")).toHaveCount(11);
});

test("native touch swiping moves the brand rail", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5173");
  const rail = page.getByTestId("brand-scroll");
  const box = (await rail.boundingBox())!;
  const session = await context.newCDPSession(page);
  const x = box.x + box.width - 20;
  const y = box.y + 20;
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= 8; i++) {
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - i * 24, y }] });
    await page.waitForTimeout(20);
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(80);
  await context.close();
});

test("glass selection follows theme and sidebar buttons", async ({ page }) => {
  const theme = page.locator(".theme-control:visible");
  const before = (await theme.locator('[data-glass-indicator="selected"]').boundingBox())!;
  await theme.getByRole("button", { name: "Liquid glass · Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect.poll(async () => (await theme.locator('[data-glass-indicator="selected"]').boundingBox())!.x).toBeGreaterThan(before.x + 20);
  await page.getByRole("navigation", { name: "Vault navigation" }).getByRole("button", { name: /^Favorites/ }).click();
  const favorites = page.getByRole("navigation", { name: "Vault navigation" }).getByRole("button", { name: /^Favorites/ });
  await expect(favorites).toHaveAttribute("aria-current", "page");
  await expect(favorites.locator('[data-glass-indicator="selected"]')).toBeVisible();
  await theme.getByRole("button", { name: "Cozy lofi zen", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "lofi");
  await expect(page.locator(".ambient-lofi")).toBeVisible();
  await expect(page.locator(".zen-waves")).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "lofi");
});

test("press physics spring back and honor reduced motion", async ({ page }) => {
  const button = page.locator(".theme-control:visible").getByRole("button", { name: "Liquid glass · Dark", exact: true });
  await button.hover();
  await page.mouse.down();
  await expect.poll(() => button.evaluate((element) => Number.parseFloat(getComputedStyle(element).scale) || 1)).toBeLessThan(0.98);
  await page.mouse.up();
  await expect.poll(() => button.evaluate((element) => element.style.scale)).toBe("");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await button.hover();
  await page.mouse.down();
  expect(await button.evaluate((element) => element.style.scale)).toBe("");
  await page.mouse.up();
});

test("individual security details and recovery codes open correctly", async ({ page }) => {
  await openItem(page, "google");
  const panel = inspector(page);
  await panel.getByRole("button", { name: "Reveal recovery codes", exact: true }).click();
  await expect(panel).toContainText("GX7Q-4H2M-91LA");
  await panel.getByRole("button", { name: "View password security details" }).click();
  await expect(panel.getByRole("heading", { name: "Password checkup" })).toBeVisible();
  await expect(panel).toContainText("At least 12 characters");
  await panel.getByRole("tab", { name: "Item details", exact: true }).click();
  await expect(panel).not.toContainText("GX7Q-4H2M-91LA");
});

test("security report drills into real filtered items and animates out", async ({ page }) => {
  await page.locator("main").getByRole("button", { name: "Open security center", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Security center", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Review weak items", exact: true }).click();
  await expect(dialog.locator(".security-report-row")).toHaveCount(2);
  await dialog.getByRole("button", { name: "How is this score calculated?", exact: true }).click();
  await expect(dialog.locator("#score-method")).toBeVisible();
  await expect(dialog.locator("#score-method")).toContainText("76%");
  await dialog.getByRole("button", { name: "Inspect Dropbox", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(inspector(page).getByRole("heading", { name: "Dropbox", exact: true })).toBeVisible();
});

test("editing from inspector updates the item without duplicating it", async ({ page }) => {
  await openItem(page, "google");
  await inspector(page).getByRole("button", { name: "Edit this item" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit vault item" });
  await dialog.getByPlaceholder("e.g. Google").fill("Google Work");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(inspector(page).getByRole("heading", { name: "Google Work", exact: true })).toBeVisible();
  await expect(page.locator(".vault-card")).toHaveCount(11);
});

test("copy action does not trigger parent card; keyboard selection opens details", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await inspector(page).getByRole("button", { name: "Close inspector" }).click();
  await expect(inspector(page)).toHaveCount(0);
  const github = card(page, "github");
  await github.getByRole("button", { name: "Password", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(inspector(page)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("Gh#Secure!2026");
  await github.focus();
  await page.keyboard.press("Enter");
  await expect(inspector(page).getByRole("heading", { name: "GitHub", exact: true })).toBeVisible();
});

test("modal exits finish before removal and keyboard focus is restored", async ({ page }) => {
  const trigger = page.getByRole("navigation", { name: "Tools" }).getByRole("button", { name: "Password generator", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Password generator", exact: true });
  await expect(dialog).toBeVisible();
  const stillMounted = await dialog.getByRole("button", { name: "Close dialog" }).evaluate((button) => {
    button.click();
    return Boolean(document.querySelector('[role="dialog"]'));
  });
  expect(stillMounted).toBe(true);
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("command palette opens a selected item at laptop size", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.reload();
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "VaultZero command palette" });
  await dialog.getByRole("textbox", { name: "Command palette search" }).fill("GitHub");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(inspector(page)).toHaveAttribute("data-mode", "drawer");
  await expect(inspector(page).getByRole("heading", { name: "GitHub", exact: true })).toBeVisible();
});

test("motion preferences disable physical effects and persist", async ({ page }) => {
  await page.getByRole("button", { name: "Vault preferences", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Quick access", exact: true });
  const control = dialog.getByRole("switch", { name: "Springy press physics" });
  await control.click();
  await expect(control).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
});

test("an empty add form gives useful validation and can save an item", async ({ page }) => {
  await page.locator(".vault-sidebar .primary-button").click();
  const dialog = page.getByRole("dialog", { name: "New vault item" });
  await dialog.getByRole("button", { name: "Add to vault", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Give this item a name.");
  await dialog.getByPlaceholder("e.g. Google").fill("Example account");
  await dialog.getByPlaceholder("name@example.com").fill("demo@example.test");
  await dialog.getByRole("checkbox", { name: "Favorite", exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Add to vault", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(inspector(page).getByRole("heading", { name: "Example account", exact: true })).toBeVisible();
  await expect(page.locator(".vault-card")).toHaveCount(12);
});

test("opening a tool from the mobile inspector returns to that inspector", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await openItem(page, "google");
  await inspector(page).getByRole("button", { name: "View password security details" }).click();
  await inspector(page).getByRole("button", { name: "Generate a stronger password", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Password generator", exact: true });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(inspector(page)).toBeVisible();
  await expect(inspector(page).getByRole("heading", { name: "Password checkup", exact: true })).toBeVisible();
});

test("the original card hover spotlight and lift are preserved", async ({ page }) => {
  const item = card(page, "google");
  await item.hover({ position: { x: 70, y: 60 } });
  await expect.poll(() => item.evaluate((element) => element.style.getPropertyValue("--mx"))).not.toBe("");
  await expect.poll(() => item.locator(".card-spotlight").evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0.9);
  await expect.poll(() => item.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m42)).toBeLessThan(-2);
});

test("the tablet inspector contains keyboard focus without trapping the closed page", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 820 });
  await page.reload();
  await openItem(page, "google");
  await page.keyboard.press("Shift+Tab");
  expect(await inspector(page).evaluate((element) => element.contains(document.activeElement))).toBe(true);
  for (let index = 0; index < 14; index++) await page.keyboard.press("Tab");
  expect(await inspector(page).evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(inspector(page)).toHaveCount(0);
  await expect(page.locator(".vault-shell")).not.toHaveAttribute("inert", "");
});