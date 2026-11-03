// V-74: tesseract.js loads its worker script and WASM core from
// cdn.jsdelivr.net by default. VaultZero is air-gapped, so on Android the
// OCR spinner stalled forever at "loading tesseract core" with no error.
//
// This script copies the exact worker + LSTM cores out of the pinned npm
// packages into public/tesseract at build/dev time. The output is gitignored:
// large binaries stay OUT of Git but are always present in dist/. `oem: 1`
// (LSTM only) means only the two -lstm variants are needed; SIMD detection
// in tesseract.js picks between them at runtime.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "tesseract");
const CORE = join(ROOT, "node_modules", "tesseract.js-core");
const WORKER = join(ROOT, "node_modules", "tesseract.js", "dist", "worker.min.js");

const REQUIRED = [
  WORKER,
  join(CORE, "tesseract-core-simd-lstm.wasm.js"),
  join(CORE, "tesseract-core-simd-lstm.wasm"),
  join(CORE, "tesseract-core-lstm.wasm.js"),
  join(CORE, "tesseract-core-lstm.wasm"),
];

for (const src of REQUIRED) {
  if (!existsSync(src) || statSync(src).size === 0) {
    console.error(`[tesseract] missing dependency asset: ${src}`);
    console.error("[tesseract] run `npm ci` before building — refusing to ship an offline OCR that cannot start.");
    process.exit(1);
  }
}

mkdirSync(OUT, { recursive: true });
// V-80: `join()` uses backslashes on Windows, so splitting on "/" would make
// the ENTIRE absolute path the destination filename (CI job 126186571526
// failed with ENOENT). `basename()` is separator-aware on the host OS.
for (const src of REQUIRED) copyFileSync(src, join(OUT, basename(src)));

// Fail closed: the OCR engine must never silently fall back to a CDN.
for (const src of REQUIRED) {
  const dest = join(OUT, basename(src));
  if (!existsSync(dest) || statSync(dest).size !== statSync(src).size) {
    console.error(`[tesseract] copy verification failed for ${dest}`);
    process.exit(1);
  }
}

const files = readdirSync(OUT).sort();
console.log(`[tesseract] ${files.length} offline assets ready in public/tesseract:`);
for (const f of files) console.log(`  ${f} (${(statSync(join(OUT, f)).size / 1024).toFixed(0)} KiB)`);
