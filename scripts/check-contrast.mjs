#!/usr/bin/env node
/**
 * Checks the colour tokens of every theme against the WCAG 2.1 AA
 * contrast threshold.
 *
 * UX: the light theme shipped three status colours — `success`,
 * `warning` and `danger` — that never reached 4.5:1 against the surface
 * they are drawn on. A warning label on a card was 2.97:1, which is below
 * the 1.4:1 that even a decorative shape needs to be perceivable, so the
 * user simply could not see the status. The complaint was "the colours are
 * wrong"; this script is the receipt that they are not any more.
 *
 * The check runs on every theme and every surface the tokens are actually
 * drawn on, and it fails the build when a pair drops below the threshold.
 *
 * Usage:
 *   node scripts/check-contrast.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src", "index.css"), "utf8");

/** The WCAG 2.1 AA threshold for body text. */
const AA = 4.5;

/**
 * The surfaces a token is drawn on, per theme.
 *
 * The page itself is `--app-base`; the cards sit on `--glass-solid`,
 * which is nearly white in the light theme and nearly black in the dark
 * themes; and an input or a solid panel is the plain surface of the
 * theme. A colour has to clear the threshold on all of them, because a
 * card floats over the page and a nested control floats over the card.
 */
const SURFACES = {
  light: {
    "page (--app-base)": "#e9e6f4",
    "card (--glass-solid)": "#f9f8fd",
    "panel (white)": "#ffffff",
  },
  dark: {
    "page (--app-base)": "#070814",
    "card (--glass-solid)": "#12162a",
    "panel (white)": "#1b2036",
  },
  lofi: {
    "page (--app-base)": "#2a1f18",
    "card (--glass-solid)": "#3a2b21",
    "panel (white)": "#463428",
  },
};

/** The tokens that carry meaning and therefore have to be readable. */
const TOKENS = [
  "text-main",
  "text-soft",
  "text-muted",
  "text-faint",
  "accent",
  "accent-deep",
  "success",
  "warning",
  "danger",
];

/** Parses a `#rgb` or `#rrggbb` colour into its relative luminance. */
function luminance(hex) {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(h.slice(0, 2), 16));
  const g = channel(parseInt(h.slice(2, 4), 16));
  const b = channel(parseInt(h.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Returns the contrast ratio between two colours, from 1 to 21. */
function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const high = Math.max(la, lb);
  const low = Math.min(la, lb);
  return (high + 0.05) / (low + 0.05);
}

/** Reads every `[data-theme="…"]` block out of the stylesheet. */
function readThemes() {
  const themes = new Map();
  const pattern = /\[data-theme="([\w-]+)"\]\s*\{([\s\S]*?)\n\}/g;
  let match;
  while ((match = pattern.exec(css)) !== null) {
    const tokens = new Map();
    const tokenPattern = /--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g;
    let token;
    while ((token = tokenPattern.exec(match[2])) !== null) {
      tokens.set(token[1], token[2]);
    }
    themes.set(match[1], tokens);
  }
  return themes;
}

const themes = readThemes();

if (themes.size === 0) {
  console.error("No theme blocks were found in src/index.css.");
  process.exit(1);
}

let failures = 0;

for (const [theme, tokens] of themes) {
  console.log(`\n${theme}`);
  console.log("-".repeat(72));

  const surfaces = SURFACES[theme] ?? SURFACES.light;

  for (const name of TOKENS) {
    const value = tokens.get(name);
    if (!value) continue;

    const cells = [];
    let worst = Infinity;
    for (const [label, surface] of Object.entries(surfaces)) {
      const ratio = contrast(value, surface);
      worst = Math.min(worst, ratio);
      const ok = ratio >= AA;
      if (!ok) failures++;
      cells.push(`${label.split(" ")[0]}: ${ratio.toFixed(2)}:1${ok ? "" : " FAIL"}`);
    }

    const verdict = worst >= 7 ? "AAA" : worst >= AA ? "AA" : "FAIL";
    console.log(
      `  ${name.padEnd(12)} ${value.padEnd(9)} ${verdict.padEnd(5)} ${cells.join("  |  ")}`
    );
  }
}

console.log();
if (failures > 0) {
  console.error(
    `${failures} colour pair(s) fall below the WCAG 2.1 AA threshold of ${AA}:1.`
  );
  process.exit(1);
}
console.log(`Every sampled colour pair meets the ${AA}:1 threshold.`);
