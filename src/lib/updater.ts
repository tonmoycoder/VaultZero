/**
 * Data-Safe Auto-Updater Engine for VaultZero
 * Queries GitHub official releases API, compares semantic versions,
 * creates emergency pre-update safety snapshots, and guides seamless binary installation.
 */

import { APP_VERSION } from "./version";

export const CURRENT_APP_VERSION = APP_VERSION;
export const GITHUB_REPO = "tonmoycoder/VaultZero";

export interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
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

/**
 * Creates an emergency pre-update snapshot of the encrypted database.
 * Preserves full data security before performing software replacement.
 */
export function createPreUpdateBackup(): string {
  if (typeof window === "undefined") return "";
  const v3Key = "vaultzero_encrypted_vault_v2";
  const raw = window.localStorage.getItem(v3Key);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupKey = `vaultzero_pre_update_backup_${ts}`;

  if (raw) {
    window.localStorage.setItem(backupKey, raw);
    window.localStorage.setItem("pre-update-backup.pmv", raw);
    // Also save duplicate into sessionStorage for instant restoration if needed
    window.sessionStorage.setItem("vaultzero_pre_update_backup", raw);
  }

  return backupKey;
}

