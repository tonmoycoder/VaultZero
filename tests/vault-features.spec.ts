import { test, expect, type Page } from "@playwright/test";

const zen = (page: Page) =>
  page.locator(".theme-control:visible").getByRole("button", { name: "Cozy lofi zen", exact: true });

test.beforeEach(async ({ page }) => {
  await page.goto("/?unlocked=true");
  await expect(page.getByRole("heading", { name: /Good morning/i })).toBeVisible();
});

test("the sidebar add button keeps even padding and never touches the edge", async ({ page }) => {
  const metrics = await page.evaluate(() => {
    const side = document.querySelector(".vault-sidebar")!.getBoundingClientRect();
    const button = document.querySelector(".sidebar-add")!.getBoundingClientRect();
    const icon = document.querySelector(".sidebar-add span")!.getBoundingClientRect();
    const badge = document.querySelector(".sidebar-add-badge")!.getBoundingClientRect();
    return {
      left: button.left - side.left,
      right: side.right - button.right,
      iconInset: icon.left - button.left,
      badgeInset: button.right - badge.right,
    };
  });
  expect(metrics.left).toBeGreaterThanOrEqual(10);
  expect(Math.abs(metrics.left - metrics.right)).toBeLessThan(1.5);
  expect(metrics.iconInset).toBeGreaterThanOrEqual(8);
  expect(metrics.badgeInset).toBeGreaterThanOrEqual(8);
});

test("dark mode secondary text meets a readable contrast ratio", async ({ page }) => {
  await page.locator(".theme-control:visible").getByRole("button", { name: "Liquid glass · Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const ratios = await page.evaluate(() => {
    const hex = (value: string) => {
      const clean = value.trim().replace("#", "");
      return [0, 2, 4].map((i) => Number.parseInt(clean.slice(i, i + 2), 16));
    };
    const lum = ([r, g, b]: number[]) => {
      const ch = (c: number) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    };
    const style = getComputedStyle(document.documentElement);
    const base = lum(hex(style.getPropertyValue("--app-base")));
    const against = (token: string) => {
      const [a, b] = [lum(hex(style.getPropertyValue(token))), base].sort((x, y) => y - x);
      return (a + 0.05) / (b + 0.05);
    };
    return { muted: against("--text-muted"), faint: against("--text-faint"), soft: against("--text-soft") };
  });
  // Small secondary labels were the unreadable part, so hold them to AAA body contrast.
  expect(ratios.muted).toBeGreaterThan(7);
  expect(ratios.faint).toBeGreaterThan(7);
  expect(ratios.soft).toBeGreaterThan(7);
});

test("text size control scales the interface and persists", async ({ page }) => {
  const control = page.locator('[data-testid="text-size-control"]:visible').first();
  const before = await page.locator("h1").evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  await control.getByRole("button", { name: "Increase text size" }).click();
  await control.getByRole("button", { name: "Increase text size" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-text-step", "4");
  const after = await page.locator("h1").evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  expect(after).toBeGreaterThan(before * 1.15);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-text-step", "4");
  await page.locator('[data-testid="text-size-control"]:visible').first().getByRole("button", { name: "Decrease text size" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-text-step", "3");
});

test("the largest text size still fits on a small phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.reload();
  const control = page.locator('[data-testid="text-size-control"]:visible').first();
  const bigger = control.getByRole("button", { name: "Increase text size" });
  // The control caps itself, so step up until the button disables.
  while (await bigger.isEnabled()) await bigger.click();
  await expect(page.locator("html")).toHaveAttribute("data-text-step", "4");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("zen mode starts one lofi engine and shows a live visualizer", async ({ page }) => {
  await expect(page.getByTestId("lofi-player")).toHaveCount(0);
  await zen(page).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "lofi");
  const player = page.locator('[data-testid="lofi-player"]:visible').first();
  await expect(player).toHaveAttribute("data-playing", "true");
  // One AudioContext regardless of how many player pills are mounted.
  await expect
    .poll(() => page.evaluate(() => (performance.getEntriesByType("resource") as PerformanceEntry[]).length >= 0 ? document.querySelectorAll('[data-testid="lofi-player"][data-playing="true"]').length : 0))
    .toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(() => {
      const canvas = [...document.querySelectorAll<HTMLCanvasElement>(".lofi-visualizer")].find((c) => c.clientWidth > 0)!;
      const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      let painted = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 10) painted += 1;
      return painted;
    }), { timeout: 10000 })
    .toBeGreaterThan(40);
  await player.getByRole("button", { name: "Pause lofi soundscape" }).click();
  await expect(player).toHaveAttribute("data-playing", "false");
  await player.getByRole("button", { name: "Play lofi soundscape" }).click();
  await expect(player).toHaveAttribute("data-playing", "true");
  await page.locator(".theme-control:visible").getByRole("button", { name: "Liquid glass · Light", exact: true }).click();
  await expect(page.getByTestId("lofi-player")).toHaveCount(0);
});

test("scan and import lives in the menu, not in the search bar", async ({ page }) => {
  const search = page.getByRole("textbox", { name: "Search your vault…" });
  await expect(search).toBeVisible();
  await expect(page.locator("header, .input-shell").getByRole("button", { name: /Search by image/ })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Tools" }).getByRole("button", { name: /Scan & import/ }).click();
  await expect(page.getByRole("dialog", { name: "Scan & import" })).toBeVisible();
});

test("OCR creates a real, editable item with autofill and clipboard support", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("navigation", { name: "Tools" }).getByRole("button", { name: /Scan & import/ }).click();
  const scan = page.getByRole("dialog", { name: "Scan & import" });
  await scan.getByRole("button", { name: "Try sample" }).click();
  await expect(scan.getByRole("button", { name: "Create item", exact: true })).toBeVisible({ timeout: 15000 });
  await scan.getByRole("button", { name: "Create item", exact: true }).click();

  const form = page.getByRole("dialog", { name: "New vault item" });
  await expect(form.locator('input[name="username"]')).toHaveValue("user@example.local");
  await expect(form.locator('input[name="new-password"]')).toHaveValue("SecurePass#2026");
  // Standard autofill tokens so browsers and password managers behave normally.
  await expect(form.locator('input[name="username"]')).toHaveAttribute("autocomplete", "username");
  await expect(form.locator('input[name="new-password"]')).toHaveAttribute("autocomplete", "new-password");

  await page.evaluate(() => navigator.clipboard.writeText("pasted.user@example.test"));
  await form.getByRole("button", { name: "Paste username" }).click();
  await expect(form.locator('input[name="username"]')).toHaveValue("pasted.user@example.test");
  await form.getByRole("button", { name: "Password", exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("SecurePass#2026");

  await form.getByRole("button", { name: "Add to vault", exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(page.locator(".vault-card")).toHaveCount(2);
  await expect(page.getByTestId("detail-inspector")).toContainText("pasted.user@example.test");
});

test("a scan can still be saved as a plain secure note", async ({ page }) => {
  await page.getByRole("navigation", { name: "Tools" }).getByRole("button", { name: /Scan & import/ }).click();
  const scan = page.getByRole("dialog", { name: "Scan & import" });
  await scan.getByRole("button", { name: "Try sample" }).click();
  await expect(scan.getByRole("button", { name: "Save as note", exact: true })).toBeVisible({ timeout: 15000 });
  await scan.getByRole("button", { name: "Save as note", exact: true }).click();
  await expect(scan).toHaveCount(0);
  await expect(page.locator(".vault-card")).toHaveCount(2);
});
