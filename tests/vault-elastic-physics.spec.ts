// V-58: Elastic Stretch & Rebound + Speed-Responsive Physics (E2E).
//
// The pure maths is covered by tests/harness/gesture-physics.test.mjs. These
// tests verify that the physics is actually wired into open / close / click
// surfaces, that it cleans up after itself, and that reduced motion wins.
import { test, expect, type Page } from "@playwright/test";
import { seedVault } from "./helpers/seedVault";

const ITEMS = [
  {
    id: "google", title: "Google", username: "me@example.com", password: "Nova$unrise_88!",
    url: "accounts.google.com", category: "login", brand: "google", favorite: true,
    strength: "strong", score: 4, modified: "2 min ago", tags: ["Work"], folder: "Personal",
  },
  {
    id: "github", title: "GitHub", username: "dev", password: "Gh#Secure!2026",
    url: "github.com", category: "login", brand: "github", favorite: false,
    strength: "strong", score: 4, modified: "18 min ago", tags: ["Work"], folder: "Work",
  },
];

const inspector = (page: Page) => page.getByTestId("detail-inspector");
const settleSheet = async (page: Page) => {
  await expect.poll(async () =>
    Math.abs(await inspector(page).evaluate((element) => {
      const transform = getComputedStyle(element).transform;
      return transform === "none" ? 0 : new DOMMatrix(transform).m42;
    }))
  ).toBeLessThan(1);
};

test.beforeEach(async ({ page }) => {
  await seedVault(page, ITEMS);
});

test("a held control physically stretches and springs back without residue", async ({ page }) => {
  const button = page.locator(".vault-sidebar .primary-button").first();
  const box = (await button.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 90, y + 30, { steps: 8 });
  await expect(button).toHaveAttribute("data-elastic-state", "stretch");
  const stretched = await button.evaluate((element) => element.style.scale);
  expect(stretched).toMatch(/^0?\.\d+\s+[01]\.\d+$/);

  await page.mouse.up();
  // The speed-responsive rebound must finish and leave no inline transform.
  await expect.poll(() => button.evaluate((element) => element.style.scale)).toBe("");
  expect(await button.evaluate((element) => element.getAttribute("data-elastic-state"))).toBeNull();
  expect(await button.evaluate((element) => element.getAttribute("data-press-speed"))).toBeNull();
});

test("reduced motion disables the elastic stretch entirely", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  const button = page.locator(".vault-sidebar .primary-button").first();
  const box = (await button.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 90, y + 30, { steps: 8 });
  expect(await button.evaluate((element) => element.style.scale)).toBe("");
  expect(await button.evaluate((element) => element.getAttribute("data-elastic-state"))).toBeNull();
  await page.mouse.up();
});

test("surfaces inherit a speed class and reduced motion keeps them still", async ({ page }) => {
  await page.keyboard.press("Control+Shift+Y");
  const dialog = page.getByRole("dialog", { name: "Nearby P2P Sync" });
  const surface = dialog.locator(".modal-surface");
  await expect(surface).toHaveAttribute("data-elastic", "surface");
  expect(["gentle", "balanced", "firm"]).toContain(await surface.getAttribute("data-surface-speed"));

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("a gentle partial pull rebounds; a fast pull dismisses the sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.locator('[data-item-id="google"]').getByRole("heading").click();
  await expect(inspector(page)).toHaveAttribute("data-mode", "sheet");
  await settleSheet(page);

  const handle = inspector(page).getByRole("button", { name: "Drag down to close details" });
  const box = (await handle.boundingBox())!;
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  // Gentle, short pull. Pausing before release lets the measured velocity
  // decay, so the surface rubber-bands back instead of being dismissed.
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY + 30, { steps: 6 });
  await expect(inspector(page)).toHaveAttribute("data-elastic-state", "stretch");
  await page.waitForTimeout(400);
  await page.mouse.up();

  await expect(inspector(page)).toHaveAttribute("data-last-rebound", /gentle|balanced|firm/);
  await expect(inspector(page)).toHaveCount(1);
  await settleSheet(page);
  // V-68: the position spring and the scale spring are two separate
  // animations. `settleSheet()` only waits for the position (m42) to come
  // to rest; under `workers: 2` the scale spring can still be a frame or
  // two behind (`"1.0025 0.995"`). Poll for the final cleanup instead of
  // sampling one arbitrary instant — the invariant is "no residue after
  // the rebound finishes", not "no residue at this exact millisecond".
  await expect.poll(() => inspector(page).evaluate((element) => element.style.scale)).toBe("");
  await expect.poll(() => inspector(page).getAttribute("data-elastic-state")).toBeNull();

  // Fast, long flick: momentum carries the sheet off screen.
  const box2 = (await handle.boundingBox())!;
  const x2 = box2.x + box2.width / 2;
  const y2 = box2.y + box2.height / 2;
  await page.mouse.move(x2, y2);
  await page.mouse.down();
  await page.mouse.move(x2, Math.min(y2 + 260, 820), { steps: 4 });
  await page.mouse.up();
  await expect(inspector(page)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
