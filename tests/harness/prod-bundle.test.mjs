// Verify the PRODUCTION bundle actually contains a working Argon2id.
//
// PERFORMANCE (V-38): `hash-wasm` and the passphrase wordlist were moved
// out of the critical-path bundle into lazy chunks. This harness therefore
// scans EVERY emitted chunk, not just the main `index-*.js` entry, so a
// regression that drops Argon2id entirely is still caught.
//
// It also asserts that the lazy chunks are NOT preloaded from index.html —
// otherwise the "lazy" split buys nothing.
import { webcrypto } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

// Resolve the repository root from this file, not from the current working
// directory. A CI runner may invoke the harness from anywhere, and a
// relative `dist/` path would then fail for the wrong reason.
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const distDir = join(repoRoot, "dist");

if (!existsSync(distDir)) {
  // The bundle is what ships, so the harness must not silently skip it.
  // If the build output is missing, build it here rather than reporting a
  // failure that has nothing to do with the code under test.
  console.log(`${distDir} is missing — building it now.`);
  const { spawnSync } = await import("node:child_process");
  const build = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: true,
  });
  if (build.status !== 0 || !existsSync(distDir)) {
    console.error("FAIL: the production build could not be produced.");
    process.exit(1);
  }
}

const assetsDir = join(distDir, "assets");
if (!existsSync(assetsDir)) {
  console.error(`FAIL: ${assetsDir} does not exist. Run "npm run build" first.`);
  process.exit(1);
}

const assets = readdirSync(assetsDir).filter((f) => f.endsWith(".js"));
let all = "";
for (const f of assets) all += readFileSync(join(assetsDir, f), "utf8");

const html = readFileSync(join(distDir, "index.html"), "utf8");
const preloaded = [...html.matchAll(/modulepreload[^>]*href="\.\/assets\/([^"]+)"/g)].map(
  (m) => m[1],
);

const hasArgon = /argon2id/i.test(all);
// The base64 payload may be line-wrapped, and a Windows build may wrap it
// at a different column than a Linux build. Strip the whitespace before
// looking for the marker so the check is about the payload, not about the
// line breaks.
const unwrapped = all.replace(/\s+/g, "");
const hasWasm = unwrapped.includes("AGFzbQ");
const hasWordlist = /abdominal/.test(all);

const argonChunk = assets.find((f) =>
  readFileSync(join(assetsDir, f), "utf8").replace(/\s+/g, "").includes("AGFzbQ")
);
const wordlistChunk = assets.find((f) =>
  /abdominal/.test(readFileSync(join(assetsDir, f), "utf8")),
);

// The lazy chunks must not be preloaded, otherwise they are on the
// critical path anyway and the split is pointless.
const argonPreloaded = argonChunk ? preloaded.includes(argonChunk) : false;
const wordlistPreloaded = wordlistChunk ? preloaded.includes(wordlistChunk) : false;

console.log("chunks scanned:", assets.length);
console.log("argon2id symbol present:", hasArgon);
console.log("base64 wasm payload present:", hasWasm);
console.log("wordlist present:", hasWordlist);
console.log("argon2 chunk:", argonChunk ?? "(none)", "preloaded:", argonPreloaded);
console.log("wordlist chunk:", wordlistChunk ?? "(none)", "preloaded:", wordlistPreloaded);
console.log("preloaded chunks:", preloaded.length ? preloaded.join(", ") : "(none)");

const ok = hasArgon && hasWasm && hasWordlist && !argonPreloaded && !wordlistPreloaded;
if (!ok) {
  // Report exactly which condition failed. On a CI runner a bare "FAIL"
  // is impossible to act on.
  if (!hasArgon) console.error("FAIL: the Argon2id symbol is not in any built chunk.");
  if (!hasWasm) console.error("FAIL: the Argon2id WASM payload is not in any built chunk.");
  if (!hasWordlist) console.error("FAIL: the passphrase wordlist is not in any built chunk.");
  if (argonPreloaded) console.error("FAIL: the Argon2id chunk is preloaded, so it is on the critical path.");
  if (wordlistPreloaded) console.error("FAIL: the wordlist chunk is preloaded, so it is on the critical path.");
}
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
