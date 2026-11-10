/**
 * V-99 / D-03 — the floating bulk-action bar was clipped on Windows.
 *
 * Measured in real headless Chromium BEFORE the fix (one item selected):
 *   700x1000 : bar 23..677 / 922..968, nav 932..990  -> 36px OVERLAP
 *   390x844  : bar -132..522 / 766..812, nav 776..834 -> clipped BOTH sides,
 *              "Delete selected" right=476 (>390), 36px OVERLAP
 *   1440x900 : nav display:none, bar 373..1067 -> fine
 *
 * Root cause: `FloatingBulkBar` was `fixed bottom-8` with an unconstrained
 * 654px `flex` row at `z-[70]`, while the mobile nav is `z-[60]` at the same
 * bottom. The earlier bounding audit only covered 360x800 and 1440x900 and
 * never selected an item, so neither defect was visible to the suite.
 */
import { expect, test, type Page } from "@playwright/test";

type Viewport = { width: number; height: number };
type Box = { x: number; y: number; right: number; bottom: number; w: number; h: number };

const VPS: Viewport[] = [
  { width: 700, height: 1000 },
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];

const inBounds = (b: Box, vp: Viewport) =>
  b.x >= -1 && b.right <= vp.width + 1 && b.bottom <= vp.height + 1 && b.w > 0 && b.h > 0;

const measure = (page: Page) => page.evaluate(() => {
  const r = (el: Element | null): Box | null => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return {
      x: Math.round(b.x), y: Math.round(b.y),
      right: Math.round(b.right), bottom: Math.round(b.bottom),
      w: Math.round(b.width), h: Math.round(b.height),
    };
  };
  const nav = document.querySelector('nav[aria-label="Mobile navigation"]');
  const bulk = [...document.querySelectorAll("div")].find((e) =>
    typeof e.className === "string" && e.className.includes("z-[70]") && e.className.includes("fixed")
  ) as HTMLElement | undefined;
  const del = [...document.querySelectorAll("button")].find((b) =>
    /delete selected/i.test(b.textContent || "")
  ) ?? null;
  return {
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
    nav: r(nav),
    navDisplay: nav ? getComputedStyle(nav).display : "absent",
    bulk: r(bulk ?? null),
    bulkBottomCss: bulk ? getComputedStyle(bulk).bottom : "",
    bulkScrollWidth: bulk?.scrollWidth ?? -1,
    bulkClientWidth: bulk?.clientWidth ?? -1,
    del: r(del),
    safeBottom: getComputedStyle(document.documentElement).getPropertyValue("--safe-bottom").trim(),
  };
});

const selectFirstItem = async (page: Page) => {
  const card = page.locator('[role="button"]').filter({ hasText: "VaultZero Demo Account" }).first();
  await card.hover();
  await card.getByRole("checkbox").first().click({ force: true });
  await page.waitForFunction(() =>
    [...document.querySelectorAll("div")].some((e) =>
      typeof e.className === "string" && e.className.includes("z-[70]") && e.className.includes("fixed")
    )
  );
  await page.waitForTimeout(350); // let the framer-motion enter transition settle
};

