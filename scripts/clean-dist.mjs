/**
 * Removes the build output directory before a production build.
 *
 * Vite does not always empty `outDir` when it sits outside the project
 * root, and a stale chunk that survives a rebuild is worse than no chunk
 * at all: the verification harness then scans a mixture of old and new
 * artifacts and reports a failure that does not correspond to the current
 * source.
 *
 * Usage: node scripts/clean-dist.mjs
 */
import { rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

if (existsSync(dist)) {
  // On Windows a file can still be held open by an antivirus scanner or a
  // stray process, and `rmSync` then fails with EPERM. Retrying briefly
  // turns a flaky build into a reliable one.
  let removed = false;
  for (let attempt = 0; attempt < 5 && !removed; attempt += 1) {
    try {
      rmSync(dist, { recursive: true, force: true });
      removed = true;
    } catch (err) {
      if (attempt === 4) throw err;
      // Busy-wait briefly; this is a build step, not a hot path.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
    }
  }
  console.log(`Removed ${dist}`);
}
