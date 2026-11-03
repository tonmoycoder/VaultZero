// V-63 / V-64 / V-65: the downloadable asset contract is a single source
// of truth shared by the release workflow, README and in-app updater.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const readme = read("README.md");
const workflow = read(".github/workflows/release.yml");
const updater = read("src/lib/updater.ts");
const rust = read("src-tauri/src/lib.rs");
const conf = read("src-tauri/tauri.conf.json");
const app = read("src/App.tsx");
const updateModal = read("src/components/UpdateModal.tsx");
const updateBanner = read("src/components/UpdateBanner.tsx");

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

const STABLE = [
  "VaultZero-Windows-x64-Setup.exe",
  "VaultZero-Windows-x64-Portable.exe",
  "VaultZero-Windows-x64.msi",
  "VaultZero-Android.apk",
  "SHA256SUMS.txt",
];

console.log("=== README -> latest release direct links ===");
for (const name of STABLE) {
  t(`README links ${name}`, readme.includes(`/releases/latest/download/${name}`));
}
t("README no longer advertises the non-existent zip", !readme.includes("VaultZero-Android-Mobile-Bundle.zip"));

console.log("=== release workflow emits the same names ===");
for (const name of STABLE) {
  t(`workflow emits ${name}`, workflow.includes(name));
}
t("NSIS -> stable Setup.exe", /Copy-Item \$nsis\.FullName[\s\S]{0,180}VaultZero-Windows-x64-Setup\.exe/.test(workflow));
t("portable -> stable Portable.exe", /Copy-Item \$portable[\s\S]{0,180}VaultZero-Windows-x64-Portable\.exe/.test(workflow));
t("Android -> stable APK", workflow.includes("--out release-assets-android/VaultZero-Android.apk"));
t("no hardcoded versioned APK name", !workflow.includes("VaultZero-v2.5.2-Android-arm64.apk"));

console.log("=== fail-closed build (no swallowed failures) ===");
t("Android init is not swallowed", !/tauri android init[^\n]*\|\| true/.test(workflow));
t("Android build is not swallowed", !/tauri android build[^\n]*\|\| true/.test(workflow));
t("missing APK fails the job", workflow.includes("No Android APK was produced"));
t("missing signing secrets fail the job", workflow.includes("Android signing secrets are not configured"));
t("upload failure is not swallowed", !/gh release upload[^\n]*\|\| true/.test(workflow));
t("APK is verified after signing", /apksigner[^\n]*verify/.test(workflow));
t("Windows job fails if no installer", workflow.includes("NSIS installer was not produced"));
t("Windows job fails if no portable exe", workflow.includes("Standalone portable .exe was not produced"));

console.log("=== ONE combined checksum manifest ===");
const manifests = (workflow.match(/: > SHA256SUMS\.txt|Set-Content -Path "[^"]*SHA256SUMS\.txt"/g) || []).length;
t("exactly one manifest is written", manifests === 1, `found ${manifests}`);
t("manifest is built after both jobs download", workflow.indexOf("Build ONE Combined Checksum Manifest") > workflow.indexOf("name: Publish to GitHub Releases"));
t("publish verifies the asset contract", workflow.includes("Published release is missing"));
t("updater looks for the same manifest name", /CHECKSUM_MANIFEST_NAME\s*=\s*"SHA256SUMS\.txt"/.test(updater));

console.log("=== updater / native update / data safety ===");
t("updater is platform aware", updater.includes("export function detectUpdatePlatform"));
t("runVerifiedUpdate passes the detected platform", /selectDownloadableAsset\(info, detectUpdatePlatform\(\)\)/.test(updater));
t("Android selector prefers the APK", /platform === "android"[\s\S]{0,160}info\.androidAsset \|\| info\.installerAsset/.test(updater));
t("pre-update snapshot can be restored", updater.includes("export function restorePreUpdateBackupIfNeeded"));
t("snapshot is NOT cleared at startup", !/useEffect\(\(\) => \{\s*clearPreUpdateBackup\(\);\s*\}/.test(app));
t("snapshot is cleared only after a successful unlock", /onUnlocked=\{\(newSession\) => \{[\s\S]{0,220}clearPreUpdateBackup\(\)/.test(app));
for (const [name, source] of [["UpdateModal", updateModal], ["UpdateBanner", updateBanner]]) {
  const snapshotAt = source.indexOf("createPreUpdateBackup()");
  const downloadAt = source.indexOf("runVerifiedUpdate(");
  t(`${name} snapshots BEFORE the download`, snapshotAt !== -1 && downloadAt !== -1 && snapshotAt < downloadAt);
}
t("Windows restarts after the installer exits", rust.includes("handle.restart()") && rust.includes('arg("/wait")'));
t("Android has no xdg-open attempt", rust.includes('#[cfg(target_os = "android")]'));

console.log("=== CSP permits the update endpoints ===");
for (const host of ["https://api.github.com", "https://github.com", "https://objects.githubusercontent.com"]) {
  t(`CSP allows ${host}`, conf.includes(host));
}

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
