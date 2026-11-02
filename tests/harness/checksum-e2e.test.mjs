// V-32 end-to-end: the release checksum must actually be enforced.
//
// The bug: `verifyChecksum` and `parseChecksumManifest` existed but were
// never called by the app, so the README's checksum claim was never
// enforced. These tests exercise the whole chain — manifest fetch, entry
// lookup, download, digest comparison — with a stubbed `fetch`.
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const m = await import("/tmp/vz-tests/updater-built.mjs");

let failures = 0;
const t = (name, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failures++;
};

const ASSET_NAME = "VaultZero-Windows-x64-portable.exe";
const ASSET_URL = `https://github.com/tonmoycoder/VaultZero/releases/download/v9.9.9/${ASSET_NAME}`;
const MANIFEST_URL =
  "https://github.com/tonmoycoder/VaultZero/releases/download/v9.9.9/SHA256SUMS.txt";

const bytes = new TextEncoder().encode("pretend this is the installer binary");
const realDigest = Buffer.from(await crypto.subtle.digest("SHA-256", bytes.buffer)).toString("hex");

const assets = [
  { name: ASSET_NAME, browser_download_url: ASSET_URL, size: bytes.length },
  { name: "SHA256SUMS.txt", browser_download_url: MANIFEST_URL, size: 100 },
];

/** Installs a stub `fetch` that serves the manifest and the artifact. */
function stubFetch({ manifest, artifact }) {
  globalThis.fetch = async (url) => {
    if (String(url).includes("SHA256SUMS.txt")) {
      if (manifest === null) return { ok: false, status: 404, text: async () => "" };
      return { ok: true, status: 200, text: async () => manifest };
    }
    if (String(url).includes(ASSET_NAME)) {
      if (artifact === null) return { ok: false, status: 500, text: async () => "" };
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () =>
          artifact.buffer.slice(artifact.byteOffset, artifact.byteOffset + artifact.byteLength),
      };
    }
    return { ok: false, status: 404, text: async () => "" };
  };
}

console.log("=== manifest parsing ===");
const goodManifest = `${realDigest}  ${ASSET_NAME}\n`;
t("parses the digest for the asset", m.parseChecksumManifest(goodManifest, ASSET_NAME) === realDigest);
t(
  "ignores a checksum for another asset",
  m.parseChecksumManifest(`${"a".repeat(64)}  other.exe\n`, ASSET_NAME) === null
);
t(
  "accepts the `*` binary marker used by sha256sum",
  m.parseChecksumManifest(`${realDigest} *${ASSET_NAME}\n`, ASSET_NAME) === realDigest
);
t("returns null for a malformed manifest", m.parseChecksumManifest("garbage\n", ASSET_NAME) === null);

console.log("=== end-to-end verification ===");

// 1. Happy path.
stubFetch({ manifest: goodManifest, artifact: bytes });
const ok = await m.verifyReleaseArtifact(assets, assets[0]);
t("verifies a matching artifact", ok.ok === true);
t("returns the verified digest", ok.expectedSha256 === realDigest);

// 2. Digest mismatch — the core security property.
const tampered = new TextEncoder().encode("pretend this is the TAMPERED installer binary");
stubFetch({ manifest: goodManifest, artifact: tampered });
const bad = await m.verifyReleaseArtifact(assets, assets[0]);
t("REJECTS a tampered artifact", bad.ok === false);
t("explains the mismatch", /checksum/i.test(bad.reason ?? ""));

// 3. Missing manifest — fail closed.
stubFetch({ manifest: null, artifact: bytes });
const noManifest = await m.verifyReleaseArtifact(assets, assets[0]);
t("REJECTS when the manifest cannot be downloaded", noManifest.ok === false);

// 4. Manifest present but the artifact is not listed.
stubFetch({ manifest: `${"b".repeat(64)}  something-else.exe\n`, artifact: bytes });
const notListed = await m.verifyReleaseArtifact(assets, assets[0]);
t("REJECTS when the manifest does not list the artifact", notListed.ok === false);

// 5. The release has no manifest asset at all.
const noManifestAsset = await m.verifyReleaseArtifact([assets[0]], assets[0]);
t("REJECTS when the release publishes no manifest", noManifestAsset.ok === false);

// 6. An untrusted URL is refused before anything is fetched.
let fetched = false;
globalThis.fetch = async () => {
  fetched = true;
  return {
    ok: true,
    status: 200,
    text: async () => goodManifest,
    arrayBuffer: async () => bytes.buffer,
  };
};
const evil = {
  name: ASSET_NAME,
  browser_download_url: "https://evil.example.com/VaultZero.exe",
  size: 10,
};
const evilResult = await m.verifyReleaseArtifact([...assets, evil], evil);
t("REJECTS an untrusted host", evilResult.ok === false);
t("does not fetch an untrusted URL", fetched === false);

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
