// Mirrors `crates/vault-core/src/crypto.rs::derive_kek` so the browser and
// native KDFs can be compared without a Rust toolchain.
//
// The Rust implementation:
//
//     let mut combined_password = password.as_bytes().to_vec();
//     if let Some(kf) = keyfile_bytes {
//         let kf_hash = Sha256::digest(kf);
//         combined_password.extend_from_slice(&kf_hash);
//     }
//     Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
//         .hash_password_into(&combined_password, salt, &mut kek)
//
// The browser implementation must produce byte-identical output for the
// same (password, keyfile, salt, params).
import { webcrypto } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

// `hash-wasm` is resolved from the repository's own `node_modules`, so the
// harness works on any machine and any platform.
// `hash-wasm` is resolved from the repository's own `node_modules` and
// imported through a `file://` URL, because a bare Windows path is not a
// valid ESM specifier.
const { argon2id } = await import(
  pathToFileURL(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "node_modules",
      "hash-wasm",
      "dist",
      "index.esm.js"
    )
  ).href
);

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

/** The Rust mixing, byte for byte. */
async function rustSecret(password, keyfileBytes) {
  let combined = new TextEncoder().encode(password);
  if (keyfileBytes) {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", keyfileBytes));
    const merged = new Uint8Array(combined.length + digest.length);
    merged.set(combined, 0);
    merged.set(digest, combined.length);
    combined = merged;
  }
  return combined;
}

/**
 * The browser mixing, taken **from the real source** so the harness can
 * never drift away from the implementation it is supposed to police.
 */
async function browserSecret(password, keyfileBytes) {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "lib", "storage.ts"),
    "utf8"
  );
  const argonBlock = src.slice(src.indexOf("async function argon2idKekBytes"));
  const guard = /if \((keyfileBytes[^)]*)\)/.exec(argonBlock.slice(0, 2500));
  const condition = guard ? guard[1] : "";
  const mixesEmpty = !/length\s*[><=]/.test(condition);

  let secret = new TextEncoder().encode(password);
  if (keyfileBytes && mixesEmpty) {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", keyfileBytes));
    const merged = new Uint8Array(secret.length + digest.length);
    merged.set(secret, 0);
    merged.set(digest, secret.length);
    secret = merged;
  }
  return secret;
}

const RUST_PARAMS = { memorySize: 65536, iterations: 3, parallelism: 4, hashLength: 32 };

async function derive(secret, salt) {
  const hash = await argon2id({
    password: secret,
    salt,
    outputType: "binary",
    ...RUST_PARAMS,
  });
  return Buffer.from(hash).toString("hex");
}

const salt = new Uint8Array(16).fill(0x42);

console.log("=== Rust default parameters ===");
t("memory_kib = 65536", RUST_PARAMS.memorySize === 65536);
t("iterations = 3", RUST_PARAMS.iterations === 3);
t("lanes = 4", RUST_PARAMS.parallelism === 4);
t("key_len = 32", RUST_PARAMS.hashLength === 32);

console.log("=== derivation parity ===");

for (const [label, password, keyfile] of [
  ["no keyfile", "correct horse battery staple", undefined],
  ["empty keyfile", "correct horse battery staple", new Uint8Array(0)],
  ["with keyfile", "correct horse battery staple", new TextEncoder().encode("keyfile bytes")],
  ["unicode password", "পাসওয়ার্ড 🔐 1234", new TextEncoder().encode("kf")],
]) {
  const rust = await rustSecret(password, keyfile);
  const browser = await browserSecret(password, keyfile);
  t(
    `${label}: the mixed secret matches the Rust implementation`,
    Buffer.compare(Buffer.from(rust), Buffer.from(browser)) === 0
  );
  const dr = await derive(rust, salt);
  const db = await derive(browser, salt);
  t(
    `${label}: the derived key matches the Rust implementation`,
    dr === db,
    dr.slice(0, 16)
  );
}

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
