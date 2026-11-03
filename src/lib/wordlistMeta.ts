/**
 * Metadata about the shared passphrase wordlist.
 *
 * These constants are needed by the generator's entropy display even before
 * a passphrase is generated, so they must stay in a module that does not
 * pull in the 7,772-word list itself.
 *
 * The list itself lives in `wordlist.ts` and is loaded on demand.
 *
 * GENERATED FILE — DO NOT EDIT BY HAND.
 * Source of truth: `crates/vault-core/src/data/wordlist.rs`
 * Regenerate with:  node scripts/generate-wordlist.mjs
 */

/** Number of words in the shared wordlist. */
export const WORDLIST_LEN = 7772;

/** Bits of entropy contributed by a single word drawn from the wordlist. */
export const BITS_PER_WORD = 12.924070;
