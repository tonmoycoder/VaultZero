// The update path must be verified on **every** entry point, and the
// pre-update snapshot must report the key it actually wrote.
//
// Two separate bugs are covered here:
//
// 1. The banner and the modal were two independent update flows. The modal
//    verified the artifact against the release's checksum manifest, the
//    banner did not — it opened the download URL straight away. The README
//    advertised checksum-verified downloads, so the guarantee did not hold
//    on the path a user is most likely to take.
//
// 2. `createPreUpdateBackup` returned a timestamped key that it had
//    already deleted from storage, so the UI reported a backup location
//    that did not exist.
import { webcrypto } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const HARNESS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HARNESS_DIR, "..", "..");
const BUNDLE_DIR = join(ROOT, ".harness-build");

/**
 * Builds a `file://` URL for a harness bundle.
 *
 * A bare Windows path is not a valid ESM specifier, so the path has to be
 * converted before it is imported.
 */
function bundleUrl(name) {
  return pathToFileURL(join(BUNDLE_DIR, name)).href;
}

const updater = await import(bundleUrl("updater-built.mjs"));

let failures = 0;
const t = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) {
    failures++;
    if (detail) console.log(`      ${detail}`);
  }
};

// ---------------------------------------------------------------------------
// 1. The pre-update snapshot reports the key it actually wrote.
// ---------------------------------------------------------------------------

/** A minimal in-memory `localStorage`. */
function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
    _map: map,
  };
}

{
  const storage = makeStorage();
  globalThis.window = { localStorage: storage, sessionStorage: makeStorage() };
  storage.setItem("vaultzero_encrypted_vault_v2", "ENCRYPTED-VAULT-BYTES");

  const key = updater.createPreUpdateBackup();

  t("the snapshot returns a key", typeof key === "string" && key.length > 0, `got ${JSON.stringify(key)}`);
  t(
    "the returned key is the key that holds the snapshot",
    key === updater.PRE_UPDATE_BACKUP_KEY,
    `returned ${JSON.stringify(key)}, expected ${JSON.stringify(updater.PRE_UPDATE_BACKUP_KEY)}`
  );
  t(
    "the snapshot is readable under the returned key",
    storage.getItem(key) === "ENCRYPTED-VAULT-BYTES"
  );
  t(
    "no timestamped snapshot key is left behind",
    Array.from(storage._map.keys()).every((k) => !k.startsWith("vaultzero_pre_update_backup_")),
    Array.from(storage._map.keys()).join(", ")
  );
  t(
    "the vault copy is not duplicated into sessionStorage",
    globalThis.window.sessionStorage.length === 0,
    `sessionStorage holds ${globalThis.window.sessionStorage.length} item(s)`
  );
}

// ---------------------------------------------------------------------------
// 2. Repeated snapshots do not grow the storage.
// ---------------------------------------------------------------------------

{
  const storage = makeStorage();
  globalThis.window = { localStorage: storage, sessionStorage: makeStorage() };
  storage.setItem("vaultzero_encrypted_vault_v2", "ENCRYPTED-VAULT-BYTES");

  for (let i = 0; i < 25; i++) updater.createPreUpdateBackup();

  t(
    "repeated snapshots keep exactly one vault copy",
    storage.length === 2,
    `storage holds ${storage.length} entries: ${Array.from(storage._map.keys()).join(", ")}`
  );

  updater.clearPreUpdateBackup();
  t(
    "the snapshot is removed once the new build runs",
    storage.getItem(updater.PRE_UPDATE_BACKUP_KEY) === null
  );
}

// ---------------------------------------------------------------------------
// 3. The release page is never used as a download target.
// ---------------------------------------------------------------------------

{
  const info = {
    version: "9.9.9",
    tagName: "v9.9.9",
    name: "VaultZero v9.9.9",
    body: "",
    publishedAt: new Date().toISOString(),
    htmlUrl: "https://github.com/tonmoycoder/VaultZero/releases/tag/v9.9.9",
  };

  t(
    "a release without an artifact has no downloadable asset",
    updater.selectDownloadableAsset(info) === undefined
  );
}

// ---------------------------------------------------------------------------
// 4. `runVerifiedUpdate` refuses every incomplete release.
// ---------------------------------------------------------------------------

const ASSET = {
  name: "VaultZero-Windows-x64-portable.exe",
  browser_download_url:
    "https://github.com/tonmoycoder/VaultZero/releases/download/v9.9.9/VaultZero-Windows-x64-portable.exe",
  size: 4,
};
const MANIFEST = {
  name: "SHA256SUMS.txt",
  browser_download_url:
    "https://github.com/tonmoycoder/VaultZero/releases/download/v9.9.9/SHA256SUMS.txt",
  size: 100,
};

/** Builds a `fetch` stub that serves the given routes. */
function stubFetch(routes, log) {
  return async (input) => {
    const url = String(input);
    log.push(url);
    const route = routes[url];
    if (!route) {
      return {
        ok: false,
        status: 404,
        headers: new Map(),
        async text() {
          return "";
        },
        async json() {
          return {};
        },
        body: null,
      };
    }
    return {
      ok: true,
      status: 200,
      headers: new Map(),
      body: null,
      async text() {
        return route;
      },
      async json() {
        return JSON.parse(route);
      },
      async arrayBuffer() {
        return new TextEncoder().encode(route).buffer;
      },
    };
  };
}

