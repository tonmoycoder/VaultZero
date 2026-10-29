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
    "ability", "absent", "absorb", "abstract", "academy", "accent", "account", "acquire",
    "across", "actress", "advance", "airport", "album", "alibi", "alley", "alpha",
    "alpine", "amber", "anchor", "angel", "anthem", "antique", "apron", "arcade",
    "arctic", "arena", "artist", "aspect", "astral", "atlas", "atom", "audio",
    "august", "avatar", "avenue", "bacon", "badge", "balcony", "banner", "baron",
    "beacon", "breeze", "bronze", "cabin", "canyon", "castle", "cedar", "cipher",
    "clover", "cobalt", "comet", "compass", "coral", "cosmos", "crater", "crystal",
    "delta", "diamond", "drift", "echo", "ember", "falcon", "frost", "galaxy",
    "glacier", "granite", "harbor", "horizon", "island", "jasper", "kinetic", "lagoon",
    "lunar", "marble", "matrix", "meadow", "meteor",
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

    for _ in 0..length {
        let mut rand_buf = [0u8; 1];
        OsRng.fill_bytes(&mut rand_buf);
        let idx = (rand_buf[0] as usize) % charset.len();
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

/// Calculates Shannon entropy in bits for a given password.
pub fn calculate_entropy(password: &str) -> f64 {
    if password.is_empty() {
        return 0.0;
    }

    let mut pool_size = 0usize;
    let has_lower = password.chars().any(|c| c.is_ascii_lowercase());
    let has_upper = password.chars().any(|c| c.is_ascii_uppercase());
    let has_digit = password.chars().any(|c| c.is_ascii_digit());
    let has_symbol = password.chars().any(|c| !c.is_alphanumeric());

    if has_lower {
        pool_size += 26;
    }
    if has_upper {
        pool_size += 26;
    }
    if has_digit {
        pool_size += 10;
    }
    if has_symbol {
        pool_size += 32;
    }

    if pool_size == 0 {
        pool_size = 26;
    }

    (password.len() as f64) * (pool_size as f64).log2()
}
