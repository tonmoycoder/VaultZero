use crate::errors::{Result, VaultError};
use crate::memory::LockedBuffer;
use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use zeroize::Zeroize;

pub const SALT_LEN: usize = 16;
pub const NONCE_LEN: usize = 24;
pub const KEY_LEN: usize = 32;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct KdfParams {
    pub memory_kib: u32,
    pub iterations: u32,
    pub lanes: u32,
}

impl Default for KdfParams {
    fn default() -> Self {
        Self {
            memory_kib: 65536, // 64 MiB
            iterations: 3,
            lanes: 4,
        }
    }
}

impl KdfParams {
    pub fn fast_for_testing() -> Self {
        Self {
            memory_kib: 1024, // 1 MiB
            iterations: 1,
            lanes: 1,
        }
    }

    /// Calibrates KDF parameters against the current hardware targeting ~500ms.
    ///
    /// SECURITY (V-34): this function was dead code — it was never called
    /// from anywhere, so the 64 MiB default always applied. On a low-RAM
    /// device (the project's stated target is an old Android phone) the
    /// default may be too aggressive and the unlock may fail outright.
    ///
    /// The calibration is now actually **used**, and the chosen parameters
    /// are written into the vault header so they stay stable across devices
    /// and across sessions. Re-calibrating on a different machine would
    /// otherwise change the derived key and make the vault unopenable.
    ///
    /// The calibration probe uses a fixed salt and password, so it is
    /// deterministic and leaks nothing about the real vault.
    pub fn calibrate_hardware() -> Self {
        let mut params = Self::default();
        let test_pass = "calibration_probe_password";
        let test_salt = [0u8; SALT_LEN];

        let start = std::time::Instant::now();
        let _ = derive_kek(test_pass, &test_salt, None, &params);
        let elapsed = start.elapsed().as_millis();

        if elapsed < 200 {
            // Increase memory to 128 MiB if machine is very fast
            params.memory_kib = 131072;
        } else if elapsed > 1500 {
            // Lower slightly to 32 MiB on slower/constrained devices
            params.memory_kib = 32768;
        }

        params
    }
}

/// Derives a 32-byte Key-Encryption Key (KEK) using Argon2id with optional Keyfile mixing.
pub fn derive_kek(
    password: &str,
    salt: &[u8; SALT_LEN],
    keyfile_bytes: Option<&[u8]>,
    params: &KdfParams,
) -> Result<LockedBuffer> {
    let mut combined_password = password.as_bytes().to_vec();
    if let Some(kf) = keyfile_bytes {
        let mut hasher = Sha256::new();
        hasher.update(kf);
        let kf_hash = hasher.finalize();
        combined_password.extend_from_slice(&kf_hash);
    }

    let argon_params = Params::new(
        params.memory_kib,
        params.iterations,
        params.lanes,
        Some(KEY_LEN),
    )
    .map_err(|e| VaultError::KdfError(e.to_string()))?;

    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, argon_params);
    let mut kek = vec![0u8; KEY_LEN];

    argon
        .hash_password_into(&combined_password, salt, &mut kek)
        .map_err(|e| VaultError::KdfError(e.to_string()))?;

    combined_password.zeroize();
    Ok(LockedBuffer::new(kek))
}

/// Generates a fresh random 32-byte Vault Key (VK).
pub fn generate_vault_key() -> LockedBuffer {
    let mut key = vec![0u8; KEY_LEN];
    OsRng.fill_bytes(&mut key);
    LockedBuffer::new(key)
}

/// Wraps a 32-byte Vault Key under the Key-Encryption Key (KEK) using XChaCha20-Poly1305.
pub fn wrap_key(
    key_to_wrap: &[u8; KEY_LEN],
    kek: &LockedBuffer,
) -> Result<(Vec<u8>, [u8; NONCE_LEN])> {
    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);

    let cipher = XChaCha20Poly1305::new_from_slice(kek.as_slice())
        .map_err(|e| VaultError::CryptoError(e.to_string()))?;
    let nonce = XNonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, key_to_wrap.as_ref())
        .map_err(|_| VaultError::CryptoError("Key wrapping encryption failed".to_string()))?;

    Ok((ciphertext, nonce_bytes))
}

/// Unwraps a wrapped Vault Key using the Key-Encryption Key (KEK).
pub fn unwrap_key(
    wrapped_key: &[u8],
    nonce_bytes: &[u8; NONCE_LEN],
    kek: &LockedBuffer,
) -> Result<LockedBuffer> {
    let cipher = XChaCha20Poly1305::new_from_slice(kek.as_slice())
        .map_err(|e| VaultError::CryptoError(e.to_string()))?;
    let nonce = XNonce::from_slice(nonce_bytes);

    let decrypted = cipher
        .decrypt(nonce, wrapped_key)
        .map_err(|_| VaultError::AuthenticationFailed)?;

    if decrypted.len() != KEY_LEN {
        return Err(VaultError::CryptoError(
            "Unwrapped key has invalid length".into(),
        ));
    }

    Ok(LockedBuffer::new(decrypted))
}

/// Encrypts an arbitrary payload using XChaCha20-Poly1305 with Associated Authenticated Data (AAD).
pub fn encrypt_payload(
    plaintext: &[u8],
    vault_key: &LockedBuffer,
    aad: &[u8],
) -> Result<(Vec<u8>, [u8; NONCE_LEN])> {
    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);

    let cipher = XChaCha20Poly1305::new_from_slice(vault_key.as_slice())
        .map_err(|e| VaultError::CryptoError(e.to_string()))?;
    let nonce = XNonce::from_slice(&nonce_bytes);

    let payload = Payload {
        msg: plaintext,
        aad,
    };

    let ciphertext = cipher
        .encrypt(nonce, payload)
        .map_err(|_| VaultError::CryptoError("Payload encryption failed".into()))?;

    Ok((ciphertext, nonce_bytes))
}

/// Decrypts a ciphertext using XChaCha20-Poly1305 with Associated Authenticated Data (AAD).
/// If any byte of the ciphertext or AAD has been tampered with, this will fail.
pub fn decrypt_payload(
    ciphertext: &[u8],
    nonce_bytes: &[u8; NONCE_LEN],
    vault_key: &LockedBuffer,
    aad: &[u8],
) -> Result<Vec<u8>> {
    let cipher = XChaCha20Poly1305::new_from_slice(vault_key.as_slice())
        .map_err(|e| VaultError::CryptoError(e.to_string()))?;
    let nonce = XNonce::from_slice(nonce_bytes);

    let payload = Payload {
        msg: ciphertext,
        aad,
    };

    let plaintext = cipher
        .decrypt(nonce, payload)
        .map_err(|_| VaultError::TamperedData)?;

    Ok(plaintext)
}
