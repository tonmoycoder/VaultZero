/**
 * Batch 2 / V-91 — Android status-bar clearance, horizontal canvas lock,
 * "All items" heading and touch-scrollable sort pills.
 *
 * Measured at 360x800 BEFORE the fix (real headless Chromium, isMobile):
 *   - the "EN" header control sat at top=10px -> the Android status bar
 *     (clock / Wi-Fi / battery) draws over it on an edge-to-edge WebView,
 *     because `env(safe-area-inset-top)` resolves to 0px there.
 *   - html/body/#root had `overscroll-behavior-x: auto` (rubber-band/drift).
 *   - the "All items" h2 had `white-space: normal; flex-shrink: 1`.
 *   - the sort row had `touch-action: auto` and a visible thin scrollbar.
 * `document.scrollWidth === clientWidth` already held (no horizontal drift),
 * so B-08/B-10 are guards, not fixes.
 */
import { expect, test, type Page } from "@playwright/test";

const PHONE = { width: 360, height: 800 };
const DESKTOP = { width: 1440, height: 900 };

const headerTop = (page: Page) =>
  page.evaluate(() => {
    const el = [...document.querySelectorAll("*")].find(
      (e) => e.children.length === 0 && (e.textContent || "").trim() === "EN",
    );
    const safe = document.querySelector(".mobile-safe-top");
    return {
      top: el ? Math.round(el.getBoundingClientRect().top) : -1,
      paddingTop: safe ? Math.round(parseFloat(getComputedStyle(safe).paddingTop) || 0) : -1,
    };
  });

test("B-06 the header clears the Android status bar by at least 32px on a phone", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/?unlocked=true");
  const vault = await headerTop(page);
  expect(vault.paddingTop, "guaranteed top inset on the vault shell").toBeGreaterThanOrEqual(36);
  expect(vault.top, "EN control must not sit under the clock/notifications").toBeGreaterThanOrEqual(32);

  await page.goto("/");
  const lock = await headerTop(page);
  expect(lock.paddingTop, "the lock screen has the same guaranteed inset").toBeGreaterThanOrEqual(36);
});

test("B-07 html/body/#root lock horizontal overscroll", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/?unlocked=true");
  const styles = await page.evaluate(() => {
    const read = (el: Element | null) => {
      if (!el) return null;
      const c = getComputedStyle(el);
      return { overflowX: c.overflowX, overscrollX: c.overscrollBehaviorX, margin: c.margin, padding: c.padding };
    };
    return {
      html: read(document.documentElement),
      body: read(document.body),
      root: read(document.getElementById("root")),
    };
  });
  for (const key of ["html", "body", "root"] as const) {
    const s = styles[key];
    expect(s, `${key} must be laid out`).toBeTruthy();
    expect(s!.overflowX, `${key} must never scroll horizontally`).toBe("hidden");
    expect(s!.overscrollX, `${key} must not rubber-band sideways`).toBe("none");
  }
});

test("B-08 zero horizontal drift at 360px and 1440px on every main surface", async ({ page }) => {
  for (const vp of [PHONE, DESKTOP]) {
    await page.setViewportSize(vp);
    for (const path of ["/", "/?unlocked=true"]) {
      await page.goto(path);
      const dims = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
        body: document.body.scrollWidth,
      }));
      expect(dims.sw, `document overflow at ${vp.width}px ${path}`).toBeLessThanOrEqual(vp.width + 1);
      expect(dims.body, `body overflow at ${vp.width}px ${path}`).toBeLessThanOrEqual(vp.width + 1);
    }
  }
});

test("B-09 'All items' stays on one line and the sort row is touch-pan-x scrollable", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/?unlocked=true");
  const m = await page.evaluate(() => {
    const h2 = [...document.querySelectorAll("h2")].find((e) => /All items/i.test(e.textContent || ""));
    const btn = [...document.querySelectorAll("button")].find((e) => (e.textContent || "").trim() === "Recently updated");
    const row = btn?.parentElement as HTMLElement | undefined;
    const hs = h2 ? getComputedStyle(h2) : null;
    const rs = row ? getComputedStyle(row) : null;
    const chips = row ? [...row.querySelectorAll("button")] : [];
    return {
      heading: {
        whiteSpace: hs?.whiteSpace,
        flexShrink: hs?.flexShrink,
        top: h2 ? Math.round(h2.getBoundingClientRect().top) : -1,
        bottom: h2 ? Math.round(h2.getBoundingClientRect().bottom) : -1,
      },
      row: {
        classes: row?.className || "",
        touchAction: rs?.touchAction,
        overflowX: rs?.overflowX,
        wrap: rs?.flexWrap,
        justify: rs?.justifyContent,
        scrollWidth: row?.scrollWidth ?? 0,
        clientWidth: row?.clientWidth ?? 0,
        top: row ? Math.round(row.getBoundingClientRect().top) : -1,
        firstLeft: chips[0] ? Math.round(chips[0].getBoundingClientRect().left - row!.getBoundingClientRect().left) : -999,
      },
    };
  });
  expect(m.heading.whiteSpace, "a long folder name must not break All items into two lines").toBe("nowrap");
  expect(m.heading.flexShrink).toBe("0");
  expect(m.heading.bottom, "title is on its own clean row above the pills").toBeLessThanOrEqual(m.row.top);
  expect(m.row.classes, "the pill row uses the no-scrollbar utility").toContain("no-scrollbar");
  expect(m.row.touchAction, "horizontal swipe must be handed to the row").toContain("pan-x");
  expect(m.row.wrap).toBe("nowrap");
  expect(m.row.overflowX).toBe("auto");
  expect(m.row.justify, "start alignment keeps the first chip reachable").toBe("flex-start");
  expect(m.row.scrollWidth, "the row really overflows on a 360px phone").toBeGreaterThan(m.row.clientWidth);
  expect(m.row.firstLeft).toBeGreaterThanOrEqual(-1);
});

test("B-10 the lock card is centred and never drifts off-canvas on a phone", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/");
  const r = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]') as HTMLElement;
    const card = dialog?.querySelector(".glass-strong") as HTMLElement;
    dialog.scrollTop = 0;
    const box = card?.getBoundingClientRect();
    return {
      left: box ? Math.round(box.left) : -1,
      right: box ? Math.round(box.right) : -1,
      top: box ? Math.round(box.top) : -1,
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    };
  });
  expect(r.left, "no empty margin / left drift").toBeGreaterThanOrEqual(-1);
  expect(r.right, "no right-side dead space or cut").toBeLessThanOrEqual(PHONE.width + 1);
  expect(r.top, "the top of the card is reachable at scrollTop=0").toBeGreaterThanOrEqual(-1);
  expect(r.sw).toBeLessThanOrEqual(r.cw + 1);
});
