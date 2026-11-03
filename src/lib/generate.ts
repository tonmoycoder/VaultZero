const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const NUMBERS = "23456789";
const SYMBOLS = "!@#$%^&*()_-+=?.";
const AMBIGUOUS = /[Il1O0o]/g;

/**
 * PERFORMANCE: the wordlist is 7,772 entries (~60 KB of text). It used to be
 * imported eagerly, so every visitor paid for the passphrase generator even
 * if they never opened it.
 *
 * `WORDLIST_LEN` and `BITS_PER_WORD` are compile-time constants and stay
 * eager — they are needed for the entropy display. The list itself is
 * loaded on demand, the first time a passphrase is actually generated.
 */
import { BITS_PER_WORD, WORDLIST_LEN } from "./wordlistMeta";
export { WORDLIST_LEN, BITS_PER_WORD };

let wordlistPromise: Promise<readonly string[]> | null = null;

/** Loads the shared wordlist on first use. */
async function loadWordlist(): Promise<readonly string[]> {
  if (!wordlistPromise) {
    wordlistPromise = import("./wordlist").then((module) => module.WORDLIST);
  }
  return wordlistPromise;
}

function secureRandomInt(max: number) {
  if (max <= 0) return 0;
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    const limit = Math.floor(0xffffffff / max) * max;
    let value = 0;
    do {
      crypto.getRandomValues(array);
      value = array[0];
    } while (value >= limit);
    return value % max;
  }
  return Math.floor(Math.random() * max);
}

export type GeneratorOptions = {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
};

export const defaultGeneratorOptions: GeneratorOptions = {
  length: 22,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
  avoidAmbiguous: true,
};

export function generatePassword(options: GeneratorOptions = defaultGeneratorOptions) {
  let pools = "";
  if (options.lowercase) pools += LOWER;
  if (options.uppercase) pools += UPPER;
  if (options.numbers) pools += NUMBERS;
  if (options.symbols) pools += SYMBOLS;
  if (options.avoidAmbiguous) pools = pools.replace(AMBIGUOUS, "");
  if (!pools) pools = LOWER;
  const length = Math.max(8, Math.min(64, options.length));
  let output = "";
  for (let i = 0; i < length; i += 1) output += pools[secureRandomInt(pools.length)];

  // Guarantee every enabled pool is represented.
  const required = [
    options.lowercase ? LOWER : "",
    options.uppercase ? UPPER : "",
    options.numbers ? NUMBERS : "",
    options.symbols ? SYMBOLS : "",
  ].filter(Boolean);
  required.forEach((pool, index) => {
    const clean = options.avoidAmbiguous ? pool.replace(AMBIGUOUS, "") : pool;
    if (clean && index < length) {
      const chars = output.split("");
      chars[index] = clean[secureRandomInt(clean.length)];
      output = chars.join("");
    }
  });
  return output;
}

/**
 * Generates a passphrase from the shared EFF wordlist.
 *
 * Words are drawn **without replacement**, so a 5-word passphrase always
 * contains 5 distinct words. This matters: with replacement, the chance of
 * a repeated word grows with the word count and the real entropy is lower
 * than `wordCount * log2(WORDLIST_LEN)`.
 */
export async function generatePassphrase(
  wordCount = 5,
  separator = "-",
  capitalize = true
): Promise<string> {
  const count = Math.max(3, Math.min(12, Math.floor(wordCount)));
  const source = await loadWordlist();
  const pool = source.slice();

  // Fisher-Yates partial shuffle, then take the first `count` entries.
  for (let i = 0; i < count; i += 1) {
    const j = i + secureRandomInt(pool.length - i);
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  const words: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const word = pool[i];
    words.push(capitalize ? word[0].toUpperCase() + word.slice(1) : word);
  }
  return words.join(separator) + "!" + secureRandomInt(90 + 10);
}

/**
 * Reports the *actual* entropy of a generated passphrase.
 *
 * The previous implementation reported `wordCount * log2(list.length)` while
 * allowing repeated words and appending an uncounted `!<digit>` suffix.
 * This counts the suffix, penalises repetition, and reflects the
 * without-replacement draw used by {@link generatePassphrase}.
 */
export function passphraseEntropy(wordCount = 5): number {
  const count = Math.max(1, Math.floor(wordCount));
  if (count > WORDLIST_LEN) return BITS_PER_WORD * WORDLIST_LEN;

  // Without replacement: log2(N!/(N-k)!)
  let withoutReplacement = 0;
  for (let i = 0; i < count; i += 1) {
    withoutReplacement += Math.log2(WORDLIST_LEN - i);
  }

  // The trailing "!" is fixed; the digit is uniform over 100 values.
  const suffixBits = Math.log2(100);
  return Math.round((withoutReplacement + suffixBits) * 100) / 100;
}

export function passwordStrength(password: string) {
  let points = 0;
  if (password.length >= 12) points += 1;
  if (password.length >= 18) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/\d/.test(password)) points += 1;
  if (/[^A-Za-z0-9]/.test(password)) points += 1;
  const score = Math.max(1, Math.min(4, Math.round((points / 5) * 4) || 1));
  return {
    score,
    label: score >= 4 ? "Excellent" : score === 3 ? "Strong" : score === 2 ? "Fair" : "Weak",
    color: score >= 4 ? "var(--success)" : score === 3 ? "var(--success)" : score === 2 ? "var(--warning)" : "var(--danger)",
    entropy: Math.round(password.length * Math.log2(Math.max(new Set(password).size, 2))),
  };
}
