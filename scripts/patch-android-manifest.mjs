// V-75: inject the committed Android permission overlay into Tauri's
// GENERATED manifest. `tauri android init` creates gen/android at build time
// and that directory is not committed, so shipping permissions requires an
// explicit, fail-closed patch step in the release workflow.
//
// Without android.permission.CAMERA the Android WebView denies getUserMedia
// immediately and the QR scanner shows "Permission denied" forever. Without
// the Wi-Fi/LAN permissions the opt-in P2P host cannot bind a socket.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OVERLAY = join(ROOT, "src-tauri", "android", "AndroidManifest.xml");
const GENERATED = join(ROOT, "src-tauri", "gen", "android", "app", "src", "main", "AndroidManifest.xml");

for (const [label, path] of [["overlay", OVERLAY], ["generated manifest", GENERATED]]) {
  if (!existsSync(path)) {
    console.error(`[android-manifest] missing ${label}: ${path}`);
    console.error("[android-manifest] run `npx tauri android init --ci` first. Refusing to build an APK without permissions.");
    process.exit(1);
  }
}

const overlay = readFileSync(OVERLAY, "utf8");
let manifest = readFileSync(GENERATED, "utf8");

const permissions = [...overlay.matchAll(/<uses-permission\s+android:name="([^"]+)"\s*\/>/g)].map((m) => m[1]);
if (permissions.length === 0) {
  console.error("[android-manifest] overlay declares no permissions — refusing to continue.");
  process.exit(1);
}

// V-84: <uses-feature> tags are injected verbatim from the overlay, so a
// camera-less device is never filtered out of the Play Store listing.
const featureTags = [...overlay.matchAll(/<uses-feature\b[^>]*\/>/g)].map((m) => m[0]);
const featureNames = featureTags
  .map((tag) => /android:name="([^"]+)"/.exec(tag)?.[1])
  .filter(Boolean);

const missingPermissions = permissions.filter((p) => !manifest.includes(`android:name="${p}"`));
const missingFeatures = featureTags.filter((tag) => {
  const name = /android:name="([^"]+)"/.exec(tag)?.[1];
  return name && !manifest.includes(`android:name="${name}"`);
});
const additions = [
  ...missingPermissions.map((p) => `    <uses-permission android:name="${p}" />`),
  ...missingFeatures.map((tag) => `    ${tag}`),
];
if (additions.length) {
  const block = additions.join("\n");
  if (!/<manifest[^>]*>/.test(manifest)) {
    console.error("[android-manifest] generated manifest has no <manifest> root — cannot inject.");
    process.exit(1);
  }
  manifest = manifest.replace(/(<manifest[^>]*>)/, `$1\n${block}`);
}

// Local LAN P2P uses plain HTTP; Android 9+ blocks cleartext by default.
// Tauri's generated manifest includes `android:usesCleartextTraffic="${usesCleartextTraffic}"`.
// Replacing it prevents duplicate attribute errors in ManifestMerger2.
if (/android:usesCleartextTraffic="[^"]*"/.test(manifest)) {
  manifest = manifest.replace(
    /android:usesCleartextTraffic="[^"]*"/,
    'android:usesCleartextTraffic="true"'
  );
} else if (/<application\b[^>]*>/.test(manifest)) {
  manifest = manifest.replace(/<application\b[^>]*>/, (tag) => {
    const selfClosing = /\/>$/.test(tag);
    const attrs = tag.replace(/^<application\b/, "").replace(/\s*\/?>$/, "").trimEnd();
    return `<application${attrs} android:usesCleartextTraffic="true"${selfClosing ? " />" : ">"}`;
  });
} else {
  console.error("[android-manifest] generated manifest has no <application> element — cannot enable LAN P2P.");
  process.exit(1);
}

writeFileSync(GENERATED, manifest, "utf8");

// Verify the write: never publish an APK whose permissions we only *hoped* to add.
const verified = readFileSync(GENERATED, "utf8");
for (const p of [...permissions, ...featureNames]) {
  if (!verified.includes(`android:name="${p}"`)) {
    console.error(`[android-manifest] verification failed: ${p} is missing.`);
    process.exit(1);
  }
}
if (!verified.includes('android:usesCleartextTraffic="true"')) {
  console.error("[android-manifest] verification failed: cleartext LAN traffic is still blocked.");
  process.exit(1);
}

console.log(`[android-manifest] OK — ${permissions.length} permissions + ${featureNames.length} optional features + cleartext LAN enabled (${additions.length} newly injected).`);
