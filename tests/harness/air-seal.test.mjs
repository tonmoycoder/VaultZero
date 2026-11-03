// V-69: `crates/vault-core` is air-sealed by design. Adapted from the
// build-time guard in deepakvamsi/kosh (`internal/seal/seal.go` +
// `seal_test.go`): a test walks the first-party packages and fails CI if any
// of them gains a networking import, so the offline invariant cannot regress
// silently.
//
// Scope matters: VaultZero's native LAN P2P host (`src-tauri/src/p2p_lan.rs`)
// and the frontend updater (`src/lib/updater.ts`) are explicit, opt-in,
// documented features OUTSIDE the pure core. Banning networking repo-wide
// would be wrong. This guard protects only the crate that owns crypto,
// storage and CRDT merge — the one place a `reqwest::get` would silently turn
// a zero-knowledge offline vault into a networked one.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CORE = join(ROOT, "crates", "vault-core");

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

// Dependency names that would hand the core network capability.
const FORBIDDEN_CRATES = [
  "reqwest", "hyper", "tokio", "tonic", "tungstenite", "websocket",
  "async-std", "ureq", "isahc", "socket2", "quinn", "curl", "libcurl",
];

// Code patterns that would perform network I/O (checked after comments are
// stripped, so prose mentioning a crate is not a false positive).
const FORBIDDEN_CODE = [
  /use\s+std::net\b/,
  /use\s+tokio::net\b/,
  /std::net::/,
  /tokio::net::/,
  /\breqwest::/,
  /\bhyper::/,
  /\bTcpStream\b/,
  /\bTcpListener\b/,
  /\bUdpSocket\b/,
  /\bsocket2::/,
];

// Keep `://` inside URL/string literals from being mistaken for a comment.
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/([^:]|^)\/\/[^\n]*/gm, "$1");

const crateViolations = (toml) =>
  FORBIDDEN_CRATES.filter((name) =>
    new RegExp(`^\\s*${name}\\s*=`, "m").test(toml)
  );

const codeViolations = (src) => {
  const code = stripComments(src);
  return FORBIDDEN_CODE.filter((re) => re.test(code)).map(String);
};

const collectRust = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectRust(p));
    else if (entry.name.endsWith(".rs")) out.push(p);
  }
  return out.sort();
};

console.log("=== positive control: the detector really detects (no stub) ===");
t(
  "catches a synthetic reqwest dependency",
  crateViolations('reqwest = "0.12"').length === 1
);
t(
  "catches a synthetic tokio dependency",
  crateViolations('tokio = { version = "1", features = ["full"] }').length === 1
);
t(
  "catches a synthetic std::net import",
  codeViolations("use std::net::TcpStream;").length > 0
);
t(
  "catches a synthetic TcpListener",
  codeViolations("let listener = TcpListener::bind(addr)?;").length > 0
);
t(
  "ignores a comment mentioning a network crate",
  codeViolations("// reqwest::get is NOT used here").length === 0
);
t(
  "accepts benign crypto imports",
  codeViolations("use chacha20poly1305::XChaCha20Poly1305;").length === 0
);
t("accepts the url parser dependency", crateViolations('url = "2.5"').length === 0);

console.log("=== real vault-core manifest ===");
const manifest = readFileSync(join(CORE, "Cargo.toml"), "utf8");
const badCrates = crateViolations(manifest);
t("no networking dependencies", badCrates.length === 0, badCrates.join(", "));
t(
  "crypto/storage dependencies are still present",
  /\bargon2\s*=/.test(manifest) && /\bchacha20poly1305\s*=/.test(manifest)
);

console.log("=== real vault-core sources ===");
const rustFiles = collectRust(join(CORE, "src"));
t("vault-core has Rust sources to guard", rustFiles.length >= 10, `${rustFiles.length} files`);
for (const file of rustFiles) {
  const rel = file.slice(ROOT.length + 1).replace(/\\/g, "/");
  const bad = codeViolations(readFileSync(file, "utf8"));
  t(`air-sealed: ${rel}`, bad.length === 0, bad.join(", "));
}

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
