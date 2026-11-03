// V-63: the updater must never offer a Windows .exe to an Android install.
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const BUNDLE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".harness-build") + "/";
const m = await import(pathToFileURL(join(BUNDLE_DIR, "updater-built.mjs")).href);

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

const info = {
  installerAsset: { name: "VaultZero-Windows-x64-Setup.exe", browser_download_url: "https://github.com/tonmoycoder/VaultZero/releases/download/v1/VaultZero-Windows-x64-Setup.exe", size: 10 },
  portableAsset: { name: "VaultZero-Windows-x64-Portable.exe", browser_download_url: "https://github.com/tonmoycoder/VaultZero/releases/download/v1/VaultZero-Windows-x64-Portable.exe", size: 10 },
  androidAsset: { name: "VaultZero-Android.apk", browser_download_url: "https://github.com/tonmoycoder/VaultZero/releases/download/v1/VaultZero-Android.apk", size: 10 },
  manifestAsset: { name: "SHA256SUMS.txt", browser_download_url: "https://github.com/tonmoycoder/VaultZero/releases/download/v1/SHA256SUMS.txt", size: 10 },
};

console.log("=== platform detection ===");
t("Android UA -> android", m.detectUpdatePlatform("Mozilla/5.0 (Linux; Android 14; ColorOS) AppleWebKit/537.36") === "android");
t("Windows UA -> windows", m.detectUpdatePlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)") === "windows");
t("macOS UA -> desktop", m.detectUpdatePlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)") === "desktop");
t("explicit UA overrides the ambient navigator", m.detectUpdatePlatform("Android") === "android");

console.log("=== asset selection ===");
t("android picks the APK", m.selectDownloadableAsset(info, "android")?.name === "VaultZero-Android.apk");
t("windows picks the NSIS installer", m.selectDownloadableAsset(info, "windows")?.name === "VaultZero-Windows-x64-Setup.exe");
t("desktop picks the NSIS installer", m.selectDownloadableAsset(info, "desktop")?.name === "VaultZero-Windows-x64-Setup.exe");
t("browser (legacy default) picks the NSIS installer", m.selectDownloadableAsset(info)?.name === "VaultZero-Windows-x64-Setup.exe");
// V-73: Android must NEVER silently receive a Windows .exe. A release that
// publishes no signed APK has to fail closed with a clear diagnostic instead.
t("missing APK fails closed (no .exe fallback)", m.selectDownloadableAsset({ ...info, androidAsset: undefined }, "android") === undefined);
t("null info is safe", m.selectDownloadableAsset(null, "android") === undefined);

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
