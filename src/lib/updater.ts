/**
 * Data-Safe Auto-Updater Engine for VaultZero
 * Queries GitHub official releases API, compares semantic versions,
 * creates emergency pre-update safety snapshots, and guides seamless binary installation.
 */

export const CURRENT_APP_VERSION = "2.4.0";
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

/**
 * Checks for the latest release on GitHub.
 * Fallbacks cleanly without breaking if offline or air-gapped.
 */
export async function checkForUpdates(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`GitHub API returned status ${res.status}`);
    }

    const data = await res.json();
    const tagName = data.tag_name || "";
    const cleanVersion = tagName.replace(/^v/i, "");

    if (!isNewerVersion(cleanVersion, CURRENT_APP_VERSION)) {
      return null;
    }

    const assets: GitHubAsset[] = Array.isArray(data.assets)
      ? data.assets.map((a: any) => ({
          name: a.name,
          browser_download_url: a.browser_download_url,
          size: a.size,
        }))
      : [];

    const installerAsset = assets.find(
      (a) => a.name.includes("Setup.exe") || a.name.includes("Installer")
    );
    const portableAsset = assets.find(
      (a) => a.name.includes("Portable.zip") || a.name.includes("Portable.exe")
    );
    const androidAsset = assets.find((a) => a.name.includes(".apk") || a.name.includes("Android"));

    return {
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
  } catch (err) {
    // Air-gapped / offline environment fail-open
    console.debug("Updater note (air-gapped check):", err);
    return null;
  }
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
    // Also save duplicate into sessionStorage for instant restoration if needed
    window.sessionStorage.setItem("vaultzero_pre_update_backup", raw);
  }

  return backupKey;
}
