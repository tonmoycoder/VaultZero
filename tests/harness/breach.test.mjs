// The breach scanner must be offline by default, must cache HIBP ranges,
// must deduplicate parallel scans, and must keep its audit log in memory
// only with redacted details.
import { webcrypto } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

// The harness bundles are built into the repository (see
// `scripts/build-test-bundles.mjs`) and gitignored. The path is derived
// from this file so it works on any platform and any working directory.
const BUNDLE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".harness-build") + "/";

/**
 * Builds a `file://` URL for a harness bundle.
 *
 * On Windows a bare `C:\\...\\.harness-build/storage-built.mjs` path is
 * not a valid ESM specifier, so `import()` rejects it. Converting the path
 * to a `file://` URL works on every platform.
 */
function bundleUrl(name) {
  return pathToFileURL(join(BUNDLE_DIR, name)).href;
}

const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  },
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
};

const m = await import(bundleUrl("breach-built.mjs"));

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

const CONSENT_KEY = "vaultzero.breach.onlineConsent";

console.log("=== the scanner is offline by default ===");

t("online scanning is disabled by default", m.isBreachOnlineEnabled() === false);

let fetchCalls = 0;
globalThis.fetch = async () => {
  fetchCalls += 1;
  return { ok: true, status: 200, text: async () => "" };
};

const offline = await m.checkPasswordBreach("correct horse battery staple");
t("an offline scan performs no network request", fetchCalls === 0);
t(
  "an offline scan reports the offline source",
  /Offline/.test(offline.source ?? ""),
  offline.source
);

console.log("=== consent can be given and revoked ===");

m.setBreachOnlineEnabled(true);
t("consent is recorded", m.isBreachOnlineEnabled() === true);
t("consent is persisted", store.get(CONSENT_KEY) === "1");

m.setBreachOnlineEnabled(false);
t("consent can be revoked", m.isBreachOnlineEnabled() === false);
t("revoking clears the persisted consent", store.get(CONSENT_KEY) !== "1");

console.log("=== the range cache is bounded and clearable ===");

m.setBreachOnlineEnabled(true);
m.clearBreachRangeCache();

globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  text: async () => "ABCD:3\r\nEFGH:1\r\n",
});

// Two passwords whose SHA-1 hashes share the same 5-character prefix, so
// they land in the same HIBP range and must share a single request.
const first = await m.checkPasswordBreach("p192x");
const afterFirst = m.getRangeRequestCount();
const second = await m.checkPasswordBreach("p488x");
const afterSecond = m.getRangeRequestCount();

t("a scan performs a request", afterFirst >= 1, `count ${afterFirst}`);
t(
  "a repeated range is not fetched twice",
  afterSecond === afterFirst,
  `${afterFirst} -> ${afterSecond}`
);
t("the result is a well-formed report", typeof first.breached === "boolean");
t("the report carries a source", typeof first.source === "string");

console.log("=== a cached scan stays live and does not refetch ===");

m.clearBreachRangeCache();
let rangeFetches = 0;
globalThis.fetch = async () => {
  rangeFetches += 1;
  return { ok: true, status: 200, text: async () => "" };
};

await m.scanPasswordsBreach(["cache-probe-password"], "en");
const cachedBatch = await m.scanPasswordsBreach(["cache-probe-password"], "en");

t("the first scan fetched one range", rangeFetches === 1, `count ${rangeFetches}`);
t("the second scan made no request", rangeFetches === 1, `count ${rangeFetches}`);
t("a fully cached scan is not reported offline", cachedBatch.offline === false);
t("the cached scan still returns a verdict", cachedBatch.results.size === 1);

console.log("=== an expired range is not resurrected after a failed refresh ===");

m.clearBreachRangeCache();
let reachable = true;
globalThis.fetch = async () => {
  if (!reachable) throw new Error("offline");
  return { ok: true, status: 200, text: async () => "" };
};
await m.scanPasswordsBreach(["stale-probe-password"], "en");

const realNow = Date.now;
Date.now = () => realNow() + 60 * 60 * 1000 + 1000; // past the 1 hour TTL
reachable = false;
const staleBatch = await m.scanPasswordsBreach(["stale-probe-password"], "en");
Date.now = realNow;
reachable = true;

const staleVerdict = [...staleBatch.results.values()][0];
t("the failed refresh reports an offline scan", staleBatch.offline === true);
t(
  "the failed refresh falls back to the offline verdict",
  /Offline/.test(staleVerdict?.source ?? ""),
  staleVerdict?.source
);

console.log("=== the audit log is redacted and memory-only ===");

const log = m.getSecurityAuditLog();
t("the audit log is an array", Array.isArray(log));

const redacted = m.redactAuditDetail("Password: hunter2 for user@example.com");
t("the email is redacted", !redacted.includes("user@example.com"), redacted);
t("something is still recorded", redacted.length > 0);

const redactedHash = m.redactAuditDetail("sha1:ABCDEF1234567890");
t("a hash prefix is redacted", !redactedHash.includes("ABCDEF1234567890"), redactedHash);

const redactedEntry = m.redactAuditDetail('entry "GitHub"');
t("an entry label is redacted", !redactedEntry.includes("GitHub"), redactedEntry);

// The log must not be persisted to disk.
const persisted = [...store.values()].join(" ");
t("the audit log is not written to storage", !persisted.includes("hunter2"));

console.log("=== password anatomy ===");

const anatomy = m.calculatePasswordAnatomy("Abcdef123!@#xyz");
t("the anatomy has a score", typeof anatomy.score === "number");
t("the anatomy has entropy bits", typeof anatomy.entropyBits === "number");
t("the anatomy has a crack time", typeof anatomy.crackTimeHuman === "string");
t("the anatomy detects upper case", anatomy.hasUpper === true);
t("the anatomy detects digits", anatomy.hasDigits === true);
t("the anatomy detects symbols", anatomy.hasSymbols === true);

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
