// V-75 / V-78 / V-79: Android runtime readiness. The generated Tauri
// Android project (`src-tauri/gen/android`) is NOT committed — it is created
// by `tauri android init` in CI. Without a committed manifest overlay and a
// patch step, the APK ships with no CAMERA / LAN permissions, so getUserMedia
// is denied and LAN P2P cannot bind. This guard checks the whole contract.
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const readBuf = (rel) => readFileSync(join(ROOT, rel));
const has = (rel) => existsSync(join(ROOT, rel));

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

const manifestRel = "src-tauri/android/AndroidManifest.xml";
const patchRel = "scripts/patch-android-manifest.mjs";
const workflow = read(".github/workflows/release.yml");
const syncModal = read("src/components/toolModals.tsx");
const cargo = read("src-tauri/Cargo.toml");
const readme = read("README.md");
const patch = read(patchRel);

console.log("=== positive control ===");
t("detects a manifest without CAMERA", !/android\.permission\.CAMERA/.test('<manifest xmlns:android="http://schemas.android.com/apk/res/android"></manifest>'));
t("accepts a manifest with CAMERA", /android\.permission\.CAMERA/.test('<uses-permission android:name="android.permission.CAMERA"/>'));

console.log("=== Android manifest overlay ===");
t("manifest overlay exists", has(manifestRel));
if (has(manifestRel)) {
  const m = read(manifestRel);
  for (const perm of [
    "android.permission.CAMERA",
    "android.permission.INTERNET",
    "android.permission.ACCESS_NETWORK_STATE",
    "android.permission.ACCESS_WIFI_STATE",
    "android.permission.CHANGE_WIFI_MULTICAST_STATE",
  ]) {
    t(`declares ${perm}`, m.includes(perm));
  }
  t("allows local cleartext LAN traffic for P2P", /usesCleartextTraffic="true"/.test(m));
  t("no exported debug activity", !/android:exported="true"/.test(m));
}

console.log("=== camera is optional hardware, not a Play Store filter (V-84) ===");
t("detects a manifest with no uses-feature", !/uses-feature/.test('<manifest xmlns:android="http://schemas.android.com/apk/res/android"></manifest>'));
t("declares the camera as optional hardware", /<uses-feature[^>]*android\.hardware\.camera[^>]*required="false"/.test(read(manifestRel)));
t("the patch step injects uses-feature into the GENERATED manifest", /uses-feature/.test(patch));
t("the patch step verifies the injected feature fail-closed", /featureNames/.test(patch) && /verification failed/.test(patch));

console.log("=== CI injects the overlay ===");
t("patch script exists", has(patchRel));
t("release workflow runs the manifest patch", /patch-android-manifest\.mjs/.test(workflow));
t("patch runs AFTER tauri android init", workflow.indexOf("tauri android init") < workflow.indexOf("patch-android-manifest.mjs"));
t("patch runs BEFORE the APK build", workflow.indexOf("patch-android-manifest.mjs") < workflow.indexOf("tauri android build"));
t("workflow fails closed on patch failure", !/patch-android-manifest[^\n]*\|\| true/.test(workflow));

console.log("=== camera UX ===");
t(
  "camera is NOT auto-started on mount (Android needs a user gesture)",
  !/if\s*\(tab !== "scan"[\s\S]{0,220}startCamera\(\)/.test(syncModal)
);
t("camera start requires an explicit click", /onClick=[\s\S]{0,80}startCamera|onClick=\{startCamera\}/.test(syncModal));
t("camera has a bounded timeout / no infinite hang", /AbortController|setTimeout|timeout|Promise\.race/.test(syncModal));
t("scanner loop checks cameraActive before decoding", /cameraActive/.test(syncModal));

console.log("=== tokio dependency diet (V-78) ===");
t(
  "tokio no longer pulls features = [\"full\"]",
  !/tokio\s*=\s*\{[^}]*features\s*=\s*\[[^\]]*"full"/.test(cargo)
);
t(
  "tokio still declares the features the LAN host uses",
  /tokio\s*=\s*\{[^}]*"rt-multi-thread"/.test(cargo) && /"net"/.test(cargo) && /"sync"/.test(cargo) && /"time"/.test(cargo) && /"io-util"/.test(cargo) && /"macros"/.test(cargo)
);
t("air-seal scope unchanged: vault-core has no tokio", !/tokio/.test(read("crates/vault-core/Cargo.toml")));

console.log("=== icon parity (V-79) ===");
const hash = (rel) => createHash("md5").update(readBuf(rel)).digest("hex");
const webLogo = hash("public/vaultzero-logo.png");
t("Windows/icon source is the web logo", webLogo === hash("src-tauri/icons/icon.png"));
t("ICO exists for the .exe / NSIS installer", has("src-tauri/icons/icon.ico"));
t("bundle icon list includes the ICO", /icon\.ico/.test(read("src-tauri/tauri.conf.json")));
t("release workflow regenerates Android launcher icons from the same source", /tauri icon/.test(workflow) && /vaultzero-logo\.png|icon\.png/.test(workflow));

console.log("=== Windows NSIS installer branding (README logo complaint) ===");
const conf = read("src-tauri/tauri.conf.json");
t("NSIS installer icon is configured", /installerIcon/.test(conf) && /icon\.ico/.test(conf));
t("NSIS header bitmap is configured", /headerImage/.test(conf) && /nsis-header\.bmp/.test(conf));
t("NSIS sidebar bitmap is configured", /sidebarImage/.test(conf) && /nsis-sidebar\.bmp/.test(conf));
t("header bitmap exists", has("src-tauri/icons/nsis-header.bmp"));
t("sidebar bitmap exists", has("src-tauri/icons/nsis-sidebar.bmp"));
t("README logo is a Markdown image (GitHub-safe)", /!\[VaultZero Official Logo\]\(\.\/public\/vaultzero-logo\.png\)/.test(readme));
t("README no longer claims an unmeasured 120fps", !/১২০fps|120 ?fps/i.test(readme));

console.log("=== V-84: the patch actually runs on a SELF-CLOSING <application/> ===");
const genDir = join(ROOT, "src-tauri", "gen");
const genPath = join(genDir, "android", "app", "src", "main", "AndroidManifest.xml");
try {
  mkdirSync(dirname(genPath), { recursive: true });
  writeFileSync(
    genPath,
    '<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n    <application android:label="VaultZero" />\n</manifest>\n',
    "utf8"
  );
  const run = () =>
    execFileSync(process.execPath, [join(ROOT, "scripts", "patch-android-manifest.mjs")], {
      cwd: ROOT,
      encoding: "utf8",
    });
  run();
  const out = readFileSync(genPath, "utf8");
  t("positive control: a self-closing tag is detected", /<application[^>]*\/>/.test('<application android:label="VaultZero" />'));
  t(
    "cleartext injection keeps the application tag well-formed",
    !/<application[^>]*\s\/\s+android:/.test(out),
    (out.split("\n").find((l) => l.includes("<application")) || "").trim()
  );
  t("the cleartext attribute is really present", /<application[^>]*android:usesCleartextTraffic="true"/.test(out));
  t("self-closing form is preserved", /<application[^>]*\/>/.test(out));
  t("camera feature is injected into the generated manifest", /uses-feature[^>]*required="false"/.test(out));
  t("a second run injects nothing (idempotent)", /0 newly injected/.test(run()));
} catch (err) {
  t("patch step executes without throwing", false, err.message);
} finally {
  rmSync(genDir, { recursive: true, force: true });
}

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
