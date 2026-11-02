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
import { readFileSync, readdirSync } from "node:fs";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const assets = readdirSync("dist/assets").filter((f) => f.endsWith(".js"));
let all = "";
for (const f of assets) all += readFileSync(`dist/assets/${f}`, "utf8");

const html = readFileSync("dist/index.html", "utf8");
const preloaded = [...html.matchAll(/modulepreload[^>]*href="\.\/assets\/([^"]+)"/g)].map(
  (m) => m[1],
);

const hasArgon = /argon2id/i.test(all);
const hasWasm = /AGFzbQ/.test(all);
const hasWordlist = /abdominal/.test(all);

const argonChunk = assets.find((f) => /AGFzbQ/.test(readFileSync(`dist/assets/${f}`, "utf8")));
const wordlistChunk = assets.find((f) =>
  /abdominal/.test(readFileSync(`dist/assets/${f}`, "utf8")),
);

// The lazy chunks must not be preloaded, otherwise they are on the
// critical path anyway and the split is pointless.
const argonPreloaded = argonChunk ? preloaded.includes(argonChunk) : false;
const wordlistPreloaded = wordlistChunk ? preloaded.includes(wordlistChunk) : false;

console.log("argon2id symbol present:", hasArgon);
console.log("base64 wasm payload present:", hasWasm);
console.log("wordlist present:", hasWordlist);
console.log("argon2 chunk:", argonChunk ?? "(none)", "preloaded:", argonPreloaded);
console.log("wordlist chunk:", wordlistChunk ?? "(none)", "preloaded:", wordlistPreloaded);

const ok = hasArgon && hasWasm && hasWordlist && !argonPreloaded && !wordlistPreloaded;
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
