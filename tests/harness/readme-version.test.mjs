// V-88: README still advertised "(v2.5.0)" in two section headings while the
// shipped app was 2.5.2. A user comparing the docs with the lock-screen footer
// concludes the download is the old build. Headings must track APP_VERSION.
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

const versionFile = read("src/lib/version.ts");
const appVersion = /\bAPP_VERSION\s*=\s*"([^"]+)"/.exec(versionFile)?.[1] ?? "";
const core = (v) => v.replace(/^v/i, "").split("-")[0].split("+")[0].split(".").map(Number);
const cmp = (a, b) => {
  const A = core(a);
  const B = core(b);
  for (let i = 0; i < 3; i++) {
    if ((A[i] ?? 0) !== (B[i] ?? 0)) return (A[i] ?? 0) > (B[i] ?? 0) ? 1 : -1;
  }
  return 0;
};
const headingVersion = (line) => /\(v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\)/.exec(line)?.[1] ?? null;

console.log("=== positive control: the detector is not a stub ===");
t("APP_VERSION was read", /^\d+\.\d+\.\d+/.test(appVersion), appVersion);
t("a planted stale heading is detected", cmp(headingVersion("## Features (v2.5.0)") ?? "0", appVersion) < 0);
t("a current heading passes", cmp(headingVersion(`## Features (v${appVersion})`) ?? "0", appVersion) === 0);

console.log("=== README section headings track the shipped version ===");
const readme = read("README.md");
const headings = readme.split("\n").filter((line) => /^#{1,6}\s/.test(line) && headingVersion(line));
t("the scan actually found versioned headings", headings.length > 0, `${headings.length} headings`);
for (const line of headings) {
  const v = headingVersion(line);
  t(`heading "${line.trim().slice(0, 60)}" is not stale`, cmp(v ?? "0", appVersion) >= 0, `v${v} vs ${appVersion}`);
}

console.log("=== no stale release literal is advertised anywhere in README ===");
const stale = [...readme.matchAll(/\bv\d+\.\d+\.\d+\b/g)]
  .map((m) => m[0])
  .filter((v) => cmp(v, appVersion) < 0);
t("README mentions no older release", stale.length === 0, [...new Set(stale)].join(", ") || "clean");

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
