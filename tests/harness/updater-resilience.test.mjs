// V-93 / Batch 4 — "Check for Updates" must never falsely claim "Offline /
// Air-gapped network" on a device that has internet.
//
// Measured with a real Origin header:
//   api.github.com/.../releases/latest  -> 200 + access-control-allow-origin: *
//   github.com/.../releases/latest      -> 302 -> /releases/tag/v2.5.2,
//                                          but NO CORS header.
// So a renderer cannot read the 302 Location; it CAN still use the public
// redirect as an opaque (no-cors) REACHABILITY probe. The version itself
// comes from a second CORS-enabled API endpoint.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const bundle = (name) => pathToFileURL(join(ROOT, ".harness-build", name)).href;
const m = await import(bundle("updater-built.mjs"));

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

// --------------------------------------------------------------------------
// CSP: connect-src must permit every endpoint the resilient checker uses.
// --------------------------------------------------------------------------
const conf = JSON.parse(readFileSync(join(ROOT, "src-tauri/tauri.conf.json"), "utf8"));
const csp = conf.app.security.csp;
const connect = (csp.match(/connect-src\s+([^;]+)/) || [, ""])[1];
console.log("=== CSP connect-src ===");
for (const token of [
  "'self'",
  "https://api.github.com",
  "https://github.com",
  "https://*.githubusercontent.com",
  "ipc:",
  "http://ipc.localhost",
]) {
  t(`connect-src allows ${token}`, connect.includes(token));
}
t(
  "positive control: a CSP missing the tokens is rejected",
  !"connect-src 'self' https://api.github.com".includes("https://*.githubusercontent.com"),
);

// --------------------------------------------------------------------------
// Timeout: the user asked for a 10s bound (was 8s).
// --------------------------------------------------------------------------
console.log("=== bounded request ===");
t("release check timeout is 10 seconds", m.RELEASE_CHECK_TIMEOUT_MS === 10_000,
  `got ${m.RELEASE_CHECK_TIMEOUT_MS}`);

// --------------------------------------------------------------------------
// Stub the network. `checkReleaseStatus(true)` bypasses the shared cache.
// --------------------------------------------------------------------------
const calls = [];
const resp = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  type: "basic",
  json: async () => data,
  text: async () => JSON.stringify(data),
  headers: { get: () => null },
});
const opaque = () => ({
  ok: false, status: 0, type: "opaque",
  json: async () => ({}), text: async () => "", headers: { get: () => null },
});
const release = (tag) => ({
  tag_name: tag,
  name: `VaultZero ${tag}`,
  body: "",
  published_at: "2026-11-02T01:18:40Z",
  html_url: `https://github.com/tonmoycoder/VaultZero/releases/tag/${tag}`,
  assets: [],
});

async function runCase({ primary, fallback, probe }) {
  calls.length = 0;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    calls.push({ u, init: init || {} });
    if (u.includes("api.github.com") && u.includes("/releases/latest")) return primary(init);
    if (u.includes("api.github.com") && u.includes("/releases?")) return fallback(init);
    if (u.includes("github.com/") && u.includes("/releases/latest")) return probe(init);
    throw new Error(`unexpected URL: ${u}`);
  };
  m.clearReleaseCache();
  return m.checkReleaseStatus(true);
}

const never = () => { throw new Error("should not be called"); };

console.log("=== primary API success (guards) ===");
let r = await runCase({
  primary: () => resp(release("v2.5.2")),
  fallback: never, probe: never,
});
t("same version -> up_to_date (strict SemVer)", r.status === "up_to_date", r.status);
t("remote v2.5.2 is reported", r.remoteVersion === "2.5.2", r.remoteVersion);

r = await runCase({
  primary: () => resp(release("v2.6.0")),
  fallback: never, probe: never,
});
t("newer version -> update_available", r.status === "update_available", r.status);

r = await runCase({
  primary: () => resp(release("v2.5.2-beta.1")),
  fallback: never, probe: never,
});
t("a prerelease sorts BELOW the release -> up_to_date", r.status === "up_to_date", r.status);

t(
  "primary request sends the documented Accept header",
  calls.some((c) => c.u.includes("/releases/latest") &&
    c.init.headers?.Accept === "application/vnd.github+json"),
);
t(
  "primary request pins the GitHub API version",
  calls.some((c) => c.u.includes("/releases/latest") &&
    c.init.headers?.["X-GitHub-Api-Version"] === "2022-11-28"),
);

console.log("=== RESILIENCE: primary failure must NOT become 'offline' ===");
r = await runCase({
  primary: () => { throw new TypeError("Failed to fetch (cert / UA blocked)"); },
  fallback: () => resp([release("v2.5.2")]),
  probe: never,
});
t("network throw -> /releases?per_page=1 fallback is used",
  calls.some((c) => c.u.includes("/releases?per_page=1")));
t("network throw + working fallback -> up_to_date, not offline",
  r.status === "up_to_date", `${r.status}: ${r.message || ""}`);

r = await runCase({
  primary: () => resp({}, 403),
  fallback: () => resp([release("v2.6.0")]),
  probe: never,
});
t("HTTP 403 (rate limit / UA block) -> fallback -> update_available",
  r.status === "update_available", `${r.status}: ${r.message || ""}`);

r = await runCase({
  primary: () => { throw new TypeError("Failed to fetch"); },
  fallback: () => { throw new TypeError("Failed to fetch"); },
  probe: () => opaque(),
});
t("public release redirect is probed for reachability",
  calls.some((c) => c.u.includes("https://github.com/tonmoycoder/VaultZero/releases/latest")));
t("network reachable but metadata unreadable -> 'error', NEVER 'offline'",
  r.status === "error", `${r.status}: ${r.message || ""}`);
t("the message says the network IS reachable", /reachable/i.test(r.message || ""));

r = await runCase({
  primary: () => { throw new TypeError("Failed to fetch"); },
  fallback: () => { throw new TypeError("Failed to fetch"); },
  probe: () => { throw new TypeError("Failed to fetch"); },
});
t("every path unreachable -> genuine offline", r.status === "offline", r.status);

console.log(`=== ${failures === 0 ? "GREEN" : "RED"}: ${failures} failure(s) ===`);
process.exit(failures === 0 ? 0 : 1);
