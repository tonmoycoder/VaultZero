/**
 * Batch 6 / V-95 — explicit 360x800 / 1440x900 bounding-box DOM audit.
 *
 * Measured in real headless Chromium BEFORE the fix:
 *   - Lock / Vault / Sync: scrollWidth === clientWidth at BOTH viewports;
 *     the "VaultZero" header wordmark sits at y=36 (360x800) / y=33
 *     (1440x900). These are GUARDS, not fixes.
 *   - Sync footer after Connect: 360x800 -> Close 153..224 / 701..741,
 *     Send Vault 232..339 / 703..739, Receive & Merge 198..339 / 749..785;
 *     1440x900 -> all three within 401..1039 / 674..766. All in bounds.
 *   - DEFECT: with a real Android bottom inset (--safe-bottom: 24px or 48px)
 *     the generic Modal footer kept padding-bottom: 14px and every button
 *     stayed at bottom=785 of 800. The gesture/navigation bar therefore
 *     covered "Receive & Merge" -- the user's "cut-off bottom buttons".
 *     LockScreen and .mobile-safe-bottom already honoured the inset; only
 *     src/components/ui.tsx's shared <footer> did not.
 */
import { expect, test, type Page } from "@playwright/test";

const PHONE = { width: 360, height: 800 };
const DESKTOP = { width: 1440, height: 900 };
const VPS = [PHONE, DESKTOP] as const;

type Viewport = { width: number; height: number };
type Box = { x: number; y: number; right: number; bottom: number; w: number; h: number };

/** Pure detector so the audit can prove it would catch a real violation. */
const inBounds = (b: Box, vp: Viewport, bottomInset = 0) =>
  b.x >= -1 && b.y >= -1 &&
  b.right <= vp.width + 1 &&
  b.bottom <= vp.height - bottomInset + 1 &&
  b.w > 0 && b.h > 0;

const dims = (page: Page) => page.evaluate(() => ({
  sw: document.documentElement.scrollWidth,
  cw: document.documentElement.clientWidth,
  bw: document.body.scrollWidth,
}));

/** Top of the leaf wordmark — the same header anchor on phone and desktop. */
const headerTop = (page: Page) => page.evaluate(() => {
  const el = [...document.querySelectorAll("*")].find((e) => {
    if (e.children.length !== 0 || (e.textContent || "").trim() !== "VaultZero") return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  return el ? Math.round(el.getBoundingClientRect().top) : -1;
});

const boxOf = async (loc: import("@playwright/test").Locator): Promise<Box | null> => {
  const b = await loc.boundingBox();
  if (!b) return null;
  return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), right: Math.round(b.x + b.width), bottom: Math.round(b.y + b.height) };
};

const openScanTab = async (page: Page) => {
  await page.getByRole("button", { name: "Sync" }).click();
  await page.getByRole("button", { name: /Scan QR/ }).click();
};

const FOOTER_ACTIONS = ["Close", "Send Vault", "Receive & Merge"] as const;

test("B-24 header clears y>=32 and no horizontal drift on Lock / Vault / Sync at both viewports", async ({ page }) => {
  // Positive control: a synthetic clipped box MUST be rejected by the detector.
  expect(inBounds({ x: 10, y: 700, w: 100, h: 40, right: 110, bottom: 740 }, PHONE)).toBe(true);
  expect(inBounds({ x: -20, y: 700, w: 100, h: 40, right: 80, bottom: 740 }, PHONE), "detector catches a left cut").toBe(false);
  expect(inBounds({ x: 10, y: 700, w: 100, h: 140, right: 110, bottom: 840 }, PHONE), "detector catches a bottom cut").toBe(false);

  for (const vp of VPS) {
    await page.setViewportSize(vp);
    for (const [surface, path] of [["Lock", "/"], ["Vault", "/?unlocked=true"]] as const) {
      await page.goto(path);
      const d = await dims(page);
      expect(d.sw, `${surface} scrollWidth at ${vp.width}px`).toBeLessThanOrEqual(d.cw);
      expect(d.bw, `${surface} body width at ${vp.width}px`).toBeLessThanOrEqual(vp.width + 1);
      expect(await headerTop(page), `${surface} header y at ${vp.width}px must clear 32`).toBeGreaterThanOrEqual(32);
    }
    await page.goto("/?unlocked=true");
    await openScanTab(page);
    const d = await dims(page);
    expect(d.sw, `Sync scrollWidth at ${vp.width}px`).toBeLessThanOrEqual(d.cw);
    const header = await boxOf(page.locator('[role="dialog"][aria-modal="true"] header').first());
    expect(header, `Sync header laid out at ${vp.width}px`).toBeTruthy();
    expect(header!.y, `Sync header y at ${vp.width}px`).toBeGreaterThanOrEqual(32);
    expect(header!.right, `Sync header right edge at ${vp.width}px`).toBeLessThanOrEqual(vp.width + 1);
  }
});