for (const vp of VPS) {
  test(`D-03 bulk bar fits and clears the nav at ${vp.width}x${vp.height}`, async ({ page }) => {
    // Positive control: the detector must reject the exact RED measurement.
    expect(inBounds({ x: -132, y: 766, right: 522, bottom: 812, w: 654, h: 46 }, { width: 390, height: 844 }),
      "detector rejects the measured clipped bar").toBe(false);
    expect(inBounds({ x: 12, y: 700, right: 378, bottom: 746, w: 366, h: 46 }, { width: 390, height: 844 }),
      "detector accepts a viewport-constrained bar").toBe(true);

    await page.setViewportSize(vp);
    await page.goto("/?unlocked=true");
    await selectFirstItem(page);
    const m = await measure(page);

    expect(m.bulk, "bulk bar is rendered").not.toBeNull();
    const bulk = m.bulk!;
    expect(inBounds(bulk, vp), `bulk bar in bounds at ${vp.width}px: ${JSON.stringify(bulk)}`).toBe(true);
    expect(m.sw, "no page-level horizontal scroll").toBeLessThanOrEqual(m.cw);

    if (m.navDisplay !== "none" && m.nav && m.nav.w > 0) {
      expect(bulk.bottom, `bulk bar must sit ABOVE the nav at ${vp.width}px`).toBeLessThanOrEqual(m.nav.y);
      expect(m.bulkBottomCss, "mobile offset honours --safe-bottom").toBe("94px");
    } else {
      expect(m.navDisplay, "desktop nav is hidden at >=1024px").toBe("none");
      expect(m.bulkBottomCss, "desktop offset stays 32px").toBe("32px");
    }

    // The phone wraps the row, so the destructive action must be VISIBLE
    // before any scrolling — a hidden horizontal scrollbar is not a fix.
    const beforeScroll = await page.evaluate(() => {
      const el = [...document.querySelectorAll("div")].find((e) =>
        typeof e.className === "string" && e.className.includes("floating-bulk-bar")
      ) as HTMLElement | undefined;
      if (!el) return { found: false, delRight: -1, delLeft: -1, barRight: -1, barLeft: -1 };
      const del = [...el.querySelectorAll("button")].find((b) => /delete selected/i.test(b.textContent || ""));
      const bar = el.getBoundingClientRect();
      const d = del?.getBoundingClientRect();
      return {
        found: true,
        delRight: d ? Math.round(d.right) : -1,
        delLeft: d ? Math.round(d.left) : -1,
        barRight: Math.round(bar.right),
        barLeft: Math.round(bar.left),
      };
    });
    expect(beforeScroll.found, "the dedicated floating-bulk-bar class is present").toBe(true);
    expect(beforeScroll.delRight, "Delete selected is visible WITHOUT scrolling").toBeLessThanOrEqual(beforeScroll.barRight + 1);
    expect(beforeScroll.delLeft, "Delete selected is not cut on the left").toBeGreaterThanOrEqual(beforeScroll.barLeft - 1);

    // Every action must also stay reachable at the end of a scroll.
    const reach = await page.evaluate(() => {
      const el = [...document.querySelectorAll("div")].find((e) =>
        typeof e.className === "string" && e.className.includes("floating-bulk-bar")
      ) as HTMLElement | undefined;
      if (!el) return { found: false, delRight: -1, barRight: -1, scrollable: false };
      el.scrollLeft = el.scrollWidth;
      const del = [...el.querySelectorAll("button")].find((b) => /delete selected/i.test(b.textContent || ""));
      const bar = el.getBoundingClientRect();
      return {
        found: true,
        delRight: del ? Math.round(del.getBoundingClientRect().right) : -1,
        barRight: Math.round(bar.right),
        scrollable: el.scrollWidth > el.clientWidth,
      };
    });
    expect(reach.found, "the dedicated floating-bulk-bar class is present").toBe(true);
    expect(reach.delRight, "Delete selected is reachable inside the bar").toBeGreaterThan(0);
    expect(reach.delRight, "Delete selected is not clipped by the bar").toBeLessThanOrEqual(reach.barRight + 1);
  });
}

test("D-03 the bulk bar also honours a real Android bottom inset", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?unlocked=true");
  await page.addStyleTag({ content: ":root { --safe-bottom: 24px !important; }" });
  await selectFirstItem(page);
  const m = await measure(page);
  expect(m.safeBottom).toBe("24px");
  expect(m.bulkBottomCss, "94px + 24px inset").toBe("118px");
  expect(m.bulk!.bottom).toBeLessThanOrEqual(m.nav!.y);
  expect(inBounds(m.bulk!, { width: 390, height: 844 })).toBe(true);
});
