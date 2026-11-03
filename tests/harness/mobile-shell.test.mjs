// V-76 / V-77: mobile shell invariants derived from the ceorkm
// mobile-app-ui-design SKILL.md (375px baseline, 44x44pt tap targets,
// no clipped content, thumb zone) and from measured frame telemetry.
// Headless Chromium at 390x844 showed median 33.4 ms / p95 50.1 ms on the
// lock screen with 9 backdrop-filter surfaces + 4 infinite animations.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

const css = read("src/index.css");
const html = read("index.html");
const tactile = read("src/components/Tactile.tsx");
const vaultHome = read("src/components/VaultHome.tsx");

console.log("=== positive control ===");
t("detects a stylesheet with no safe-area support", !/safe-area-inset-top/.test("body { padding: 0; }"));
t("accepts a stylesheet with safe-area support", /safe-area-inset-top/.test("body { padding-top: env(safe-area-inset-top); }"));

console.log("=== safe area / edge-to-edge (V-76) ===");
t("viewport opts into edge-to-edge", /viewport-fit=cover/.test(html));
t("CSS uses env(safe-area-inset-top)", /env\(safe-area-inset-top[^)]*\)/.test(css));
t("CSS uses env(safe-area-inset-bottom)", /env\(safe-area-inset-bottom\)/.test(css));
t("mobile shell reserves status-bar height", /--safe-top|--status-inset|safe-area-inset-top/.test(css));
t("no horizontal overflow at document level", /overflow-x:\s*hidden/.test(css));

console.log("=== mobile performance envelope (V-77) ===");
t("has a small-screen media query", /@media\s*\(max-width:\s*767px\)/.test(css));
// Scan every mobile media block with a generous window instead of relying on
// one fixed-distance regex: the V-77 envelope sits far below two earlier
// `@media (max-width: 767px)` blocks, so a 1400-char window was a false FAIL.
const mobileBlocks = [...css.matchAll(/@media\s*\(max-width:\s*767px\)\s*\{/g)].map((m) =>
  css.slice(m.index, m.index + 6000)
);
const inAnyMobileBlock = (re) => mobileBlocks.some((block) => re.test(block));
t("mobile query disables heavy backdrop blur", inAnyMobileBlock(/backdrop-filter:\s*none/));
t("mobile query stops infinite ambient animations", inAnyMobileBlock(/animation:\s*none/));
t("honours prefers-reduced-motion", /prefers-reduced-motion/.test(css));
t("44px minimum tap target on mobile", /min-height:\s*44px|min-width:\s*44px/.test(css));
t("global pointermove listener is limited to fine pointers", /pointer:\s*fine/.test(tactile));
t("card pointermove spotlight is limited to fine pointers", /pointer:\s*fine/.test(vaultHome));

console.log("\nRESULT: " + (failures === 0 ? "all passed" : failures + " failed"));
process.exit(failures === 0 ? 0 : 1);
