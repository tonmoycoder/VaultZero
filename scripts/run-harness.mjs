/**
 * Runs every browserless verification harness in `tests/harness/`.
 *
 * The harnesses exercise the pure-logic parts of the app (storage, KDF,
 * updater, breach scanner, URL sanitiser) without needing a browser, so
 * they can run on any CI machine — including one where the Playwright
 * browser download is blocked.
 *
 * Usage: node scripts/run-harness.mjs
 */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const harnessDir = join(root, "tests", "harness");

const files = readdirSync(harnessDir)
  .filter((f) => f.endsWith(".test.mjs"))
  .sort();

let failed = 0;
let passed = 0;

for (const file of files) {
  const name = file.replace(/\.test\.mjs$/, "");
  process.stdout.write(`\n=== ${name} ===\n`);
  const result = spawnSync(process.execPath, [join(harnessDir, file)], {
    stdio: "inherit",
    cwd: root,
  });
  if (result.status === 0) {
    passed += 1;
  } else {
    failed += 1;
  }
}

console.log(`\n${passed} harness files passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
