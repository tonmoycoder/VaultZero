export const APP_VERSION = "2.5.2";
export const APP_NAME = "VaultZero";
export const APP_CODENAME = "ColorOS 17 Living Flow Edition";
export const REPO_OWNER = "tonmoycoder";
export const REPO_NAME = "VaultZero";

/**
 * Compare semantic versions (SemVer 2.0.0, including prereleases).
 * Returns 1 / -1 / 0. A prerelease sorts BELOW its release, numeric
 * identifiers compare numerically, and build metadata is ignored.
 */
export function compareSemver(a: string, b: string): number {
  const parse = (raw: string) => {
    const clean = raw.replace(/^v/i, "").trim().replace(/\+.*$/, "");
    const [core, pre] = clean.split("-", 2);
    const nums = core.split(".").map((n) => parseInt(n, 10) || 0);
    return { nums: [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0], pre: pre ? pre.split(".") : [] };
  };
  const A = parse(a);
  const B = parse(b);
  for (let i = 0; i < 3; i++) {
    if (A.nums[i] !== B.nums[i]) return A.nums[i] > B.nums[i] ? 1 : -1;
  }
  if (!A.pre.length && !B.pre.length) return 0;
  if (!A.pre.length) return 1;
  if (!B.pre.length) return -1;
  for (let i = 0; i < Math.max(A.pre.length, B.pre.length); i++) {
    const x = A.pre[i];
    const y = B.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny) return Number(x) > Number(y) ? 1 : -1;
    if (nx) return -1;
    if (ny) return 1;
    return x > y ? 1 : -1;
  }
  return 0;
}

