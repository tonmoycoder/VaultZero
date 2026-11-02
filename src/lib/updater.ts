/**
 * Data-Safe Auto-Updater Engine for VaultZero
 * Queries GitHub official releases API, compares semantic versions,
 * creates emergency pre-update safety snapshots, and guides seamless binary installation.
 */

import { APP_VERSION } from "./version";

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
 * Checks for the latest release on GitHub with explicit status reporting.
 * Uses cache-busting timestamp and application/vnd.github+json header.
 */
export async function checkReleaseStatus(): Promise<CheckReleaseStatus> {
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
      if (key && key.startsWith("vaultzero_pre_update_backup_")) stale.push(key);
    }
    for (const key of stale) window.localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable (private mode, quota exhausted). The
    // backup itself is best-effort and must never block the update.
  }

  if (!raw) return "";

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupKey = `vaultzero_pre_update_backup_${ts}`;

  try {
    window.localStorage.setItem(backupKey, raw);
    window.localStorage.setItem(PRE_UPDATE_BACKUP_KEY, raw);
    // Also save duplicate into sessionStorage for instant restoration if needed
    window.sessionStorage.setItem("vaultzero_pre_update_backup", raw);

    // The timestamped key above is only a human-readable handle; keeping it
    // would re-introduce the unbounded growth this function exists to
    // prevent. The canonical key is the real snapshot.
    window.localStorage.removeItem(backupKey);
  } catch {
    // A quota error must not prevent the update from being offered.
  }

  return backupKey;
}

