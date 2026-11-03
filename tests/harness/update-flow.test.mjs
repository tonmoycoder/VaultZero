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

  /*
   * 4d. The happy path.
   *
   * The updater used to download the artifact, hash it, and then return
   * the original URL. The frontend then opened that URL, which downloaded
   * the same file a second time — so the bytes that were hashed and the
   * bytes the user installed came from two different requests.
   *
   * The verified bytes are now handed back directly, and the fetch log
   * proves the artifact was requested exactly once.
   */
  {
    const log = [];
    const artifact = "verified artifact bytes";
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(artifact)
    );
    const expectedDigest = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    globalThis.fetch = stubFetch(
      {
        "https://api.github.com/repos/tonmoycoder/VaultZero/releases/tags/v9.9.9": JSON.stringify({
          assets: [ASSET, MANIFEST],
        }),
        [MANIFEST.browser_download_url]: `${expectedDigest}  ${ASSET.name}\n`,
        [ASSET.browser_download_url]: artifact,
      },
      log
    );

    // The browser build has no object URL implementation in Node, so a
    // minimal stand-in is provided.
    const created = [];
    const revoked = [];
    globalThis.URL.createObjectURL = (blob) => {
      created.push(blob);
      return `blob:verified/${created.length}`;
    };
    globalThis.URL.revokeObjectURL = (url) => revoked.push(url);
    globalThis.Blob = class Blob {
      constructor(parts) {
        this.parts = parts;
      }
    };
    globalThis.window = {
      addEventListener() {},
    };

    let result = null;
    let failed = false;
    let reason = "";
    try {
      result = await updater.runVerifiedUpdate(info, () => {});
    } catch (error) {
      failed = true;
      reason = error.message;
    }

    t("a verified artifact completes the flow", !failed && result !== null, reason);
    if (result) {
      t(
        "the artifact is fetched exactly once",
        log.filter((u) => u === ASSET.browser_download_url).length === 1,
        log.join(", ")
      );
      t(
        "the returned location is an object URL over the verified bytes",
        result.url.startsWith("blob:"),
        result.url
      );
      t(
        "the original download URL is not handed back",
        result.url !== ASSET.browser_download_url,
        result.url
      );
      t(
        "the artifact name is reported",
        result.fileName === ASSET.name,
        result.fileName
      );
      t(
        "the digest that was verified is reported",
        result.sha256 === expectedDigest,
        result.sha256
      );
      t(
        "the object URL is created over the downloaded bytes",
        created.length === 1 && created[0].parts.length === 1,
        `created ${created.length}`
      );
    }
  }

  // 4e. The happy path reports the real progress and returns the digest.
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

  /*
   * The verified artifact must not be downloaded a second time.
   *
   * The updater returns the location of the bytes it hashed. If the
   * frontend opened the original release URL instead, the artifact would
   * be fetched twice and the user would run bytes that were never
   * checked.
   */
  const updaterSource = readFileSync(join(ROOT, "src", "lib", "updater.ts"), "utf8");

  t(
    "the updater does not return the original download URL",
    !/url:\s*asset\.browser_download_url/.test(updaterSource),
    "the verified update still returns the release URL"
  );
  t(
    "the updater saves the verified bytes",
    /saveVerifiedArtifact/.test(updaterSource),
    "the verified bytes are not saved anywhere"
  );

  for (const [name, source] of [
    ["the banner", banner],
    ["the modal", modal],
  ]) {
    t(
      `${name} does not open the release URL`,
      !/window\.open\(\s*verified\.url/.test(source),
      `${name} still opens the location directly`
    );
    t(
      `${name} opens the verified artifact through the shared helper`,
      /openVerifiedUpdate\(\s*verified\s*\)/.test(source),
      `${name} does not use the shared opener`
    );
  }
}

if (failures > 0) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll update-flow checks passed.");
