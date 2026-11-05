// V-84: beta tags must not break the auto-updater.
// Two different comparators existed (`src/lib/version.ts` and
// `src/lib/updater.ts`); both ignored SemVer prerelease ordering. This guard
// runs the REAL bundled updater, not a reimplementation.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const m = await import(pathToFileURL(join(ROOT, ".harness-build", "updater-built.mjs")).href);

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

console.log("=== positive control: the detector is not a stub ===");
t("a newer core wins", m.compareSemver("2.6.0", "2.5.2") > 0);
t("an older core loses", m.compareSemver("2.4.0", "2.5.2") < 0);

console.log("=== SemVer 2.0.0 prerelease ordering ===");
t("beta.2 > beta.1", m.compareSemver("v2.6.0-beta.2", "v2.6.0-beta.1") > 0);
t("stable > its own beta", m.compareSemver("2.6.0", "2.6.0-beta.1") > 0);
t("beta < stable", m.compareSemver("2.6.0-beta.1", "2.6.0") < 0);
t("rc > beta at the same core", m.compareSemver("2.6.0-rc.1", "2.6.0-beta.9") > 0);
t("numeric prerelease ids compare numerically", m.compareSemver("2.6.0-beta.10", "2.6.0-beta.2") > 0);
t("build metadata is ignored", m.compareSemver("2.6.0+build.2", "2.6.0+build.1") === 0);
t("the same beta tag with/without v is equal", m.compareSemver("v2.6.0-beta.1", "2.6.0-beta.1") === 0);
t("a beta is newer than 2.5.2", m.isNewerVersion("v2.6.0-beta.1", "2.5.2") === true);
t("a beta is NOT newer than its own stable core", m.isNewerVersion("2.6.0-beta.1", "2.6.0") === false);

console.log("=== one comparator, one source of truth (DRY) ===");
const updater = read("src/lib/updater.ts");
const version = read("src/lib/version.ts");
t("updater.ts does not duplicate compareSemver", !/function compareSemver/.test(updater));
t("updater.ts re-exports the shared comparator", /export\s*\{\s*compareSemver\s*\}/.test(updater) && /import\s*\{[^}]*compareSemver[^}]*\}\s*from\s*"\.\/version"/.test(updater));
t("the shared comparator lives in version.ts", /export function compareSemver/.test(version));

console.log("=== version sync (no downgrade, no drift) ===");
const pkg = JSON.parse(read("package.json")).version;
const conf = JSON.parse(read("src-tauri/tauri.conf.json")).version;
const cargo = /^version\s*=\s*"([^"]+)"/m.exec(read("src-tauri/Cargo.toml"))?.[1];
const app = /\bAPP_VERSION\s*=\s*"([^"]+)"/.exec(version)?.[1];
t("package.json == tauri.conf.json == Cargo.toml == APP_VERSION", pkg === conf && conf === cargo && cargo === app, `${pkg}/${conf}/${cargo}/${app}`);
t("no downgrade to v2.5.0", pkg !== "2.5.0");

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
