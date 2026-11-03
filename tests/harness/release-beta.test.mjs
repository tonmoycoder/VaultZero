// V-72: the live v2.5.2 release is missing 3 of the 5 canonical asset names,
// so README's "Download latest" Windows links 404. The workflow already emits
// the right names but (a) treats the MSI as optional and (b) never names a
// development build as Beta. This guard closes both holes.
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

const workflow = read(".github/workflows/release.yml");
const readme = read("README.md");
const updater = read("src/lib/updater.ts");

const CANONICAL = [
  "VaultZero-Windows-x64-Setup.exe",
  "VaultZero-Windows-x64-Portable.exe",
  "VaultZero-Windows-x64.msi",
  "VaultZero-Android.apk",
  "SHA256SUMS.txt",
];

console.log("=== positive control ===");
t("detects a workflow that omits a required asset", !/"VaultZero-Windows-x64\.msi"/.test('required="VaultZero-Windows-x64-Setup.exe"'));
t("accepts a workflow that names the MSI", /"VaultZero-Windows-x64\.msi"/.test('"VaultZero-Windows-x64.msi"'));

console.log("=== all 5 canonical names are mandatory ===");
const verification = workflow.slice(workflow.indexOf("Verifying the published asset contract"));
for (const name of CANONICAL) {
  t(`publish verification requires ${name}`, verification.includes(name));
}
t(
  "Windows build refuses to continue without an MSI",
  /if\s*\(\$msi\)[\s\S]{0,400}else[\s\S]{0,200}throw/.test(workflow) ||
    /MSI installer was not produced/.test(workflow)
);
t("no `|| true` masks an MSI failure", !/msi[^\n]*\|\| true/.test(workflow));
t("V-81 Windows step uses explicit bundle paths, not broken `**/` globs", !/Get-ChildItem -Path "\*\*\/bundle/.test(workflow) && /bundle\/nsis" -Filter/.test(workflow));

console.log("=== Beta naming for a development build ===");
t("release title marks beta tags as a Beta / development preview", /BETA|Beta/.test(workflow) && /beta/.test(workflow));
t("beta detection is driven by the tag, not a hardcoded version", /TAG[\s\S]{0,120}beta|\$\{\{[^}]*ref_name[^}]*\}\}[\s\S]{0,120}beta/.test(workflow));
t(
  "the beta release stays the `latest` channel so stable links keep working",
  /latest/.test(workflow) && !/--prerelease/.test(workflow)
);
t("README labels the download section as a beta / preview", /বিটা|Beta|BETA/.test(readme));

console.log("=== README / updater contract is unchanged ===");
for (const name of CANONICAL) {
  t(`README links ${name}`, readme.includes(`/releases/latest/download/${name}`));
}
t("README has no stale lowercase portable asset", !/latest\/download\/VaultZero-Windows-x64-portable\.exe/.test(readme));

console.log("=== Android updater never installs a Windows .exe (V-73) ===");
const androidBranch = updater.match(/if \(platform === "android"\)[\s\S]{0,500}?\}/);
t("android branch exists", !!androidBranch);
if (androidBranch) {
  t("android returns the APK only", /return info\.androidAsset\s*;/.test(androidBranch[0]));
  t("android has no .exe fallback", !/installerAsset|portableAsset/.test(androidBranch[0]));
}
t("Windows/desktop still prefers the NSIS installer", /installerAsset \|\| info\.portableAsset/.test(updater));

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
