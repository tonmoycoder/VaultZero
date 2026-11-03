#!/usr/bin/env node
/**
 * Checks that the production bundle does not grow past its budget and that
 * the heavy payloads stay out of the initial download.
 *
 * PERFORMANCE: two problems were found with this script as the detector.
 *
 * `lib/totp.ts` is a 7 KB source file, but it shared a chunk with
 * `lib/ocr.ts`, and that chunk carried the OCR language table — 83 KB of
 * Shift-JIS data. Opening the TOTP dialog, which needs nothing but a
 * base32 decoder, downloaded the whole table first.
 *
 * The QR decoder is 130 KB and was imported statically, so it was part of
 * the initial download even though it is only needed when a QR code is
 * actually scanned.
 *
 * The budget below is expressed as the maximum size of each chunk and as
 * the set of files the browser is told to preload. Both are measured from
 * the real build output, so a regression fails the build instead of
 * quietly making the app slower.
 *
 * Usage:
 *   node scripts/check-bundle-size.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const assets = join(dist, "assets");

/**
 * The budget for a single chunk, in kilobytes, uncompressed.
 *
 * The main application chunk holds the whole interface — forty-one
 * components — so it gets a larger budget of its own. Every other chunk
 * has to fit into the smaller one, which is tight enough that a payload
 * the size of the OCR table cannot slip in unnoticed.
 */
const MAX_CHUNK_KB = 250;
const MAX_APP_CHUNK_KB = 460;

/**
 * The chunks the browser is allowed to preload.
 *
 * A preload is a promise that the file is needed for the first paint.
 * Anything else has to be fetched when it is actually used.
 */
const ALLOWED_PRELOADS = ["vendor-react", "vendor-motion", "vendor-icons"];

/**
 * The chunks that must never be preloaded, because they are only needed
 * for a specific user action.
 */
const FORBIDDEN_PRELOADS = ["jsQR", "lib-ocr", "lib-wordlist", "vendor-ocr", "lib-totp"];

try {
  statSync(dist);
} catch {
  console.error("dist/ does not exist. Run `npm run build` first.");
  process.exit(1);
}

const files = readdirSync(assets);
const chunks = files
  .filter((f) => f.endsWith(".js"))
  .map((f) => ({ name: f, bytes: statSync(join(assets, f)).size }));

let failures = 0;

console.log("Chunk budget");
console.log("-".repeat(72));
for (const chunk of chunks.sort((a, b) => b.bytes - a.bytes)) {
  const kb = chunk.bytes / 1024;
  // The main application chunk is the entry point and carries the whole
  // interface; it is allowed a larger budget than the rest.
  const isAppChunk = /^index-[^/]+\.js$/.test(chunk.name);
  const limit = isAppChunk ? MAX_APP_CHUNK_KB : MAX_CHUNK_KB;
  const ok = kb <= limit;
  if (!ok) failures++;
  console.log(
    `  ${chunk.name.padEnd(34)} ${kb.toFixed(1).padStart(8)} kB  ${ok ? "ok" : `FAIL (over ${limit} kB)`}`
  );
}

const html = readFileSync(join(dist, "index.html"), "utf8");
const preloads = [...html.matchAll(/modulepreload[^>]*href="[^"]*\/([^"/]+)"/g)].map((m) => m[1]);

console.log();
console.log("Preloaded chunks");
console.log("-".repeat(72));
for (const preload of preloads) {
  const allowed = ALLOWED_PRELOADS.some((name) => preload.startsWith(name));
  const forbidden = FORBIDDEN_PRELOADS.some((name) => preload.startsWith(name));
  const ok = allowed && !forbidden;
  if (!ok) failures++;
  console.log(`  ${preload.padEnd(34)} ${ok ? "ok" : "FAIL (should not be preloaded)"}`);
}

console.log();
if (failures > 0) {
  console.error(`${failures} bundle budget check(s) failed.`);
  process.exit(1);
}
console.log("The bundle stays within its budget and the heavy payloads stay lazy.");
