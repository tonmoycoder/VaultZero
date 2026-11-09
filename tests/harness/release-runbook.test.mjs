// V-89: the "downloads the old version" defect is a PUBLICATION problem, not
// a source bug. The live release is from 2026-11-02 while the source has moved
// on, and 2 of the 5 canonical README links 404. A human (or Antigravity)
// must publish a signed Beta. This guard keeps the written runbook in sync
// with the real asset contract in `.github/workflows/release.yml` + README.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

const CANONICAL = [
  "VaultZero-Windows-x64-Setup.exe",
  "VaultZero-Windows-x64-Portable.exe",
  "VaultZero-Windows-x64.msi",
  "VaultZero-Android.apk",
  "SHA256SUMS.txt",
];
const SECRETS = [
  "ANDROID_KEYSTORE_BASE64",
  "ANDROID_KEYSTORE_PASSWORD",
  "ANDROID_KEY_ALIAS",
  "ANDROID_KEY_PASSWORD",
];
const REQUIRED = [
  "check-live-release.mjs",
  "workflow_dispatch",
  "--clobber",
  "--latest",
  "--target",
  "keytool",
  "sha256sum -c",
  "v2.5.2-beta.1",
  "Restored the long-lived release signing keystore from GitHub Secrets.",
  "Using consistent release keystore.",
  "Rollback",
];

console.log("=== positive control: the detector is not a stub ===");
const synthetic = "Upload VaultZero-Android.apk with --clobber";
t("a runbook missing 4 of 5 assets is detected", CANONICAL.filter((n) => !synthetic.includes(n)).length === 4);
t("a runbook missing a secret is detected", SECRETS.some((s) => !synthetic.includes(s)));

const path = "docs/RELEASE-RUNBOOK.md";
console.log("=== the runbook exists and matches the real contract ===");
t(`${path} exists`, existsSync(join(ROOT, path)));
if (!existsSync(join(ROOT, path))) {
  console.log("\nRESULT: 1 failed (runbook missing)");
  process.exit(1);
}
const doc = read(path);
for (const name of CANONICAL) t(`runbook names ${name}`, doc.includes(name));
for (const name of SECRETS) t(`runbook names ${name}`, doc.includes(name));
for (const token of REQUIRED) t(`runbook explains ${token}`, doc.includes(token));

// Cross-check: the runbook must not invent asset names that README does not link.
const readme = read("README.md");
for (const name of CANONICAL) {
  t(`README really links ${name}`, readme.includes(`/releases/latest/download/${name}`));
}

console.log("=== V-96: the guide must reflect the CURRENT live release and PR #4 ===");
// 2026-11-09 observation: v2.5.2 has 10 assets, all 5 canonical links
// resolve (EXIT 0). The old intro still claimed 9 assets and two 404s, which
// would send a local operator chasing a defect that no longer exists.
t("no stale claim that two canonical links 404", !/২টি canonical নাম অনুপস্থিত|README-র ২টি লিংক 404/.test(doc));
t("runbook states the live release has 10 assets", /১০টি অ্যাসেট/.test(doc));
t("runbook references the active PR #4", /PR #4/.test(doc));
t("runbook tells Antigravity to merge explicitly", /gh pr merge 4 --merge/.test(doc));
t("runbook names the signed-log stop condition", /Using consistent release keystore\./.test(doc));

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
