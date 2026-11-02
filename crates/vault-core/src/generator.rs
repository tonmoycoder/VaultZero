use rand::rngs::OsRng;
use rand::seq::SliceRandom;
use rand::RngCore;

#[derive(Debug, Clone)]
pub struct PasswordGenOptions {
    pub length: usize,
    pub include_uppercase: bool,
    pub include_lowercase: bool,
    pub include_numbers: bool,
    pub include_symbols: bool,
    pub exclude_ambiguous: bool, // Exclude O, 0, I, l, 1, etc.
}

impl Default for PasswordGenOptions {
    fn default() -> Self {
        Self {
            length: 18,
            include_uppercase: true,
            include_lowercase: true,
            include_numbers: true,
            include_symbols: true,
            exclude_ambiguous: true,
        }
    }
}

const UPPERCASE_ALL: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const UPPERCASE_SAFE: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ"; // No I, O

const LOWERCASE_ALL: &[u8] = b"abcdefghijklmnopqrstuvwxyz";
const LOWERCASE_SAFE: &[u8] = b"abcdefghijkmnopqrstuvwxyz"; // No l

const NUMBERS_ALL: &[u8] = b"0123456789";
const NUMBERS_SAFE: &[u8] = b"23456789"; // No 0, 1

const SYMBOLS: &[u8] = b"!@#$%^&*()-_=+[]{}|;:,.<>?";

/// 77-word EFF Diceware curated compact offline list
const DICEWARE_WORDLIST: &[&str] = &[
    "ability", "absent", "absorb", "abstract", "academy", "accent", "account", "acquire", "across",
    "actress", "advance", "airport", "album", "alibi", "alley", "alpha", "alpine", "amber",
    "anchor", "angel", "anthem", "antique", "apron", "arcade", "arctic", "arena", "artist",
    "aspect", "astral", "atlas", "atom", "audio", "august", "avatar", "avenue", "bacon", "badge",
    "balcony", "banner", "baron", "beacon", "breeze", "bronze", "cabin", "canyon", "castle",
    "cedar", "cipher", "clover", "cobalt", "comet", "compass", "coral", "cosmos", "crater",
    "crystal", "delta", "diamond", "drift", "echo", "ember", "falcon", "frost", "galaxy",
    "glacier", "granite", "harbor", "horizon", "island", "jasper", "kinetic", "lagoon", "lunar",
    "marble", "matrix", "meadow", "meteor",
];

/// Generates a high-entropy CSPRNG password based on configuration options.
pub fn generate_password(opts: &PasswordGenOptions) -> String {
    let mut charset: Vec<u8> = Vec::new();

    if opts.include_uppercase {
        charset.extend_from_slice(if opts.exclude_ambiguous {
            UPPERCASE_SAFE
        } else {
            UPPERCASE_ALL
        });
    }
    if opts.include_lowercase {
        charset.extend_from_slice(if opts.exclude_ambiguous {
            LOWERCASE_SAFE
        } else {
            LOWERCASE_ALL
        });
    }
    if opts.include_numbers {
        charset.extend_from_slice(if opts.exclude_ambiguous {
            NUMBERS_SAFE
        } else {
            NUMBERS_ALL
        });
    }
    if opts.include_symbols {
        charset.extend_from_slice(SYMBOLS);
    }

    if charset.is_empty() {
        charset.extend_from_slice(LOWERCASE_SAFE);
    }

    let length = opts.length.clamp(6, 128);
    let mut password = Vec::with_capacity(length);

    // SECURITY (V-08): rejection sampling instead of `byte % charset.len()`.
    // A single random byte is uniform over 0..=255, but `256 % n != 0` for
    // every real charset size, so the first `256 % n` characters were
    // measurably over-represented (e.g. ~1.35x for n=78). We draw a u32 and
    // reject the biased tail instead, giving a provably uniform selection.
    let n = charset.len() as u32;
    // Largest multiple of n that fits in u32; anything at or above is biased.
    let limit = u32::MAX - (u32::MAX % n);

    while password.len() < length {
        let mut buf = [0u8; 4];
        OsRng.fill_bytes(&mut buf);
        let value = u32::from_le_bytes(buf);
        if value >= limit {
            continue; // Reject the biased tail and draw again.
        }
        let idx = (value % n) as usize;
        password.push(charset[idx]);
    }

    String::from_utf8(password).unwrap_or_else(|_| "GeneratedPass123!".to_string())
}

/// Generates an EFF Diceware passphrase with random words separated by a delimiter.
pub fn generate_passphrase(word_count: usize, separator: &str, capitalize: bool) -> String {
    let count = word_count.clamp(3, 10);
    let mut words = Vec::with_capacity(count);

    for _ in 0..count {
        if let Some(word) = DICEWARE_WORDLIST.choose(&mut OsRng) {
            let mut w = word.to_string();
            if capitalize {
                let mut chars = w.chars();
                if let Some(first) = chars.next() {
                    w = format!("{}{}", first.to_uppercase(), chars.as_str());
                }
            }
            words.push(w);
        }
    }

    words.join(separator)
}

