// V-96 / Batch 7 — CI/CD gates and the 5 canonical release assets.
//
// Two real gaps found by inspecting `.github/workflows/`:
//   1. The step named "Verify TypeScript & Frontend Build" only ran
//      `npm run build` (Vite transpiles, it does NOT type-check). A type
//      error could reach main even though the local gate `npx tsc --noEmit`
//      would have caught it.
//   2. `SHA256SUMS.txt` was generated but never verified with
//      `sha256sum -c`, so a truncated/corrupt manifest could be published.
// The other gates, the 5 asset names and the Beta/`--latest` rules are GUARDS.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const has = (rel) => existsSync(join(ROOT, rel));

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

const ci = read(".github/workflows/ci.yml");
const release = read(".github/workflows/release.yml");
const readme = read("README.md");
const checker = read("scripts/check-live-release.mjs");
const CANONICAL = [
  "VaultZero-Windows-x64-Setup.exe",
  "VaultZero-Windows-x64-Portable.exe",
  "VaultZero-Windows-x64.msi",
  "VaultZero-Android.apk",
  "SHA256SUMS.txt",
];

console.log("=== positive controls: the detectors really detect the gaps ===");
t("a build-only CI step is NOT a type check", !/npx tsc --noEmit/.test("run: npm run build"));
t("a CI step with tsc IS detected", /npx tsc --noEmit/.test("run: npx tsc --noEmit"));
t("printing a manifest is NOT checksum verification", !/sha256sum -c/.test("cat SHA256SUMS.txt"));
t("an explicit sha256sum -c IS detected", /sha256sum -c SHA256SUMS\.txt/.test("sha256sum -c SHA256SUMS.txt"));

console.log("=== CI enforces the SAME gates as the local checklist ===");
t("CI runs npx tsc --noEmit", /npx tsc --noEmit/.test(ci));
t("CI runs the frontend build", /npm run build/.test(ci));
t("CI checks theme contrast", /check-contrast\.mjs/.test(ci));
t("CI checks the chunk budget", /check-bundle-size\.mjs/.test(ci));
t("CI builds the harness bundles", /build:test-bundles/.test(ci));
t("CI runs the browserless harnesses", /test:harness/.test(ci));
t("CI checks rustfmt", /cargo fmt --all -- --check/.test(ci));
t("CI runs clippy with -D warnings", /cargo clippy[^\n]*-D warnings/.test(ci));
t("CI runs the Rust tests", /cargo test/.test(ci));
t("CI audits frontend dependencies", /npm audit --audit-level=high/.test(ci));
t("CI runs the Playwright suite", /npx playwright test|playwright test/.test(ci));
t("CI uses Node 20", /node-version:\s*20/.test(ci));

console.log("=== release manifest is verified, not merely written ===");
t("workflow verifies SHA256SUMS.txt with sha256sum -c", /sha256sum -c SHA256SUMS\.txt/.test(release));
t("exactly one combined manifest is written", (release.match(/: > SHA256SUMS\.txt|Set-Content -Path "[^"]*SHA256SUMS\.txt"/g) || []).length === 1);
t("manifest excludes itself from its own input", /! -name 'SHA256SUMS\.txt'/.test(release));
t("the manifest is generated before upload", release.indexOf("Build ONE Combined Checksum Manifest") < release.indexOf("gh release upload"));

console.log("=== the exact 5 canonical assets stay a single source of truth ===");
const verification = release.slice(release.indexOf("Verifying the published asset contract"));
for (const name of CANONICAL) {
  t(`publish verification requires ${name}`, verification.includes(`"${name}"`));
  t(`README links ${name}`, readme.includes(`/releases/latest/download/${name}`));
  t(`check-live-release.mjs knows ${name}`, checker.includes(`"${name}"`));
}
t("no --prerelease (stable /latest/download links must resolve)", /--latest/.test(release) && !/--prerelease/.test(release));
t("upload failures are not swallowed", !/gh release upload[^\n]*\|\| true/.test(release));
t("no downgrade or legacy asset rename", !/Portable\.zip|Android-universal\.apk|v2\.5\.0/.test(release + readme));

console.log("=== Batch 1 -> 7 regression map (all suites must still exist) ===");
const batches = [
  ["1 first-run / setup", "tests/vault-first-run.spec.ts"],
  ["2 mobile status bar + canvas", "tests/vault-mobile-layout.spec.ts"],
  ["2 mobile shell", "tests/vault-mobile-shell.spec.ts"],
  ["3 P2P real LAN IP", "tests/vault-p2p-lan.spec.ts"],
  ["4 resilient update check", "tests/vault-updater-resilience.spec.ts"],
  ["5 offline OCR / TOTP / icons", "tests/vault-ocr-totp-icons.spec.ts"],
  ["6 bounding-box DOM audit", "tests/vault-bounding-audit.spec.ts"],
  ["7 CI/CD + release gates", "tests/harness/ci-release-gates.test.mjs"],
];
for (const [label, rel] of batches) {
  t(`batch ${label} suite exists`, has(rel) && read(rel).length > 100, rel);
}
for (const ledger of ["checkpoint.md", "checklistprogress.md"]) {
  const text = read(ledger);
  for (const n of [90, 91, 92, 93, 94, 95]) {
    t(`${ledger} records V-${n}`, text.includes(`V-${n}`), `V-${n}`);
  }
}

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
