/**
 * Builds the browserless test bundles used by the `tests/harness` suites.
 *
 * The harnesses import the real source modules, so the bundles must be
 * regenerated whenever `src/lib/storage.ts` (or another module under test)
 * changes. The bundles are plain ESM with the React/DOM dependencies
 * stripped, because the harnesses only exercise pure logic.
 *
 * Usage: node scripts/build-test-bundles.mjs
 */
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The bundles are written inside the repository (and gitignored) rather
 * than into `/tmp`, because the CI runner is `windows-latest`: a hard-coded
 * POSIX path would resolve to `C:\\tmp` and every harness would fail to
 * import its bundle.
 */
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", ".harness-build");
mkdirSync(OUT, { recursive: true });

const targets = [
  { entry: "src/lib/storage.ts", out: "storage-built.mjs" },
  { entry: "src/lib/breachScanner.ts", out: "breach-built.mjs" },
  { entry: "src/lib/generate.ts", out: "generate-built.mjs" },
  { entry: "src/lib/updater.ts", out: "updater-built.mjs" },
  { entry: "src/lib/vault.ts", out: "vault-built.mjs" },
  { entry: "src/lib/wordlist.ts", out: "wordlist-built.mjs" },
  { entry: "src/lib/url.ts", out: "url-built.mjs" },
  { entry: "src/lib/autoLock.ts", out: "autoLock-built.mjs" },
];

for (const target of targets) {
  await build({
    entryPoints: [target.entry],
    outfile: join(OUT, target.out),
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    mainFields: ["module", "main"],
    conditions: ["import", "default"],
    logLevel: "error",
    // `hash-wasm` is bundled in so the dynamic import inside
    // `src/lib/storage.ts` resolves inside the single output file.
    // React/Framer/Phosphor are not used by the pure-logic harnesses.
    external: ["tesseract.js", "@phosphor-icons/react", "framer-motion", "react", "react-dom"],
  });
  console.log(`built ${target.out}`);
}
