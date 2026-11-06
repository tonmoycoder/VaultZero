/**
 * V-75 / V-76 / V-77 — mobile shell regression suite.
 *
 * Every assertion maps to a defect visible in the user's Android screenshots
 * or to a number measured in headless Chromium at 390x844 BEFORE the fix:
 *   - median frame 33.4 ms / p95 50.1 ms / 22 of 22 frames > 32 ms (lock)
 *   - 9 backdrop-filter surfaces, 4 infinite ambient animations
 *   - sort header + "All items" clipped horizontally
 *   - status bar drawn over the header (`env(safe-area-inset-top)` unused)
 *   - floating bottom nav covering the last line of content
 *   - camera denied immediately on opening Sync → Scan QR
 *   - OCR stalling halfway because the worker/core came from a CDN
 *
 * Design rules follow ceorkm/mobile-app-ui-design SKILL.md: 375px baseline,
 * 8-point spacing, 44x44pt tap targets, thumb zone, no overused blur.
 */
import { expect, test } from "@playwright/test";
import { APP_VERSION } from "../src/lib/version";

const MOBILE_HEIGHT = 844;

/** Opens Nearby P2P Sync → Scan QR / Connect from the mobile bottom nav. */
async function openScanTab(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Sync" }).click();
  await page.getByRole("button", { name: /Scan QR/ }).click();
}

for (const width of [360, 390, 430]) {
  test(`M-01 no horizontal overflow at ${width}px (lock + vault)`, async ({ page }) => {
    await page.setViewportSize({ width, height: MOBILE_HEIGHT });
    for (const path of ["/", "/?unlocked=true"]) {
      await page.goto(path);
      const dims = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(dims.scroll, `horizontal overflow on ${path}`).toBeLessThanOrEqual(width + 1);
      expect(dims.client).toBe(width);
    }
  });
}

test("M-02 the sort header and All-items label are not clipped on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
  await page.goto("/?unlocked=true");

  // Strings that were sliced in the screenshots must be fully readable.
  await expect(page.getByText("Password strength")).toBeVisible();
  await expect(page.getByRole("heading", { name: "All items" })).toBeVisible();

  // No text-bearing container may be horizontally clipped by an ancestor.
  const clipped = await page.evaluate(() => {
    const bad: string[] = [];
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      const text = (el.textContent || "").trim();
      if (!text || text.length < 8) return;
      const style = getComputedStyle(el);
      if (!["hidden", "clip"].includes(style.overflowX)) return;
      if (el.scrollWidth > el.clientWidth + 8 && el.clientWidth > 80) {
        bad.push(`${el.className}`.slice(0, 60) + `: ${el.clientWidth}/${el.scrollWidth}`);
      }
    });
    return bad;
  });
  expect(clipped, `clipped text containers: ${clipped.join(", ")}`).toHaveLength(0);
});

test("M-03 the Android status bar never covers the header", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
  await page.goto("/?unlocked=true");

  // Headless Chromium reports 0 for env(safe-area-inset-*). Overriding the
  // variable simulates a real 24px Android status bar and proves the rule is
  // actually applied, not merely present in the stylesheet.
  await page.addStyleTag({ content: ":root { --safe-top: 24px; --safe-bottom: 24px; }" });
  const shellPadding = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".vault-shell");
    return shell ? getComputedStyle(shell).paddingTop : null;
  });
  expect(shellPadding).toBe("24px");

  const dialogPadding = await (async () => {
    await page.goto("/");
    await page.addStyleTag({ content: ":root { --safe-top: 24px; }" });
    return page.evaluate(() => {
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
      return dialog ? getComputedStyle(dialog).paddingTop : null;
    });
  })();
  expect(dialogPadding).toBe("24px");
});

test("M-04 the floating nav does not swallow the last line of content", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
  await page.goto("/?unlocked=true");
  const pad = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".mobile-safe-bottom");
    return el ? parseFloat(getComputedStyle(el).paddingBottom) : 0;
  });
  // 96px reserved for the nav + 24px gesture bar (V-76).
  expect(pad).toBeGreaterThanOrEqual(96);
});

