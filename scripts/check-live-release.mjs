// V-82: reproduces the GitHub 404 a user sees when clicking a Windows
// installer link in README.md. Kept OUT of tests/harness on purpose: it reads
// LIVE release state, so putting it in the auto-discovered harness would turn
// every local/CI gate red until the release is published. Run explicitly:
//   node scripts/check-live-release.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "tonmoycoder/VaultZero";
const CANONICAL = [
  "VaultZero-Windows-x64-Setup.exe",
  "VaultZero-Windows-x64-Portable.exe",
  "VaultZero-Windows-x64.msi",
  "VaultZero-Android.apk",
  "SHA256SUMS.txt",
];

let live = [];
let tag = "?";
try {
  tag = execFileSync("gh", ["release", "view", "--repo", REPO, "--json", "tagName", "--jq", ".tagName"], { encoding: "utf8" }).trim();
  live = execFileSync("gh", ["release", "view", "--repo", REPO, "--json", "assets", "--jq", ".assets[].name"], { encoding: "utf8" })
    .trim().split("\n").filter(Boolean);
} catch (err) {
  console.error("FAIL  cannot observe the live release: " + err.message);
  process.exit(2);
}

const readme = readFileSync(join(ROOT, "README.md"), "utf8");
let failures = 0;
console.log(`=== live latest release: ${tag} (${live.length} assets) ===`);
for (const name of CANONICAL) {
  const linked = readme.includes(`/releases/latest/download/${name}`);
  const published = live.includes(name);
  const ok = linked && published;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  README-link=${linked} published=${published}`);
  if (!ok) failures++;
}

console.log(`\nRESULT: ${failures === 0 ? "all 5 links resolve" : failures + " README links return 404"}`);
process.exit(failures === 0 ? 0 : 1);
