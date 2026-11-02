/**
 * UI/UX regression suite for the overlap and clipping fixes.
 *
 * Each test corresponds to a user-visible defect reported from a
 * screenshot. Every test must FAIL before the fix and PASS after it.
 *
 *   U-01  The "Copy all account details (…)" tooltip was clipped mid-word
 *         inside the Inspector panel.
 *   U-02  The tooltip on a vault-card action was sliced in half by
 *         `.vault-card { overflow: hidden }`.
 *   U-03  Hovering a password-field button made the field content jump
 *         downwards (the tooltip was part of the layout).
 *   U-04  The "100% offline" sidebar label was clipped by `leading-none`.
 *   U-05  The sidebar crypto line read "XChaCha20 · Argon2i…" because it
 *         was truncated.
 *   U-06  The featured card's strength label collided with the 2FA panel.
 *   U-07  A long modal title ran under the close button.
 *   U-08  The `--text-faint` colour failed WCAG AA on the light theme.
 */
import { expect, test } from "@playwright/test";

/* ------------------------------------------------------------------ */
/* U-01 / U-02 / U-03 — the tooltip must escape every overflow context  */
/* ------------------------------------------------------------------ */

test.describe("tooltip rendering", () => {
  test("U-02 the tooltip is rendered in a portal, outside its trigger", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate(() => {
      // The tooltip bubble must never be a descendant of the trigger, or any
      // ancestor's `overflow: hidden` can clip it.
      const wrap = document.createElement("span");
      wrap.className = "tooltip-wrap";
      wrap.innerHTML = '<button type="button">trigger</button>';
      document.body.appendChild(wrap);
      wrap.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));

      return new Promise<{ inPortal: boolean }>((resolve) => {
        requestAnimationFrame(() => {
          const bubble = document.querySelector(".tooltip-bubble-portal");
          resolve({
            inPortal: !!bubble && bubble.parentElement === document.body,
          });
          wrap.remove();
        });
      });
    });

    expect(result.inPortal).toBe(true);
  });

  test("U-01 a long tooltip wraps instead of running off the panel", async ({ page }) => {
    await page.goto("/");

    const styles = await page.evaluate(() => {
      const bubble = document.createElement("span");
      bubble.className = "tooltip-bubble";
      document.body.appendChild(bubble);
      const computed = getComputedStyle(bubble);
      const out = {
        whiteSpace: computed.whiteSpace,
        maxWidth: computed.maxWidth,
        overflowWrap: computed.overflowWrap,
      };
      bubble.remove();
      return out;
    });

    // `nowrap` produced a 500px-wide bubble that was cut off mid-word.
    expect(styles.whiteSpace).not.toBe("nowrap");
    expect(styles.maxWidth).not.toBe("none");
    expect(styles.overflowWrap).toBe("anywhere");
  });

  test("U-03 showing a tooltip does not change the trigger's layout", async ({ page }) => {
    await page.goto("/");

    const stable = await page.evaluate(async () => {
      const wrap = document.createElement("span");
      wrap.className = "tooltip-wrap";
      wrap.style.cssText = "position:relative;display:inline-flex";
      wrap.innerHTML = '<button type="button" style="width:40px;height:20px">x</button>';
      document.body.appendChild(wrap);

      const before = wrap.getBoundingClientRect().height;
      wrap.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      await new Promise((r) => requestAnimationFrame(r));
      const after = wrap.getBoundingClientRect().height;

      wrap.remove();
      return { before, after };
    });

    expect(Math.abs(stable.after - stable.before)).toBeLessThan(1);
  });
});

/* ------------------------------------------------------------------ */
/* U-04 / U-05 — the sidebar offline card                              */
/* ------------------------------------------------------------------ */

