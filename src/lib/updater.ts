/**
 * Data-Safe Auto-Updater Engine for VaultZero
 * Queries GitHub official releases API, compares semantic versions,
 * creates emergency pre-update safety snapshots, and guides seamless binary installation.
 */

import { APP_VERSION } from "./version";
import { invokeTauri, isTauri, VAULT_STORAGE_KEY } from "./vault";

export const CURRENT_APP_VERSION = APP_VERSION;
export const GITHUB_REPO = "tonmoycoder/VaultZero";

/**
 * SECURITY (V-32): the only host an update may be served from.
 *
 * The updater reads the release metadata from the GitHub API and then hands
 * the asset URL straight to the browser. The URL came from the API
 * *response*, so a compromised or spoofed response could point the user at
 * any host on the internet and the app would open it without complaint.
 */
export const TRUSTED_DOWNLOAD_HOSTS = ["github.com", "objects.githubusercontent.com"];

/**
 * Returns true when `url` is an HTTPS URL on a trusted release host.
 *
 * A release asset must live under
 * `https://github.com/<owner>/<repo>/releases/download/<tag>/<asset>`.
 */
export function isTrustedDownloadUrl(url: string, repo: string = GITHUB_REPO): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;
  if (!TRUSTED_DOWNLOAD_HOSTS.includes(parsed.hostname.toLowerCase())) return false;

  // The path must be a release-asset path for this repository. The
  // `objects.githubusercontent.com` host serves the redirect target for the
  // same path, so the same prefix check applies.
  const expectedPrefix = `/${repo}/releases/download/`;
  if (!parsed.pathname.startsWith(expectedPrefix)) return false;

  return true;
}

/**
 * SECURITY (V-32): the SHA-256 checksum published alongside a release.
 *
 * The release pipeline writes a `SHA256SUMS.txt` next to the artifacts, but
 * nothing ever verified it — the README advertised checksums that were
 * never checked. `verifyChecksum` is the function that makes the claim true.
 */
export async function verifyChecksum(
  assetUrl: string,
  expectedSha256: string
): Promise<{ ok: boolean; reason?: string; actualSha256?: string }> {
  if (!/^[0-9a-f]{64}$/i.test(expectedSha256.trim())) {
    return { ok: false, reason: "The published checksum is not a valid SHA-256 digest." };
  }
  try {
    const res = await fetch(assetUrl);
    if (!res.ok) return { ok: false, reason: `Could not download the artifact (HTTP ${res.status}).` };
    const buffer = await res.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (hex.toLowerCase() !== expectedSha256.trim().toLowerCase()) {
      return {
        ok: false,
        actualSha256: hex,
        reason: "The downloaded artifact does not match its published checksum.",
      };
    }
    return { ok: true, actualSha256: hex };
  } catch (err: any) {
    return { ok: false, reason: err?.message || "The artifact could not be verified." };
  }
}

/**
 * Extracts the expected SHA-256 for `assetName` from a `SHA256SUMS.txt`
 * body (the format produced by `sha256sum`).
 */
export function parseChecksumManifest(manifest: string, assetName: string): string | null {
  for (const line of manifest.split(/\r?\n/)) {
    const match = line.trim().match(/^([0-9a-f]{64})\s+\*?(.+)$/i);
    if (!match) continue;
    const name = match[2].trim();
    if (name === assetName || name.endsWith(`/${assetName}`)) {
      return match[1];
    }
  }
  return null;
}

export interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

/**
 * SECURITY (V-32): the release pipeline publishes a `SHA256SUMS.txt`
 * alongside every artifact. The name of that manifest is part of the
 * release contract, so it is a constant rather than a guess.
 */
export const CHECKSUM_MANIFEST_NAME = "SHA256SUMS.txt";

export interface ArtifactVerification {
  ok: boolean;
  /** The digest the artifact was checked against, when one was found. */
  expectedSha256?: string;
  /** The digest that was actually computed from the downloaded bytes. */
  actualSha256?: string;
  reason?: string;
}

/**
 * SECURITY (V-32): verifies a release artifact end to end.
 *
 * The previous implementation exposed `verifyChecksum` and
 * `parseChecksumManifest` but never called them, so the checksum claim in
 * the README was never actually enforced. This function wires the whole
 * chain together and is the only path the UI is allowed to use:
 *
 *   1. locate the checksum manifest asset of the same release,
 *   2. fetch it and parse the expected digest for the artifact,
 *   3. download the artifact,
 *   4. compute its SHA-256 and compare.
 *
 * Every failure mode is fatal: if the manifest is missing, if it does not
 * contain an entry for the artifact, or if the digests differ, the caller
 * must refuse to hand the file to the user.
 */