{
  const info = {
    version: "9.9.9",
    tagName: "v9.9.9",
    name: "VaultZero v9.9.9",
    body: "",
    publishedAt: new Date().toISOString(),
    htmlUrl: "https://github.com/tonmoycoder/VaultZero/releases/tag/v9.9.9",
    installerAsset: ASSET,
  };

  // 4a. The release does not publish a checksum manifest.
  {
    const log = [];
    globalThis.fetch = stubFetch(
      {
        "https://api.github.com/repos/tonmoycoder/VaultZero/releases/tags/v9.9.9": JSON.stringify({
          assets: [ASSET],
        }),
      },
      log
    );

    let failed = false;
    let reason = "";
    try {
      await updater.runVerifiedUpdate(info, () => {});
    } catch (error) {
      failed = true;
      reason = error.message;
    }
    t("a release without a checksum manifest is refused", failed, reason);
    t(
      "the refusal explains that the manifest is missing",
      /checksum manifest/i.test(reason),
      reason
    );
  }

  // 4b. The manifest does not list the artifact.
  {
    const log = [];
    globalThis.fetch = stubFetch(
      {
        "https://api.github.com/repos/tonmoycoder/VaultZero/releases/tags/v9.9.9": JSON.stringify({
          assets: [ASSET, MANIFEST],
        }),
        [MANIFEST.browser_download_url]: "0000000000000000000000000000000000000000000000000000000000000000  other.exe\n",
      },
      log
    );

    let failed = false;
    let reason = "";
    try {
      await updater.runVerifiedUpdate(info, () => {});
    } catch (error) {
      failed = true;
      reason = error.message;
    }
    t("an artifact that is not listed in the manifest is refused", failed, reason);
    t("the refusal explains that the artifact is not listed", /does not list/i.test(reason), reason);
  }

  // 4c. The digest does not match.
  {
    const log = [];
    globalThis.fetch = stubFetch(
      {
        "https://api.github.com/repos/tonmoycoder/VaultZero/releases/tags/v9.9.9": JSON.stringify({
          assets: [ASSET, MANIFEST],
        }),
        [MANIFEST.browser_download_url]: `${"a".repeat(64)}  ${ASSET.name}\n`,
        [ASSET.browser_download_url]: "tampered bytes",
      },
      log
    );

    let failed = false;
    let reason = "";
    try {
      await updater.runVerifiedUpdate(info, () => {});
    } catch (error) {
      failed = true;
      reason = error.message;
    }
    t("a tampered artifact is refused", failed, reason);
    t("the refusal explains the digest mismatch", /does not match/i.test(reason), reason);
  }

  // 4d. The happy path reports the real progress and returns the digest.
  {
    const log = [];
    globalThis.fetch = stubFetch(
      {
        "https://api.github.com/repos/tonmoycoder/VaultZero/releases/tags/v9.9.9": JSON.stringify({
          assets: [ASSET, MANIFEST],
        }),
        [MANIFEST.browser_download_url]: `${"a".repeat(64)}  ${ASSET.name}\n`,
        [ASSET.browser_download_url]: "tampered bytes",
      },
      log
    );

    const stages = [];
    let failed = false;
    let reason = "";
    try {
      await updater.runVerifiedUpdate(info, (p) => stages.push(p.stage));
    } catch (error) {
      failed = true;
      reason = error.message;
    }
    t("the verified flow reports its stages", stages.length > 0, reason);
    t(
      "the verified flow reaches the verification stage",
      stages.includes("verifying"),
      stages.join(", ")
    );
    t(
      "the verified flow never reports success for a tampered artifact",
      !stages.includes("done"),
      stages.join(", ")
    );
  }
}

// ---------------------------------------------------------------------------
// 5. Both entry points use the verified flow.
// ---------------------------------------------------------------------------

{
  const banner = readFileSync(join(ROOT, "src", "components", "UpdateBanner.tsx"), "utf8");
  const modal = readFileSync(join(ROOT, "src", "components", "UpdateModal.tsx"), "utf8");

  t("the banner uses the verified update flow", /runVerifiedUpdate/.test(banner));
  t("the modal uses the verified update flow", /runVerifiedUpdate/.test(modal));

  t(
    "the banner does not open a download URL on its own",
    !/window\.open\(\s*updateInfo/.test(banner) && !/window\.open\(\s*downloadUrl/.test(banner),
    "the banner still opens a URL without verifying it"
  );
  t(
    "the banner does not fake the progress with a timer",
    !/setInterval/.test(banner),
    "the banner still animates the progress bar on a timer"
  );
  t(
    "the banner does not fall back to the release page as a download",
    !/updateInfo\?\.htmlUrl\s*\|\|/.test(banner),
    "the banner still offers the release page as a download"
  );
}

if (failures > 0) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll update-flow checks passed.");
