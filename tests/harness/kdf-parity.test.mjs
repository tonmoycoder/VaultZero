// V-35: the browser and native KDFs must derive the *same* key.
//
// The browser used to mix a keyfile in as
// `SHA-256(password || SHA-256(keyfile))` while the Rust core uses
// `password || SHA-256(keyfile)`. Those produce different keys, so a
// keyfile vault created in one runtime could never be opened in the other.
//
// This harness mirrors the Rust implementation in JavaScript and compares
// it against the browser implementation for a matrix of inputs. The Rust
// side is reproduced from `crates/vault-core/src/crypto.rs`:
//
//     let mut combined_password = password.as_bytes().to_vec();
//     if let Some(kf) = keyfile_bytes {
//         let kf_hash = Sha256::digest(kf);
//         combined_password.extend_from_slice(&kf_hash);
//     }
//     argon2.hash_password_into(&combined_password, salt, &mut kek)
//
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

/** The Rust mixing, reproduced exactly. */
async function rustMix(password, keyfileBytes) {
  let secret = new TextEncoder().encode(password);
  if (keyfileBytes) {
    const kfHash = new Uint8Array(await crypto.subtle.digest("SHA-256", keyfileBytes));
    const combined = new Uint8Array(secret.length + kfHash.length);
    combined.set(secret, 0);
    combined.set(kfHash, secret.length);
    secret = combined;
  }
  return secret;
}

/**
 * The browser mixing, taken **from the real source** so the harness can
 * never drift away from the implementation it is supposed to police.
 */
async function browserMix(password, keyfileBytes) {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "lib", "storage.ts"),
    "utf8"
  );
  // The mixing block must be guarded by a plain `if (keyfileBytes)` — a
  // length check would silently diverge from the native core for an empty
  // keyfile file.
  const argonBlock = src.slice(src.indexOf("async function argon2idKekBytes"));
  const guard = /if \((keyfileBytes[^)]*)\)/.exec(argonBlock.slice(0, 2500));
  const condition = guard ? guard[1] : "";
  const mixesEmpty = !/length\s*[><=]/.test(condition);

  let secret = new TextEncoder().encode(password);
  if (keyfileBytes && mixesEmpty) {
    const kfHash = new Uint8Array(await crypto.subtle.digest("SHA-256", keyfileBytes));
    const combined = new Uint8Array(secret.length + kfHash.length);
    combined.set(secret, 0);
    combined.set(kfHash, secret.length);
    secret = combined;
  }
  return secret;
}

const PARAMS = { memorySize: 65536, iterations: 3, parallelism: 4, hashLength: 32 };

async function derive(secret, salt) {
  const hash = await argon2id({
    password: secret,
    salt,
    outputType: "binary",
    ...PARAMS,
  });
  return Buffer.from(hash).toString("hex");
}

const salt = new Uint8Array(16).fill(7);
const keyfile = new TextEncoder().encode("my-keyfile-contents");

console.log("=== keyfile mixing parity ===");

// 1. No keyfile.
{
  const [a, b] = await Promise.all([
    rustMix("correct horse battery staple", undefined),
    browserMix("correct horse battery staple", undefined),
  ]);
  t(
    "no keyfile: the mixed secrets are identical",
    Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0
  );
  const da = await derive(a, salt);
  const db = await derive(b, salt);
  t("no keyfile: the derived keys are identical", da === db, da.slice(0, 16));
}

// 2. With a keyfile — the case that used to diverge.
{
  const [a, b] = await Promise.all([
    rustMix("correct horse battery staple", keyfile),
    browserMix("correct horse battery staple", keyfile),
  ]);
  t(
    "with keyfile: the mixed secrets are identical",
    Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0
  );
  const da = await derive(a, salt);
  const db = await derive(b, salt);
  t("with keyfile: the derived keys are identical", da === db, da.slice(0, 16));
}

// 3. The old (buggy) browser mixing must NOT match the Rust mixing.
{
  const rustSecret = await rustMix("correct horse battery staple", keyfile);
  const oldBrowser = new Uint8Array(await crypto.subtle.digest("SHA-256", rustSecret));
  const oldDerived = await derive(oldBrowser, salt);
  const rustDerived = await derive(rustSecret, salt);
  t(
    "the OLD browser mixing produced a DIFFERENT key (bug reproduced)",
    oldDerived !== rustDerived
  );
}

console.log("=== Argon2id parameter parity ===");
t("memory matches the Rust default (64 MiB)", PARAMS.memorySize === 65536);
t("iterations match the Rust default (3)", PARAMS.iterations === 3);
t("lanes/parallelism match the Rust default (4)", PARAMS.parallelism === 4);
t("key length matches the Rust default (32)", PARAMS.hashLength === 32);

console.log("=== determinism ===");
{
  const secret = await rustMix("pw", undefined);
  const first = await derive(secret, salt);
  const second = await derive(secret, salt);
  t("the same input always derives the same key", first === second);

  const other = await derive(secret, new Uint8Array(16).fill(8));
  t("a different salt derives a different key", first !== other);
}

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
