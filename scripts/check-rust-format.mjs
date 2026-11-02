#!/usr/bin/env node
/**
 * Checks that every Rust source in the workspace is formatted the way
 * `rustfmt` would format it.
 *
 * `cargo fmt --all -- --check` is the canonical gate, but it needs a Rust
 * toolchain. This script runs the same formatter through WebAssembly, so the
 * check works on any machine that can run Node — including CI jobs that do
 * not install a Rust toolchain and developer machines without `rustup`.
 *
 * The formatter is `rustfmt` itself, compiled to WebAssembly and published as
 * `@scalar/rust-fmt`. It is not a re-implementation, so a file that passes
 * here is formatted exactly the way `rustfmt` formats it.
 *
 * Usage:
 *   node scripts/check-rust-format.mjs          # report and exit non-zero
 *   node scripts/check-rust-format.mjs --write  # format in place
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const write = process.argv.includes("--write");

/**
 * Every Rust source that belongs to a workspace member.
 *
 * `cargo fmt --all` walks the workspace members listed in the root
 * `Cargo.toml`; these are the same two crates.
 */
const ROOTS = [join(root, "crates", "vault-core", "src"), join(root, "src-tauri", "src")];
const EXTRA_FILES = [join(root, "src-tauri", "build.rs")];

/** Collects every `.rs` file below the given directories. */
function collectRustFiles() {
  const found = [];
  for (const dir of ROOTS) {
    for (const entry of globSync("**/*.rs", { cwd: dir })) {
      found.push(join(dir, entry));
    }
  }
  for (const file of EXTRA_FILES) {
    found.push(file);
  }
  return found.sort();
}

/**
 * Loads the WebAssembly formatter.
 *
 * The import is dynamic so that a missing dependency produces a clear
 * message instead of a stack trace from the module loader.
 */
async function loadFormatter() {
  let format;
  try {
    ({ format } = await import("@scalar/rust-fmt"));
  } catch (cause) {
    console.error(
      "The Rust formatter is not installed.\n" +
        "Run: npm ci\n" +
        "It is a dev dependency, so it is not needed for a production build.",
    );
    throw cause;
  }
  return format;
}

async function main() {
  const format = await loadFormatter();
  const files = collectRustFiles();
  const unformatted = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    let formatted;
    try {
      formatted = await format(source, { edition: "2021" });
    } catch (error) {
      console.error(`${relative(root, file)}: the formatter could not parse the file.`);
      console.error(error.message ?? error);
      process.exit(1);
    }
    if (formatted === source) continue;
    if (write) {
      writeFileSync(file, formatted);
      console.log(`formatted ${relative(root, file)}`);
    } else {
      unformatted.push(relative(root, file));
    }
  }

  if (write) {
    console.log(`\n${files.length} Rust file(s) checked.`);
    return;
  }

  if (unformatted.length > 0) {
    console.error("These Rust sources are not formatted the way rustfmt formats them:");
    for (const file of unformatted) console.error(`  ${file}`);
    console.error("\nRun: node scripts/check-rust-format.mjs --write");
    process.exit(1);
  }

  console.log(`${files.length} Rust file(s) are correctly formatted.`);
}

await main();
