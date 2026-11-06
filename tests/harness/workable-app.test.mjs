// Phase D / V-86 — "make it workable" defects that are STILL REAL in the
// current source. The user's Android screenshots show strings that no longer
// exist here (`Connected: 192.1`, "Keys negotiated via SPAKE2"); those came
// from an OLD published build. This guard covers what the current code still
// gets wrong, so the two things never get confused again:
//
//   1. the lock screen footer hardcodes `v2.5.0` instead of APP_VERSION;
//   2. a partial IP (`192.1`) can become a "selected peer" via the QR raw
//      text path and the QR JSON `ip` field;
//   3. `start_p2p_host` flips the banner to green "connected" before any
//      peer has authenticated;
//   4. the release check has no timeout and reports EVERY failure as
//      "offline", so a broken/rate-limited/malformed GitHub response looks
//      exactly like an air-gapped device.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const bundle = (name) => pathToFileURL(join(ROOT, ".harness-build", name)).href;

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

// ---------------------------------------------------------------------------
// 1. No stale version string may be shipped in the UI.
// ---------------------------------------------------------------------------
console.log("=== version shown to the user comes from one source of truth ===");
const sourceFiles = (dir) =>
  readdirSync(join(ROOT, dir)).flatMap((entry) => {
    const rel = `${dir}/${entry}`;
    const full = join(ROOT, rel);
    if (statSync(full).isDirectory()) return sourceFiles(rel);
    return /\.(ts|tsx)$/.test(entry) ? [rel] : [];
  });
// Comments legitimately mention older versions as history; only shipped
// code/JSX text must be free of a stale version literal.
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const stale = sourceFiles("src").filter((f) => /\bv2\.5\.0\b|\bv2\.5\.1\b/.test(stripComments(read(f))));
t("no src/*.ts(x) hardcodes an old version", stale.length === 0, stale.join(", "));
const lock = read("src/components/LockScreen.tsx");
t("LockScreen imports APP_VERSION", /import\s*\{[^}]*APP_VERSION[^}]*\}\s*from\s*"\.\.\/lib\/version"/.test(lock));
t("LockScreen renders the live APP_VERSION", /v\{\s*APP_VERSION\s*\}/.test(lock));

// ---------------------------------------------------------------------------
// 2. A "peer" must be a real LAN address. `192.1` is not one.
// ---------------------------------------------------------------------------
console.log("=== P2P peer validation (no fake connections) ===");
const p2p = await import(bundle("p2pMerge-built.mjs"));
t("isValidPeerAddress is exported", typeof p2p.isValidPeerAddress === "function");
// Keep the harness report complete even while the export is still missing.
const isValid = typeof p2p.isValidPeerAddress === "function" ? p2p.isValidPeerAddress : () => false;
const valid = (v) => isValid(v) === true;
const invalid = (v) => isValid(v) === false;
t("a full LAN address with port is valid", valid("192.168.1.5:52137"));
t("a full LAN address without port is valid", valid("10.0.0.5"));
t("a truncated IP is rejected", invalid("192.1"));
t("an out-of-range octet is rejected", invalid("999.1.1.1:1420"));
t("an out-of-range port is rejected", invalid("192.168.1.5:99999"));
t("a WebView hostname is not a LAN peer", invalid("tauri.localhost"));
t("empty input is rejected", invalid(""));
t(
  "QR JSON with a truncated ip yields no peer",
  p2p.parsePeerInput('{"app":"vaultzero","ip":"192.1","port":1420,"code":"729184"}').address === null,
);
t(
  "QR JSON with a valid ip:port yields that peer",
  p2p.parsePeerInput('{"ip":"192.168.1.5","port":52137,"code":"729184"}').address === "192.168.1.5:52137",
);
t(
  "a bare 6-digit PIN is still a PIN, not an address",
  p2p.parsePeerInput("729184").address === null && p2p.parsePeerInput("729184").pin === "729184",
);

console.log("=== starting a host is NOT a completed connection ===");
const modals = read("src/components/toolModals.tsx");
const hostBlock = /const handleStartHost = async \(\) => \{([\s\S]*?)\n  \};/.exec(modals)?.[1] ?? "";
t("handleStartHost was found", hostBlock.length > 0);
t("handleStartHost does not set status=connected", !/setStatus\("connected"\)/.test(hostBlock));
t("handleStartHost does not invent a connectedPeer", !/setConnectedPeer\(/.test(hostBlock));

// ---------------------------------------------------------------------------
// 3. The release check must be bounded and must tell the truth about errors.
// ---------------------------------------------------------------------------
console.log("=== updater: bounded request + honest failure classification ===");
globalThis.window = {
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, key: () => null, length: 0 },
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, key: () => null, length: 0 },
  location: { origin: "https://tauri.localhost" },
};
const updater = await import(bundle("updater-built.mjs"));
const realFetch = globalThis.fetch;
const withFetch = async (stub, fn) => {
  globalThis.fetch = stub;
  updater.clearReleaseCache();
  try {
    return await fn();
  } finally {
    globalThis.fetch = realFetch;
  }
};

const calls = [];
const okResult = await withFetch(async (url, init) => {
  calls.push({ url, init });
  return { ok: true, status: 200, json: async () => ({ tag_name: "v2.5.2", assets: [] }) };
}, () => updater.checkReleaseStatus(true));
t("a healthy response is up_to_date", okResult.status === "up_to_date", okResult.status);
t(
  "the GitHub request carries an AbortSignal (it cannot hang forever)",
  calls[0]?.init?.signal instanceof AbortSignal,
  calls[0]?.init?.signal ? "signal present" : "no signal",
);

const httpResult = await withFetch(
  async () => ({ ok: false, status: 503, json: async () => ({}) }),
  () => updater.checkReleaseStatus(true),
);
t("an HTTP error is 'error', not 'offline'", httpResult.status === "error", httpResult.status);

const malformed = await withFetch(
  async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token"); } }),
  () => updater.checkReleaseStatus(true),
);
t("a malformed API body is 'error', not 'offline'", malformed.status === "error", malformed.status);
t("the malformed-response message explains the response", /response|release|json/i.test(malformed.message ?? ""), malformed.message);

const offline = await withFetch(
  async () => { throw new TypeError("Failed to fetch"); },
  () => updater.checkReleaseStatus(true),
);
t("a genuine network failure is still 'offline'", offline.status === "offline", offline.status);

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