export async function verifyReleaseArtifact(
  assets: GitHubAsset[],
  asset: GitHubAsset
): Promise<ArtifactVerification> {
  if (!isTrustedDownloadUrl(asset.browser_download_url)) {
    return { ok: false, reason: "The update link could not be verified — the download was blocked for safety." };
  }

  const manifestAsset = assets.find((a) => a.name === CHECKSUM_MANIFEST_NAME);
  if (!manifestAsset) {
    return {
      ok: false,
      reason: "This release does not publish a checksum manifest, so the download cannot be verified.",
    };
  }
  if (!isTrustedDownloadUrl(manifestAsset.browser_download_url)) {
    return { ok: false, reason: "The checksum manifest is not served from a trusted release URL." };
  }

  let expected: string | null = null;
  try {
    const manifestRes = await fetch(manifestAsset.browser_download_url, { cache: "no-store" });
    if (!manifestRes.ok) {
      return { ok: false, reason: `The checksum manifest could not be downloaded (HTTP ${manifestRes.status}).` };
    }
    expected = parseChecksumManifest(await manifestRes.text(), asset.name);
  } catch (err: any) {
    return { ok: false, reason: err?.message || "The checksum manifest could not be downloaded." };
  }

  if (!expected) {
    return {
      ok: false,
      reason: "The checksum manifest does not list this artifact, so the download cannot be verified.",
    };
  }

  const result = await verifyChecksum(asset.browser_download_url, expected);
  if (!result.ok) {
    return { ok: false, expectedSha256: expected, reason: result.reason };
  }

  return { ok: true, expectedSha256: expected };
}

export interface UpdateInfo {
  version: string;
  tagName: string;
  name: string;
  body: string;
  publishedAt: string;
  htmlUrl: string;
  installerAsset?: GitHubAsset;
  portableAsset?: GitHubAsset;
  androidAsset?: GitHubAsset;
}

/**
 * SECURITY (V-32): picks the artifact that should be offered to the user.
 *
 * The release page (`htmlUrl`) is **not** an artifact. It is a web page that
 * links to several files, so it cannot be checksum-verified and must never
 * be used as a download target.
 */
export type UpdatePlatform = "windows" | "android" | "desktop" | "browser";

/**
 * V-63: an Android install must never be offered a Windows .exe. The old
 * selector always preferred the installer, so the mobile app downloaded a
 * desktop binary and could not install it.
 */
export function detectUpdatePlatform(userAgent?: string): UpdatePlatform {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  if (/android/i.test(ua)) return "android";
  if (/windows/i.test(ua)) return "windows";
  // Classify from the user agent itself, not from whether a `navigator`
  // global happens to exist. Node 20 has no `navigator`, Node 21+ does,
  // and a harness must get the same answer on both.
  return ua ? "desktop" : "browser";
}

export function selectDownloadableAsset(
  info: UpdateInfo | null | undefined,
  platform?: UpdatePlatform
): GitHubAsset | undefined {
  if (!info) return undefined;
  if (platform === "android") {
    // V-73: Android's package installer only accepts a signed APK. A release
    // that publishes no APK must FAIL CLOSED with an explicit diagnostic —
    // it must never silently hand a Windows .exe to an Android device.
    return info.androidAsset;
  }
  if (platform === "windows" || platform === "desktop" || platform === "browser" || platform === undefined) {
    return info.installerAsset || info.portableAsset || info.androidAsset;
  }
  return info.installerAsset || info.portableAsset || info.androidAsset;
}

/**
 * SECURITY (V-32): fetches the asset list of a release.
 *
 * The API response is the only source of the asset URLs, and it is fetched
 * again at download time so that the artifact that is verified is the
 * artifact that is opened.
 */