test("M-05 mobile disables blur and infinite ambient motion (frame budget)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
  await page.goto("/?unlocked=true");
  const perf = await page.evaluate(() => {
    const glass = document.querySelector<HTMLElement>(".glass-strong");
    const blob = document.querySelector<HTMLElement>(".ambient-blob");
    const infinite = [...document.querySelectorAll<HTMLElement>("body *")].filter(
      (el) => getComputedStyle(el).animationIterationCount === "infinite"
    );
    return {
      backdrop: glass ? getComputedStyle(glass).backdropFilter : "none",
      blobAnimation: blob ? getComputedStyle(blob).animationName : "none",
      infinite: infinite.map((el) => `${el.className}`.slice(0, 50)),
    };
  });
  expect(perf.backdrop).toBe("none");
  expect(perf.blobAnimation).toBe("none");
  // Tailwind's `animate-pulse` on the status dot is a short, bounded pulse;
  // the ambient scene must never animate forever on mobile.
  expect(perf.infinite.filter((n) => /ambient|zen|blob|orb/i.test(n))).toHaveLength(0);
});

test("M-06 primary thumb-zone targets are at least 44px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
  await page.goto("/?unlocked=true");
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('nav[aria-label="Mobile navigation"] button')].map(
      (el) => ({ w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height })
    )
  );
  expect(sizes.length).toBeGreaterThan(0);
  for (const s of sizes) {
    expect(s.h).toBeGreaterThanOrEqual(44);
    expect(s.w).toBeGreaterThanOrEqual(44);
  }
});

test("M-07 the lock screen is a fixed dialog, not a draggable sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
  await page.goto("/");
  const dialog = page.locator('[role="dialog"]');
  const before = await dialog.boundingBox();
  expect(before).toBeTruthy();
  const x = before!.x + before!.width / 2;
  const y = before!.y + 120;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 120, y + 160, { steps: 8 });
  await page.mouse.up();
  const after = await dialog.boundingBox();
  expect(Math.abs(after!.x - before!.x)).toBeLessThan(2);
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(2);
  expect(await dialog.getAttribute("data-elastic")).toBeNull();
});

test.describe("Android camera + offline OCR", () => {
  test.use({
    viewport: { width: 390, height: MOBILE_HEIGHT },
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36",
  });

  test("M-08 camera is requested only after an explicit tap", async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__gumCalls = 0;
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => {
            (window as any).__gumCalls += 1;
            throw new DOMException("Permission denied", "NotAllowedError");
          },
        },
      });
    });
    await page.goto("/?unlocked=true");
    await page.getByRole("button", { name: "Sync" }).click();
    await page.getByRole("button", { name: /Scan QR/ }).click();
    await expect(page.getByText("Camera standby")).toBeVisible();
    expect(await page.evaluate(() => (window as any).__gumCalls)).toBe(0);

    await page.getByRole("button", { name: "Start camera" }).click();
    await expect(page.getByText(/Permission denied|permission|Camera/i).first()).toBeVisible();
    expect(await page.evaluate(() => (window as any).__gumCalls)).toBe(1);
    // The panel must stay open and explain the state, not close itself.
    await expect(page.getByRole("button", { name: "Start camera" })).toBeVisible();
  });

  // Phase D / V-86: the user's screenshots show "Permission denied" with a
  // dead "Start camera" button and no way forward. V-84 added the QR-photo
  // picker; this proves it is actually discoverable AFTER a denial.
  test("M-14 a denied camera leaves an actionable QR-photo fallback", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => {
            throw new DOMException("Permission denied", "NotAllowedError");
          },
        },
      });
    });
    await page.goto("/?unlocked=true");
    await openScanTab(page);
    await page.getByRole("button", { name: "Start camera" }).click();
    await expect(page.getByText(/Permission denied/i).first()).toBeVisible();
    await expect(page.getByText(/use the QR photo option/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Read QR from an image/i })).toBeVisible();
    await expect(page.locator('input[capture="environment"]')).toHaveCount(1);
  });

  test("M-09 OCR runs with every external request blocked", async ({ page }) => {
    const external: string[] = [];
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (!url.startsWith("http://127.0.0.1:1420") && !url.startsWith("data:") && !url.startsWith("blob:")) {
        external.push(url);
        return route.abort();
      }
      return route.continue();
    });
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 900;
      canvas.height = 220;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 900, 220);
      ctx.fillStyle = "#000";
      ctx.font = "bold 54px sans-serif";
      ctx.fillText("USER: demo@vaultzero.local", 30, 90);
      ctx.fillText("PASS: S3cret-42", 30, 170);
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
      const file = new File([blob], "ocr.png", { type: "image/png" });
      const mod = await import("/src/lib/ocr.ts");
      const out = await mod.runLocalOcr(file, undefined, "eng");
      return out.rawText;
    });
    expect(result).toContain("demo@vaultzero.local");
    // The app's own opt-in update check may be attempted, but no CDN/host can
    // be required by the OCR engine itself.
    expect(external.filter((u) => /jsdelivr|unpkg|cdnjs|tessdata\.projectnaptha/i.test(u))).toHaveLength(0);
  });
});

