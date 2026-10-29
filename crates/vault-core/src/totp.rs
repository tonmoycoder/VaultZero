use crate::errors::{Result, VaultError};
use crate::models::TotpConfig;
use hmac::{Hmac, Mac};
use sha1::Sha1;
use sha2::{Sha256, Sha512};
use url::Url;

type HmacSha1 = Hmac<Sha1>;
type HmacSha256 = Hmac<Sha256>;
type HmacSha512 = Hmac<Sha512>;

/// Decodes standard RFC 4648 Base32 strings (case-insensitive, ignoring whitespace and hyphens).
pub fn decode_base32(input: &str) -> Result<Vec<u8>> {
    let clean: String = input
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .collect();

    let clean = clean.to_ascii_uppercase();
    let mut bits = 0u32;
    let mut bit_count = 0;
    let mut output = Vec::with_capacity((clean.len() * 5) / 8);

    for c in clean.chars() {
        if c == '=' {
            break;
        }
        let val = match c {
            'A'..='Z' => (c as u8 - b'A') as u32,
            '2'..='7' => (c as u8 - b'2' + 26) as u32,
            _ => return Err(VaultError::CryptoError(format!("Invalid base32 character: {}", c))),
        };

        bits = (bits << 5) | val;
        bit_count += 5;

        if bit_count >= 8 {
            bit_count -= 8;
            output.push((bits >> bit_count) as u8);
            bits &= (1 << bit_count) - 1;
        }
    }

    Ok(output)
}

/// Generates an RFC 6238 TOTP code given a base32 secret, epoch timestamp in seconds,
/// time period (usually 30s), digits (6 or 8), and hash algorithm ("SHA1", "SHA256", "SHA512").
/// Returns (code, seconds_remaining).
pub fn generate_totp(
    secret_base32: &str,
    time_epoch_secs: u64,
    period: u64,
    digits: u32,
    algorithm: &str,
) -> Result<(String, u64)> {
    let key = decode_base32(secret_base32)?;
    let period = if period == 0 { 30 } else { period };
    let digits = if digits == 0 { 6 } else { digits };

    let counter = time_epoch_secs / period;
    let remaining = period - (time_epoch_secs % period);
    let counter_bytes = counter.to_be_bytes();

    let hmac_hash = match algorithm.to_ascii_uppercase().as_str() {
        "SHA256" => {
            let mut mac = HmacSha256::new_from_slice(&key)
                .map_err(|e| VaultError::CryptoError(e.to_string()))?;
            mac.update(&counter_bytes);
            mac.finalize().into_bytes().to_vec()
        }
        "SHA512" => {
            let mut mac = HmacSha512::new_from_slice(&key)
                .map_err(|e| VaultError::CryptoError(e.to_string()))?;
            mac.update(&counter_bytes);
            mac.finalize().into_bytes().to_vec()
        }
        _ => {
            // Default to SHA1 (RFC 6238 standard)
            let mut mac = HmacSha1::new_from_slice(&key)
                .map_err(|e| VaultError::CryptoError(e.to_string()))?;
            mac.update(&counter_bytes);
            mac.finalize().into_bytes().to_vec()
        }
    };

    // RFC 4226 Dynamic Truncation
    let offset = (hmac_hash[hmac_hash.len() - 1] & 0x0f) as usize;
    let binary = ((hmac_hash[offset] & 0x7f) as u32) << 24
        | ((hmac_hash[offset + 1] as u32) << 16)
        | ((hmac_hash[offset + 2] as u32) << 8)
        | (hmac_hash[offset + 3] as u32);

    let modulo = 10u32.pow(digits);
    let code_int = binary % modulo;
    let code_str = format!("{:0>width$}", code_int, width = digits as usize);

    Ok((code_str, remaining))
}

/// Parses an otpauth URI according to Google Authenticator key URI format.
/// Example: `otpauth://totp/GitHub:octocat?secret=JBSWY3DPEHPK3PXP&issuer=GitHub`
pub fn parse_otpauth_uri(uri: &str) -> Result<TotpConfig> {
    let parsed = Url::parse(uri)
        .map_err(|e| VaultError::CryptoError(format!("Malformed otpauth URI: {}", e)))?;

    if parsed.scheme() != "otpauth" {
        return Err(VaultError::CryptoError("URI scheme must be otpauth".into()));
    }

    let mut secret = String::new();
    let mut algorithm = "SHA1".to_string();
    let mut digits = 6u32;
    let mut period = 30u64;

    for (k, v) in parsed.query_pairs() {
        match k.to_ascii_lowercase().as_str() {
            "secret" => secret = v.to_string(),
            "algorithm" => algorithm = v.to_uppercase(),
            "digits" => {
                if let Ok(d) = v.parse::<u32>() {
                    digits = d;
                }
            }
            "period" => {
                if let Ok(p) = v.parse::<u64>() {
                    period = p;
                }
            }
            _ => {}
        }
    }

    if secret.is_empty() {
        return Err(VaultError::CryptoError("otpauth URI missing secret query parameter".into()));
    }

    Ok(TotpConfig {
        secret,
        algorithm,
        digits,
        period,
    })
}