/// Calculates the estimated entropy in bits for a given password.
///
/// SECURITY (V-09): the previous implementation computed
/// `len * log2(pool_size)` where `pool_size` was derived from the *character
/// classes present*. That treats every character as an independent uniform
/// draw from the whole pool, which badly overstates the entropy of
/// repetitive passwords: `"aaaaaaaaaaaa"` (12 chars) was reported as
/// `12 * log2(26) = 56.9` bits when its real entropy is ~0.
///
/// The estimate below uses the **observed** character set, so the pool is
/// exactly the set of characters that actually occur, and additionally
/// applies penalties for the structural patterns that dominate real-world
/// password reuse:
///
/// * **Repetition penalty** — a password built from fewer distinct
///   characters than it has positions is discounted.
/// * **Sequence penalty** — runs of adjacent characters (`abc`, `123`, `xyz`)
///   and repeated blocks (`abcabc`) are discounted.
/// * **Dictionary penalty** — passwords that are (or contain) a common word
///   are discounted towards the size of that word rather than the full
///   character pool.
///
/// The result is a *conservative* estimate: it never claims more entropy than
/// the password plausibly has.
pub fn calculate_entropy(password: &str) -> f64 {
    if password.is_empty() {
        return 0.0;
    }

    let chars: Vec<char> = password.chars().collect();
    let len = chars.len();
    if len == 0 {
        return 0.0;
    }

    // Observed character pool: the set of characters that actually occur.
    let mut seen = std::collections::HashSet::new();
    for &c in &chars {
        seen.insert(c);
    }
    let distinct = seen.len();

    // Base entropy from the observed pool.
    let mut entropy = (len as f64) * (distinct as f64).log2();

    // Penalty 1 — repetition: if the password uses far fewer distinct
    // characters than it has positions, the effective pool is the distinct set
    // and the length contributes far less than `len * log2(distinct)`.
    // A password of `n` distinct characters repeated is essentially `distinct`
    // worth of entropy, so scale down accordingly.
    if distinct < len {
        let repetition_ratio = distinct as f64 / len as f64;
        entropy *= 0.25 + 0.75 * repetition_ratio;
    }

    // Penalty 2 — sequential runs (e.g. "abcdef", "123456", "qwerty").
    let mut seq_runs = 0usize;
    for w in chars.windows(3) {
        let a = w[0] as u32;
        let b = w[1] as u32;
        let c = w[2] as u32;
        let ascending = b == a + 1 && c == b + 1;
        let descending = b + 1 == a && b + 1 == c;
        if ascending || descending {
            seq_runs += 1;
        }
    }
    if seq_runs > 0 {
        let seq_ratio = seq_runs as f64 / (len.saturating_sub(2).max(1)) as f64;
        entropy *= 1.0 - 0.5 * seq_ratio.min(1.0);
    }

    // Penalty 3 — repeated blocks (e.g. "abcabcabc").
    for block in [2usize, 3, 4] {
        if len >= block * 2 && len % block == 0 {
            let mut is_repeating = true;
            for i in 0..(len / block) {
                for j in 0..block {
                    if chars[i * block + j] != chars[j] {
                        is_repeating = false;
                        break;
                    }
                }
                if !is_repeating {
                    break;
                }
            }
            if is_repeating {
                entropy *= 0.4;
                break;
            }
        }
    }

    // Penalty 4 — common-word / dictionary content. If the password is
    // substantially made of a well-known word, cap the estimate at what that
    // word could contribute.
    if let Some(cap) = dictionary_entropy_cap(&chars) {
        if entropy > cap {
            entropy = cap;
        }
    }

    entropy.max(0.0)
}

/// If the password contains a common word as its dominant component, returns
/// an upper bound on its entropy (roughly the bits needed to guess that word
/// plus a small allowance for the surrounding characters).
fn dictionary_entropy_cap(chars: &[char]) -> Option<f64> {
    let lower: String = chars.iter().collect::<String>().to_lowercase();

    for word in COMMON_WORDS {
        if word.len() < 3 {
            continue;
        }
        if lower.contains(word) {
            // Roughly log2(number of common words) for the word itself, plus
            // 4 bits per remaining character.
            let word_bits = 12.0f64; // ~4000 common words
            let extra = (lower.len().saturating_sub(word.len())) as f64 * 4.0;
            return Some(word_bits + extra);
        }
    }
    None
}

/// A compact list of extremely common password words used for the
/// dictionary entropy cap. This is intentionally small and offline.
const COMMON_WORDS: &[&str] = &[
    "password",
    "admin",
    "welcome",
    "letmein",
    "login",
    "master",
    "shadow",
    "sunshine",
    "princess",
    "football",
    "dragon",
    "monkey",
    "superman",
    "batman",
    "trustno1",
    "iloveyou",
    "starwars",
    "whatever",
    "qwerty",
    "abc123",
    "changeme",
    "secret",
    "computer",
    "internet",
    "service",
    "google",
    "facebook",
    "instagram",
    "linkedin",
];