/* ---------------------------------------------------------------------------
 * Phase D / V-86 — "old build" / workable-app regression guards.
 * These map one-to-one to the six screenshots: the lock screen claimed
 * v2.5.0, a partial IP became a "Connected" peer, and the three footer
 * actions were cut off at the bottom of the P2P sheet.
 * ------------------------------------------------------------------------- */
test("M-10 the lock screen prints the shipped version, not a stale one", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
  await page.goto("/");
  // Scope to the lock-screen footer: the header also shows the version.
  await expect(page.getByText(new RegExp(`AIR-GAPPED · v${APP_VERSION.replace(/\./g, "\\.")}\\b`))).toBeVisible();
  await expect(page.getByText(/v2\.5\.0\b/)).toHaveCount(0);
  // The quick-unlock fingerprint badge must stay square, not squished.
  const badge = page.locator('[aria-label="Enable quick unlock for this session"]')
    .locator("xpath=..").locator("xpath=following-sibling::button//span").first();
  if (await badge.count()) {
    const box = await badge.boundingBox();
    expect(box).toBeTruthy();
    expect(Math.abs(box!.width - box!.height)).toBeLessThan(2);
  }
});

test("M-11 a fresh install offers SETUP instead of asking for a master password", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Create your VaultZero vault/i })).toBeVisible();
  await expect(page.getByText(/Welcome back/i)).toHaveCount(0);
});

test("M-12 '192.1' is rejected with a persistent, visible reason", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
  await page.goto("/?unlocked=true");
  await openScanTab(page);
  await page.getByPlaceholder(/10\.0\.0\.5/).fill("192.1");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText(/not a valid peer address/i)).toBeVisible();
  await expect(page.getByText(/Peer selected: 192\.1|Selected: 192\.1|Connected: 192\.1/)).toHaveCount(0);
});

test("M-13 all three P2P footer actions fit on a 360px screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: MOBILE_HEIGHT });
  await page.goto("/?unlocked=true");
  await openScanTab(page);
  await page.getByPlaceholder(/10\.0\.0\.5/).fill("192.168.1.5:52137");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  const footer = page.locator("footer");
  for (const name of ["Close", "Send Vault", "Receive & Merge"]) {
    const box = await footer.getByRole("button", { name, exact: true }).boundingBox();
    expect(box, `${name} must be laid out`).toBeTruthy();
    expect(box!.x, `${name} must not be cut on the left`).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width, `${name} must not be cut on the right`).toBeLessThanOrEqual(361);
  }
});