test("B-25 all three P2P footer actions are fully inside the viewport at 360x800 and 1440x900", async ({ page }) => {
  for (const vp of VPS) {
    await page.setViewportSize(vp);
    await page.goto("/?unlocked=true");
    await openScanTab(page);
    await page.getByPlaceholder(/10\.0\.0\.5/).fill("192.168.1.5:52137");
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    const footer = page.locator('[role="dialog"][aria-modal="true"] footer').first();
    for (const name of FOOTER_ACTIONS) {
      const box = await boxOf(footer.getByRole("button", { name, exact: true }));
      expect(box, `${name} must be laid out at ${vp.width}px`).toBeTruthy();
      expect(inBounds(box!, vp), `${name} box ${JSON.stringify(box)} at ${vp.width}x${vp.height}`).toBe(true);
    }
  }
});

test("B-26 a real Android bottom inset never covers the footer actions", async ({ page }) => {
  // Headless Chromium reports 0px for env(safe-area-inset-bottom). Overriding
  // the variable simulates a real 24px gesture/navigation bar, exactly like
  // M-03 does for the top inset. The measured pre-fix boxes stayed at
  // bottom=785 of 800 -> 9px of "Receive & Merge" sat under system UI.
  const INSET = 24;
  for (const vp of VPS) {
    await page.setViewportSize(vp);
    await page.goto("/?unlocked=true");
    await page.addStyleTag({ content: `:root { --safe-bottom: ${INSET}px !important; }` });
    await openScanTab(page);
    await page.getByPlaceholder(/10\.0\.0\.5/).fill("192.168.1.5:52137");
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    const footer = page.locator('[role="dialog"][aria-modal="true"] footer').first();
    const padding = await footer.evaluate((f) => getComputedStyle(f).paddingBottom);
    expect(parseFloat(padding), `footer must reserve the inset at ${vp.width}px`).toBeGreaterThan(14);
    for (const name of FOOTER_ACTIONS) {
      const box = await boxOf(footer.getByRole("button", { name, exact: true }));
      expect(box, `${name} must be laid out at ${vp.width}px`).toBeTruthy();
      expect(inBounds(box!, vp, INSET), `${name} must clear the ${INSET}px nav bar at ${vp.width}px (box ${JSON.stringify(box)})`).toBe(true);
    }
  }
});

test("B-27 '192.1' is rejected as a peer at both viewports", async ({ page }) => {
  for (const vp of VPS) {
    await page.setViewportSize(vp);
    await page.goto("/?unlocked=true");
    await openScanTab(page);
    await page.getByPlaceholder(/10\.0\.0\.5/).fill("192.1");
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(page.getByText(/not a valid peer address/i), `visible reason at ${vp.width}px`).toBeVisible();
    await expect(page.getByText(/Peer selected: 192\.1|Selected: 192\.1|Connected: 192\.1/), `no fake peer at ${vp.width}px`).toHaveCount(0);
  }
});

// Each viewport gets its OWN test, hence its own fresh browser context. Doing
// two expensive 600k-PBKDF2 creations in one page was flaky on a loaded CI
// runner (push run 42508531423: B-28 waited 20s for the dialog to unmount).
// PR run 42508535834 passed 175/175 on the SAME commit, and 4/4 local repeats
// passed, so this is a test-harness weakness, not an application regression.
// The hardened version waits for the real persisted container and rejects ALL
// creation/validation errors instead of one string.
for (const vp of VPS) {
  test(`B-28 a fresh vault is really created and persisted at ${vp.width}x${vp.height}`, async ({ page }) => {
    const KEY = "vaultzero_encrypted_vault_v2";
    await page.setViewportSize(vp);
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("vaultzero_encrypted_vault_v2");
      localStorage.removeItem("vaultzero_has_native_vault");
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: /Create your VaultZero vault/i })).toBeVisible();
    const dialog = page.locator('[role="dialog"][aria-modal="true"]');
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY), "start from a genuinely fresh install").toBeNull();

    await dialog.getByRole("textbox", { name: "Master password", exact: true }).fill("aA2525@");
    await dialog.getByRole("textbox", { name: "Confirm master password", exact: true }).fill("aA2525@");
    const anyError = /Failed to create vault|ভল্ট তৈরিতে সমস্যা|Passwords do not match|at least 6 characters|Enter your master password/i;
    await expect(page.getByText(anyError), "the form is valid before submitting").toHaveCount(0);
    await dialog.getByRole("button", { name: "Create local vault" }).click();

    // 600,000 PBKDF2 iterations are deliberately slow; poll the REAL container
    // rather than guessing a fixed timeout for the dialog to disappear.
    await expect.poll(
      async () => page.evaluate((k) => Boolean(localStorage.getItem(k)), KEY),
      { timeout: 60000, message: `vault container written at ${vp.width}x${vp.height}` },
    ).toBe(true);
    await expect(dialog).toHaveCount(0, { timeout: 30000 });
    await expect(page.getByText(anyError), "no creation error is shown").toHaveCount(0);
  });
}
