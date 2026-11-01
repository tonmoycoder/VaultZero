export const APP_VERSION = "2.5.0";
export const APP_NAME = "VaultZero";
export const APP_CODENAME = "ColorOS 17 Living Flow Edition";
export const REPO_OWNER = "tonmoycoder";
export const REPO_NAME = "VaultZero";

/**
 * Compare semantic versions.
 * Returns:
 *   1 if a > b
 *  -1 if a < b
 *   0 if a === b
 */
export function compareSemver(a: string, b: string): number {
  const cleanA = a.replace(/^v/i, "").trim();
  const cleanB = b.replace(/^v/i, "").trim();

  const partsA = cleanA.split(".").map((p) => parseInt(p, 10) || 0);
  const partsB = cleanB.split(".").map((p) => parseInt(p, 10) || 0);

  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const valA = partsA[i] ?? 0;
    const valB = partsB[i] ?? 0;
    if (valA > valB) return 1;
    if (valA < valB) return -1;
  }
  return 0;
}