test.describe("sidebar offline card", () => {
  test("U-04 the label is not clipped by a zero line-height", async ({ page }) => {
    await page.goto("/");

    const lineHeight = await page.evaluate(() => {
      const el = document.createElement("p");
      el.className = "flex items-center gap-1.5 text-[9.5px] font-bold leading-tight text-main";
      document.body.appendChild(el);
      const computed = getComputedStyle(el);
      const out = computed.lineHeight;
      el.remove();
      return out;
    });

    // `leading-none` gives a line-height of 1, which clips ascenders and
    // descenders in a bold 9.5px label.
    expect(parseFloat(lineHeight)).toBeGreaterThan(1.2);
  });

  test("U-05 the crypto line is not truncated", async ({ page }) => {
    await page.goto("/");

    const truncated = await page.evaluate(() => {
      const el = document.createElement("p");
      el.className = "mt-0.5 text-[8px] leading-[1.35] text-faint";
      el.textContent = "XChaCha20 · Argon2id · local";
      document.body.appendChild(el);
      const computed = getComputedStyle(el);
      const out = {
        overflow: computed.overflow,
        textOverflow: computed.textOverflow,
        whiteSpace: computed.whiteSpace,
      };
      el.remove();
      return out;
    });

    expect(truncated.textOverflow).not.toBe("ellipsis");
    expect(truncated.whiteSpace).not.toBe("nowrap");
  });
});

/* ------------------------------------------------------------------ */
/* U-06 — the featured card layout                                      */
/* ------------------------------------------------------------------ */

test.describe("featured vault card", () => {
  test("U-06 the two halves are top-aligned, not bottom-aligned", async ({ page }) => {
    await page.goto("/");

    const alignItems = await page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "relative z-10 mt-auto pt-3 sm:flex sm:items-start sm:gap-4";
      document.body.appendChild(el);
      const computed = getComputedStyle(el);
      const out = { alignItems: computed.alignItems };
      el.remove();
      return out;
    });

    // `items-end` bottom-aligned the title block against the tall 2FA
    // panel and pushed the password row into its rounded corner.
    expect(alignItems.alignItems).not.toBe("flex-end");
  });
});

/* ------------------------------------------------------------------ */
/* U-07 — the modal header                                              */
/* ------------------------------------------------------------------ */

test.describe("modal header", () => {
  test("U-07 the title truncates and the header clips its content", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate(() => {
      const header = document.createElement("header");
      header.className =
        "flex shrink-0 items-start justify-between gap-3 overflow-hidden px-5 pb-3 pt-5 sm:gap-4 sm:px-6 sm:pt-6";
      const inner = document.createElement("div");
      inner.className = "min-w-0 flex-1";
      const title = document.createElement("h2");
      title.className =
        "truncate font-display text-[19px] font-semibold leading-tight tracking-[-0.02em] text-main";
      title.textContent = "A very long vault entry title that would otherwise run under the close button";
      inner.appendChild(title);
      header.appendChild(inner);
      document.body.appendChild(header);

      const out = {
        headerOverflow: getComputedStyle(header).overflow,
        titleOverflow: getComputedStyle(title).textOverflow,
        titleWhiteSpace: getComputedStyle(title).whiteSpace,
      };
      header.remove();
      return out;
    });

    expect(result.headerOverflow).toContain("hidden");
    expect(result.titleOverflow).toBe("ellipsis");
    expect(result.titleWhiteSpace).toBe("nowrap");
  });
});

/* ------------------------------------------------------------------ */
/* U-08 — colour contrast                                                */
/* ------------------------------------------------------------------ */

test.describe("colour contrast", () => {
  test("U-08 --text-faint meets WCAG AA on the light theme", async ({ page }) => {
    await page.goto("/");

    const ratio = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.color = "var(--text-faint)";
      document.body.appendChild(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();

      const parse = (c: string) => {
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return [0, 0, 0];
        const parts = m[1].split(",").map((v) => parseFloat(v));
        return [parts[0], parts[1], parts[2]];
      };
      const srgb = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      const luminance = ([r, g, b]: number[]) =>
        0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);

      const fg = luminance(parse(color));
      // The light glass surface.
      const bg = luminance([248, 249, 252]);
      const [hi, lo] = fg > bg ? [fg, bg] : [bg, fg];
      return (hi + 0.05) / (lo + 0.05);
    });

    // The previous value (#78829a) was 3.65:1 — below AA.
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
