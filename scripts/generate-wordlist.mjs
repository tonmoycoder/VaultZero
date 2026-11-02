#!/usr/bin/env node
/**
 * Generates `src/lib/wordlist.ts` from the canonical Rust wordlist at
 * `crates/vault-core/src/data/wordlist.rs`.
 *
 * The Rust file is the single source of truth. Run this after changing it:
 *
 *   node scripts/generate-wordlist.mjs
 *
 * The generated file is committed so the frontend build does not depend on
 * Node at build time — but CI runs this script in `--check` mode to make
 * sure the two never drift.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rustPath = join(root, "crates/vault-core/src/data/wordlist.rs");
const tsPath = join(root, "src/lib/wordlist.ts");

/** Extracts the quoted words from the Rust `WORDLIST` array. */
function parseRustWords(source) {
  const match = source.match(/pub const WORDLIST: \[&str; (\d+)\] = \[([\s\S]*?)\n\];/);
  if (!match) {
    throw new Error(`Could not find WORDLIST array in ${rustPath}`);
  }
  const declared = Number(match[1]);
  const words = [...match[2].matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  if (words.length !== declared) {
    throw new Error(
      `WORDLIST length mismatch: declared ${declared}, parsed ${words.length}`,
    );
  }
  if (new Set(words).size !== words.length) {
    throw new Error("WORDLIST contains duplicate words");
  }
  return words;
}

function render(words) {
  const rows = [];
  for (let i = 0; i < words.length; i += 8) {
    const chunk = words
      .slice(i, i + 8)
      .map((w) => `"${w}"`)
      .join(", ");
    rows.push(`  ${chunk},`);
  }
  return `/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: \`crates/vault-core/src/data/wordlist.rs\`
 * Regenerate with:  node scripts/generate-wordlist.mjs
 *
 * The EFF long wordlist (7,776 entries, CC-BY-3.0) with the four hyphenated
 * entries removed, leaving ${words.length} words.
 *
 * ${words.length} words => ${(Math.log2(words.length)).toFixed(3)} bits per word.
 *   5 words => ${(5 * Math.log2(words.length)).toFixed(2)} bits
 *   6 words => ${(6 * Math.log2(words.length)).toFixed(2)} bits
 */
export const WORDLIST: readonly string[] = [
${rows.join("\n")}
];

/** Number of words in {@link WORDLIST}. */
export const WORDLIST_LEN = ${words.length};

/** Bits of entropy contributed by a single word drawn from {@link WORDLIST}. */
export const BITS_PER_WORD = ${Math.log2(words.length).toFixed(6)};
`;
}

const words = parseRustWords(readFileSync(rustPath, "utf8"));
const output = render(words);

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(tsPath, "utf8");
  } catch {
    /* fall through to the mismatch error below */
  }
  if (current !== output) {
    console.error(
      "src/lib/wordlist.ts is out of sync with the Rust wordlist.\n" +
        "Run: node scripts/generate-wordlist.mjs",
    );
    process.exit(1);
  }
  console.log(`wordlist.ts is in sync (${words.length} words)`);
} else {
  writeFileSync(tsPath, output);
  console.log(
    `Wrote src/lib/wordlist.ts (${words.length} words, ` +
      `${Math.log2(words.length).toFixed(3)} bits/word)`,
  );
}