export async function fetchReleaseAssets(tagName: string): Promise<GitHubAsset[]> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${encodeURIComponent(tagName)}`,
    { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`The release file list could not be retrieved (HTTP ${res.status}).`);
  }
  const data = await res.json();
  if (!Array.isArray(data?.assets)) return [];
  return data.assets.map((a: any) => ({
    name: a.name,
    browser_download_url: a.browser_download_url,
    size: a.size,
  }));
}

export function compareSemver(v1: string, v2: string): number {
  const parse = (v: string) =>
    v
      .replace(/^v/i, "")
      .split(/[-+]/)[0]
      .split(".")
      .map((num) => parseInt(num, 10) || 0);

  const [maj1, min1, pat1] = parse(v1);
  const [maj2, min2, pat2] = parse(v2);

  if (maj1 !== maj2) return maj1 - maj2;
  if (min1 !== min2) return min1 - min2;
  return pat1 - pat2;
}

export function isNewerVersion(candidate: string, current = CURRENT_APP_VERSION): boolean {
  return compareSemver(candidate, current) > 0;
}

export interface CheckReleaseStatus {
  status: "idle" | "checking" | "up_to_date" | "update_available" | "error" | "offline";
  currentVersion: string;
  remoteVersion?: string;
  updateInfo?: UpdateInfo;
  message?: string;
}

/**
 * How long a release check stays fresh.
 *
 * The banner, the modal and the startup notification all want to know
 * whether an update exists. Without a shared cache they made three
 * identical requests to the GitHub API on every start, which is slow and
 * can rate-limit the API for the user.
 */
export const RELEASE_CHECK_TTL_MS = 5 * 60 * 1000;

interface CachedRelease {
  result: CheckReleaseStatus;
  at: number;
}

let cachedRelease: CachedRelease | null = null;
let inFlightCheck: Promise<CheckReleaseStatus> | null = null;

/**
 * Checks for the latest release on GitHub with explicit status reporting.
 * Uses cache-busting timestamp and application/vnd.github+json header.
 *
 * The result is shared: the first caller performs the request and every
 * other caller that arrives while it is running receives the same promise,
 * so the app never issues duplicate release requests for one moment in
 * time. A successful result is then reused for
 * {@link RELEASE_CHECK_TTL_MS}.
 *
 * `force` bypasses the cache — the "Check for Updates" button uses it so
 * the user always gets a fresh answer.
 */
export async function checkReleaseStatus(force = false): Promise<CheckReleaseStatus> {
  if (!force && cachedRelease && Date.now() - cachedRelease.at < RELEASE_CHECK_TTL_MS) {
    return cachedRelease.result;
  }

  if (!force && inFlightCheck) {
    return inFlightCheck;
  }

  const request = fetchLatestRelease();

  if (!force) {
    inFlightCheck = request;
  }

  try {
    const result = await request;
    // Only a definitive answer is cached. A network error or a rate limit
    // must not be remembered for minutes, otherwise a temporary outage
    // would hide a real update.
    if (result.status !== "offline" && result.status !== "error") {
      cachedRelease = { result, at: Date.now() };
    }
    return result;
  } finally {
    if (!force && inFlightCheck === request) {
      inFlightCheck = null;
    }
  }
}

/** Discards the cached release check. */
export function clearReleaseCache(): void {
  cachedRelease = null;
  inFlightCheck = null;
}

/** Performs the actual request against the GitHub releases API. */
async function fetchLatestRelease(): Promise<CheckReleaseStatus> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest?t=${Date.now()}`, {
      headers: {
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 404) {
        return {
          status: "up_to_date",
          currentVersion: CURRENT_APP_VERSION,
          remoteVersion: CURRENT_APP_VERSION,
          message: "No releases found on remote repository.",
        };
      }
      return {
        status: "error",
        currentVersion: CURRENT_APP_VERSION,
        message: `GitHub API returned HTTP status ${res.status}`,
      };
    }

    const data = await res.json();
    const tagName = data.tag_name || "";
    const cleanVersion = tagName.replace(/^v/i, "").trim();

    const assets: GitHubAsset[] = Array.isArray(data.assets)
      ? data.assets.map((a: any) => ({
          name: a.name,
          browser_download_url: a.browser_download_url,
          size: a.size,
        }))
      : [];

    const installerAsset = assets.find(
      (a) => a.name.endsWith(".exe") && (a.name.includes("Setup") || a.name.includes("Installer") || a.name.includes("setup"))
    );
    const portableAsset = assets.find(
      (a) => a.name.includes("portable") || a.name.includes("Portable") || a.name.endsWith(".exe")
    );
    const androidAsset = assets.find((a) => a.name.endsWith(".apk"));

    const updateInfo: UpdateInfo = {
      version: cleanVersion,
      tagName,
      name: data.name || `VaultZero ${tagName}`,
      body: data.body || "",
      publishedAt: data.published_at || new Date().toISOString(),
      htmlUrl: data.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`,
      installerAsset,
      portableAsset,
      androidAsset,
    };

    if (isNewerVersion(cleanVersion, CURRENT_APP_VERSION)) {
      return {
        status: "update_available",
        currentVersion: CURRENT_APP_VERSION,
        remoteVersion: cleanVersion,
        updateInfo,
      };
    }

    return {
      status: "up_to_date",
      currentVersion: CURRENT_APP_VERSION,
      remoteVersion: cleanVersion,
      updateInfo,
    };
  } catch (err: any) {
    return {
      status: "offline",
      currentVersion: CURRENT_APP_VERSION,
      message: err?.message || "Air-gapped / offline environment",
    };
  }
}

/**
 * Checks for the latest release on GitHub.
 * Fallbacks cleanly without breaking if offline or air-gapped.
 */
export async function checkForUpdates(): Promise<UpdateInfo | null> {
  const result = await checkReleaseStatus();
  return result.status === "update_available" ? result.updateInfo ?? null : null;
}

/** The single key that holds the most recent pre-update snapshot. */
export const PRE_UPDATE_BACKUP_KEY = "pre-update-backup.pmv";

/**
 * The key the legacy build used for the same purpose.
 *
 * It is removed after the current snapshot is written so that a vault copy
 * never lingers under a key an older build would look for.
 */
const LEGACY_PRE_UPDATE_BACKUP_KEY = "vaultzero_pre_update_backup";

/**
 * Creates an emergency pre-update snapshot of the encrypted database.
 * Preserves full data security before performing software replacement.
 *
 * SECURITY / STORAGE (V-39): this used to write a **new timestamped key on
 * every single update check** and never removed the old ones. Each snapshot
 * is a full copy of the encrypted vault, so a 200 KB vault checked for
 * updates a hundred times left 20 MB of stale encrypted copies in
 * `localStorage` — enough to exhaust the browser's storage quota and make
 * the app fail to save at all.
 *
 * The snapshot is now a **single** key that is overwritten, and any stale
 * timestamped copies left by an older build are cleaned up on the first run.
 *
 * The function returns the **canonical** key that holds the snapshot. The
 * previous implementation returned a timestamped key it had already
 * deleted, so the UI reported a backup location that did not exist.
 *
 * SECURITY: the snapshot is written to `localStorage` only. An earlier
 * version also copied the encrypted vault into `sessionStorage`, which
 * widened the number of places a vault copy could be read from for no
 * benefit — the snapshot has to survive a restart, and `localStorage`
 * already does that.
 */
export function createPreUpdateBackup(): string {
  if (typeof window === "undefined") return "";

  const v3Key = "vaultzero_encrypted_vault_v2";
  const raw = window.localStorage.getItem(v3Key);

  // Clean up snapshots written by older builds (timestamped keys) **before**
  // writing the new one, so the current snapshot is never removed by its
  // own cleanup pass.
  try {
    const stale: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (key.startsWith("vaultzero_pre_update_backup_")) stale.push(key);
      if (key === LEGACY_PRE_UPDATE_BACKUP_KEY) stale.push(key);
    }
    for (const key of stale) window.localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable (private mode, quota exhausted). The
    // backup itself is best-effort and must never block the update.
  }

  if (!raw) return "";

  try {
    window.localStorage.setItem(PRE_UPDATE_BACKUP_KEY, raw);
  } catch {
    // A quota error must not prevent the update from being offered.
    return "";
  }

  return PRE_UPDATE_BACKUP_KEY;
}

/**
 * Removes the pre-update snapshot once the new build is running.
 *
 * The snapshot exists to make the update recoverable. Keeping it forever
 * leaves a full copy of the encrypted vault in storage that no longer has
 * a purpose, so it is dropped as soon as the application starts.
 */
/**
 * V-63 — update data safety.
 *
 * `createPreUpdateBackup()` copies the encrypted vault container aside
 * before an update. If the update leaves the main container missing or
 * unreadable, put the snapshot back before the app decides the user has no
 * vault. The snapshot is deliberately NOT cleared here: it is removed only
 * after a successful unlock (`App.tsx`).
 */
export function restorePreUpdateBackupIfNeeded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const storage = window.localStorage;
    if (storage.getItem(VAULT_STORAGE_KEY)) return false;
    const backup = storage.getItem(PRE_UPDATE_BACKUP_KEY);
    if (!backup) return false;
    const parsed = JSON.parse(backup);
    if (!parsed || typeof parsed !== "object") return false;
    storage.setItem(VAULT_STORAGE_KEY, backup);
    return true;
  } catch {
    return false;
  }
}

export function clearPreUpdateBackup(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PRE_UPDATE_BACKUP_KEY);
    window.localStorage.removeItem(LEGACY_PRE_UPDATE_BACKUP_KEY);
  } catch {
    // Nothing to do: the snapshot is encrypted and harmless if it lingers.
  }
}

/** The stages a verified download goes through. */
export type UpdateStage =
  | "idle"
  | "snapshot"
  | "resolving"
  | "manifest"
  | "downloading"
  | "verifying"
  | "done"
  | "failed";

export interface UpdateProgress {
  stage: UpdateStage;
  /** 0–100. Meaningful only while the stage is `downloading`. */
  percent: number;
  /** A human-readable reason, present when the stage is `failed`. */
  reason?: string;
}

export interface VerifiedUpdate {
  /**
   * The location the user should open.
   *
   * On a native build this is the absolute path of the file the verified
   * bytes were written to. In a browser it is a `blob:` URL for the
   * verified bytes. Either way it points at the artifact that was hashed
   * — never at the original download URL, which would download the file a
   * second time and hand the user bytes that were never checked.
   */
  url: string;
  /** The SHA-256 the artifact was verified against. */
  sha256: string;
  /** The name the artifact was saved under. */
  fileName: string;
}

/**
 * SECURITY (V-32): the single path an update may take.
 *
 * Two components used to offer an update — a banner and a modal — and only
 * the modal verified the artifact. The banner opened the download URL
 * directly, so the checksum guarantee the README advertises did not hold
 * on the path a user is most likely to take. Both now come through this
 * function, which is fail-closed at every step:
 *
 *   1. pick the artifact — the release page is never a download target,
 *   2. refuse a URL that is not on a trusted host,
 *   3. fetch the release asset list and locate the checksum manifest,
 *   4. download the artifact while reporting the real progress,
 *   5. compare the SHA-256 and refuse on a mismatch.
 *
 * The artifact bytes are downloaded and hashed here. The URL is only
 * handed to the browser after the digest matches, so an unverified file is
 * never offered to the user.
 */
export async function runVerifiedUpdate(
  info: UpdateInfo,
  onProgress?: (progress: UpdateProgress) => void
): Promise<VerifiedUpdate> {
  const report = (progress: UpdateProgress) => onProgress?.(progress);

  report({ stage: "snapshot", percent: 0 });

  const platform = detectUpdatePlatform();
  const asset = selectDownloadableAsset(info, platform);
  if (!asset) {
    const reason =
      platform === "android"
        ? "This release contains no signed Android APK. Open the release page and install VaultZero-Android.apk manually — no unverified file will be installed."
        : "This release does not contain an installer for this platform.";
    report({ stage: "failed", percent: 0, reason });
    throw new Error(reason);
  }

  if (!isTrustedDownloadUrl(asset.browser_download_url)) {
    const reason = "The update link could not be verified — the download was blocked for safety.";
    report({ stage: "failed", percent: 0, reason });
    throw new Error(reason);
  }

  report({ stage: "resolving", percent: 10 });

  let releaseAssets: GitHubAsset[];
  try {
    releaseAssets = await fetchReleaseAssets(info.tagName);
  } catch (error: any) {
    const reason = error?.message || "The release file list could not be retrieved.";
    report({ stage: "failed", percent: 0, reason });
    throw new Error(reason);
  }

  const manifestAsset = releaseAssets.find((a) => a.name === CHECKSUM_MANIFEST_NAME);
  if (!manifestAsset || !isTrustedDownloadUrl(manifestAsset.browser_download_url)) {
    const reason = "This release does not publish a checksum manifest, so the download cannot be verified.";
    report({ stage: "failed", percent: 0, reason });
    throw new Error(reason);
  }

  report({ stage: "manifest", percent: 25 });

  let expected: string | null = null;
  try {
    const manifestRes = await fetch(manifestAsset.browser_download_url, { cache: "no-store" });
    if (!manifestRes.ok) {
      throw new Error(`The checksum manifest could not be downloaded (HTTP ${manifestRes.status}).`);
    }
    expected = parseChecksumManifest(await manifestRes.text(), asset.name);
  } catch (error: any) {
    const reason = error?.message || "The checksum manifest could not be downloaded.";
    report({ stage: "failed", percent: 0, reason });
    throw new Error(reason);
  }

  if (!expected) {
    const reason = "The checksum manifest does not list this artifact, so the download cannot be verified.";
    report({ stage: "failed", percent: 0, reason });
    throw new Error(reason);
  }

  report({ stage: "downloading", percent: 35 });

  // The artifact is streamed so the progress bar reflects the bytes that
  // actually arrived instead of a timer that counts up on its own.
  let actual: string;
  let buffer: Uint8Array<ArrayBuffer>;
  try {
    const res = await fetch(asset.browser_download_url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`The update package could not be downloaded (HTTP ${res.status}).`);
    }

    const total = Number(res.headers.get("content-length") ?? "0") || asset.size || 0;
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        chunks.push(value);
        received += value.byteLength;
        report({
          stage: "downloading",
          percent: total > 0 ? Math.min(85, 35 + Math.round((received / total) * 50)) : 60,
        });
      }
    } else {
      // Some environments do not expose a streaming body; fall back to a
      // single buffered read.
      chunks.push(new Uint8Array(await res.arrayBuffer()));
    }

    buffer = new Uint8Array(new ArrayBuffer(received || chunks[0]?.byteLength || 0));
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }

    report({ stage: "verifying", percent: 90 });

    const hash = await crypto.subtle.digest("SHA-256", buffer);
    actual = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (error: any) {
    const reason = error?.message || "The update package could not be downloaded.";
    report({ stage: "failed", percent: 0, reason });
    throw new Error(reason);
  }

  if (actual.toLowerCase() !== expected.trim().toLowerCase()) {
    const reason = "The downloaded artifact does not match its published checksum.";
    report({ stage: "failed", percent: 0, reason });
    throw new Error(reason);
  }

  report({ stage: "done", percent: 100 });

  /*
   * The verified bytes are what the user has to open.
   *
   * The previous implementation returned the original download URL here,
   * which meant the browser fetched the whole artifact a second time.
   * The file that was hashed and the file that was installed were two
   * separate requests, so the checksum guarantee did not apply to the
   * bytes the user ended up running.
   *
   * On a native build the bytes are handed to the Rust side, which writes
   * them to disk atomically and returns the path. In a browser they are
   * turned into an object URL for the very same bytes. Neither path
   * fetches the artifact again.
   */
  const fileName = asset.name;
  const saved = await saveVerifiedArtifact(fileName, buffer);

  return { url: saved, sha256: expected.trim().toLowerCase(), fileName };
}

/**
 * Writes the verified artifact where the user can open it.
 *
 * The native path writes the bytes to the application's update directory
 * through the `save_update_artifact` command. The browser path creates an
 * object URL for the bytes that were just hashed.
 *
 * If neither is available the download URL is returned as a last resort,
 * and the caller is told about it through the `verifiedBytes` flag so the
 * distinction stays visible in the tests.
 */
async function saveVerifiedArtifact(fileName: string, buffer: Uint8Array): Promise<string> {
  if (isTauri()) {
    try {
      const bytesBase64 = bytesToBase64(buffer);
      const path = await invokeTauri<string>("save_update_artifact", { fileName, bytesBase64 });
      if (typeof path === "string" && path.length > 0) return path;
      // The command did not return a path. Falling back to the URL would
      // hand the user bytes that were never checked, so this is a failure.
      throw new Error("The native update writer did not return a path.");
    } catch (error: any) {
      // The native write failed. Falling back to the URL would hand the
      // user bytes that were never checked, so the download is reported
      // as a failure instead.
      throw new Error(
        error?.message || "The verified update could not be written to disk."
      );
    }
  }

  // Browser fallback: an object URL over the bytes that were hashed.
  // The URL is revoked when the document goes away.
  const blob = new Blob([buffer as unknown as BlobPart], {
    type: "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  window.addEventListener("beforeunload", () => URL.revokeObjectURL(url), { once: true });
  return url;
}

/** Encodes bytes as standard base64 without pulling in a dependency. */
function bytesToBase64(buffer: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < buffer.length; i += chunkSize) {
    binary += String.fromCharCode(...buffer.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Opens the verified artifact.
 *
 * On a native build the Rust side has already handed the file to the
 * operating system, so there is nothing left for the frontend to open —
 * doing it again would launch a second copy of the installer. In a
 * browser the object URL has to be opened explicitly, because a browser
 * cannot start an installer on its own.
 */
export async function openVerifiedUpdate(verified: VerifiedUpdate): Promise<void> {
  if (isTauri()) return;

  const opened = window.open(verified.url, "_blank", "noopener,noreferrer");
  if (!opened) {
    // The pop-up was blocked. The artifact is still on disk as an object
    // URL, so the user can be told what happened instead of the download
    // appearing to have failed.
    throw new Error("The browser blocked the download window. Please allow pop-ups for this site.");
  }
}

