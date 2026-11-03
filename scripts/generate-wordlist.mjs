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
const metaPath = join(root, "src/lib/wordlistMeta.ts");

/** Extracts the quoted words from the Rust `WORDLIST` array. */
function parseRustWords(source) {
  /*
   * The list is accepted as a `const` or as a `static`.
   *
   * The list is large enough that it belongs in the binary once rather
   * than once per use, so it is a `static` now. The reader accepts
   * both forms so that the choice of keyword is not something that
   * breaks the generator.
   */
  const match = source.match(
    /pub (?:const|static) WORDLIST: \[&str; (\d+)\] = \[([\s\S]*?)\n\];/
  );
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

function renderList(words) {
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

// The list metadata lives in \`wordlistMeta.ts\` so that importing the
// constants never pulls this 88 KB module into the initial bundle.
`;
}

/**
 * Renders the metadata module.
 *
 * The metadata is deliberately kept in a separate file: the generator UI
 * needs `WORDLIST_LEN` and `BITS_PER_WORD` before a passphrase is ever
 * generated, and importing them from `wordlist.ts` would pull the whole
 * 88 KB list into the initial bundle and defeat the lazy loading.
 */
function renderMeta(words) {
  return `/**
 * Metadata about the shared passphrase wordlist.
 *
 * These constants are needed by the generator's entropy display even before
 * a passphrase is generated, so they must stay in a module that does not
 * pull in the 7,772-word list itself.
 *
 * The list itself lives in \`wordlist.ts\` and is loaded on demand.
 *
 * GENERATED FILE — DO NOT EDIT BY HAND.
 * Source of truth: \`crates/vault-core/src/data/wordlist.rs\`
 * Regenerate with:  node scripts/generate-wordlist.mjs
 */

/** Number of words in the shared wordlist. */
export const WORDLIST_LEN = ${words.length};

/** Bits of entropy contributed by a single word drawn from the wordlist. */
export const BITS_PER_WORD = ${Math.log2(words.length).toFixed(6)};
`;
}

const words = parseRustWords(readFileSync(rustPath, "utf8"));
const listOutput = renderList(words);
const metaOutput = renderMeta(words);

if (process.argv.includes("--check")) {
  const targets = [
    [tsPath, listOutput, "src/lib/wordlist.ts"],
    [metaPath, metaOutput, "src/lib/wordlistMeta.ts"],
  ];
  let drifted = false;
  for (const [path, expected, label] of targets) {
    let current = "";
    try {
      current = readFileSync(path, "utf8");
    } catch {
      /* fall through to the mismatch error below */
    }
    if (current !== expected) {
      drifted = true;
      console.error(`${label} is out of sync with the Rust wordlist.`);
    }
  }
  if (drifted) {
    console.error("Run: node scripts/generate-wordlist.mjs");
    process.exit(1);
  }
  console.log(`wordlist.ts and wordlistMeta.ts are in sync (${words.length} words)`);
} else {
  writeFileSync(tsPath, listOutput);
  writeFileSync(metaPath, metaOutput);
  console.log(
    `Wrote src/lib/wordlist.ts and src/lib/wordlistMeta.ts ` +
      `(${words.length} words, ${Math.log2(words.length).toFixed(3)} bits/word)`,
  );
}
