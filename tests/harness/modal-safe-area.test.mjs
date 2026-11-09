// V-95 / Batch 6 — every fixed bottom action bar must honour the Android
// gesture/navigation-bar inset. Before this fix the shared Modal <footer> in
// ui.tsx used a flat `py-3.5` (14px): on a 360x800 phone with a real 24px
// inset, "Receive & Merge" ended at y=785 and sat under system UI. The lock
// screen and the vault shell already used the variable; only the modal did not.
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
const ui = read("src/components/ui.tsx");
const lock = read("src/components/LockScreen.tsx");

console.log("=== positive control: the detector really detects a flat footer ===");
const flat = "footer { padding-bottom: 14px; }";
const inset = "footer { padding-bottom: calc(14px + var(--safe-bottom)); }";
t("a flat 14px footer is NOT inset-aware", !/var\(--safe-bottom\)/.test(flat));
t("an inset-aware footer IS detected", /var\(--safe-bottom\)/.test(inset));

console.log("=== the shared Modal footer honours the inset ===");
const footerTag = ui.match(/<footer[\s\S]{0,300}?<\/footer>/)?.[0] || "";
t("the Modal renders a footer", /<footer/.test(footerTag));
t("the Modal footer carries the modal-footer class", /className="[^"]*modal-footer/.test(footerTag), footerTag.slice(0, 90).replace(/\s+/g, " "));
t("index.css defines .modal-footer with the inset", /\.modal-footer\s*\{[^}]*var\(--safe-bottom\)[^}]*\}/s.test(css));
t("the inset is ADDED to the base padding, not replacing it", /\.modal-footer\s*\{[^}]*calc\([^)]*var\(--safe-bottom\)[^)]*\)[^}]*\}/s.test(css));

console.log("=== the rest of the shell stays inset-aware (guards) ===");
t("--safe-bottom is defined on :root", /:root\s*\{[^}]*--safe-bottom\s*:\s*env\(safe-area-inset-bottom/s.test(css));
t("the lock screen reserves the bottom inset", /var\(--safe-bottom\)/.test(lock));
t(".mobile-safe-bottom reserves the bottom inset", /\.mobile-safe-bottom\s*\{[^}]*var\(--safe-bottom\)/s.test(css));
t("the 36px status-bar floor from batch 2 is intact", /\.mobile-safe-top\s*\{[^}]*max\(var\(--safe-top\),\s*36px\)/s.test(css));

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
