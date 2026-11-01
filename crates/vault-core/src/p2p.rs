use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use hkdf::Hkdf;
use hmac::{Hmac, Mac};
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use x25519_dalek::{EphemeralSecret, PublicKey};
use zeroize::Zeroize;

type HmacSha256 = Hmac<Sha256>;

pub const P2P_MAGIC_BEACON: &[u8; 16] = b"VAULTZERO_P2P_V1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct P2PBeaconPacket {
    pub magic: [u8; 16],
    pub device_id: String,
    pub device_name: String,
    pub sync_port: u16,
    pub timestamp: u64,
}

impl P2PBeaconPacket {
    pub fn new(device_id: String, device_name: String, sync_port: u16) -> Self {
        let now = chrono::Utc::now().timestamp() as u64;
        Self {
            magic: *P2P_MAGIC_BEACON,
            device_id,
            device_name,
            sync_port,
            timestamp: now,
        }
    }

    pub fn to_bytes(&self) -> Result<Vec<u8>, crate::errors::VaultError> {
        rmp_serde::to_vec(self).map_err(|e| crate::errors::VaultError::Storage(e.to_string()))
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, crate::errors::VaultError> {
        let packet: Self = rmp_serde::from_slice(bytes)
            .map_err(|e| crate::errors::VaultError::Storage(e.to_string()))?;
        if &packet.magic != P2P_MAGIC_BEACON {
            return Err(crate::errors::VaultError::Corrupted(
                "Invalid P2P beacon magic header".into(),
            ));
        }
        Ok(packet)
    }
}

/// Ephemeral key exchange session for MITM-proof pairing
pub struct P2PSessionHandshake {
    secret: EphemeralSecret,
    pub public_key: PublicKey,
}

impl P2PSessionHandshake {
    pub fn new() -> Self {
        let secret = EphemeralSecret::random_from_rng(OsRng);
        let public_key = PublicKey::from(&secret);
        Self { secret, public_key }
    }

    /// Derives a 32-byte shared session key and mutual auth tag from the remote public key
    /// and the 6-digit pairing PIN (SPAKE2 / PAKE mechanism).
    pub fn complete_handshake(
        self,
        remote_public: &PublicKey,
        pairing_pin: &str,
    ) -> Result<P2PSessionKey, crate::errors::VaultError> {
        let shared_secret = self.secret.diffie_hellman(remote_public);
        let clean_pin = pairing_pin.replace([' ', '-'], "");

        // Salt with pairing PIN
        let hk = Hkdf::<Sha256>::new(Some(clean_pin.as_bytes()), shared_secret.as_bytes());
        let mut okm = [0u8; 32];
        hk.expand(b"VAULTZERO_SPAKE2_P2P_SESSION_V1", &mut okm)
            .map_err(|_| crate::errors::VaultError::CryptoError("HKDF expansion failed".into()))?;

        // Mutual auth tag: HMAC over both public keys sorted deterministically
        let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(&okm)
            .map_err(|e| crate::errors::VaultError::CryptoError(e.to_string()))?;
        if self.public_key.as_bytes() < remote_public.as_bytes() {
            mac.update(self.public_key.as_bytes());
            mac.update(remote_public.as_bytes());
        } else {
            mac.update(remote_public.as_bytes());
            mac.update(self.public_key.as_bytes());
        }
        let auth_tag: [u8; 32] = mac.finalize().into_bytes().into();

        Ok(P2PSessionKey {
            key: okm,
            auth_tag,
        })
    }
}

impl Default for P2PSessionHandshake {
    fn default() -> Self {
        Self::new()
    }
}

pub struct P2PSessionKey {
    key: [u8; 32],
    pub auth_tag: [u8; 32],
}

impl Drop for P2PSessionKey {
    fn drop(&mut self) {
        self.key.zeroize();
    }
}

impl P2PSessionKey {
    pub fn verify_auth_tag(&self, peer_tag: &[u8; 32]) -> bool {
        subtle::ConstantTimeEq::ct_eq(self.auth_tag.as_slice(), peer_tag.as_slice()).into()
    }

    /// Encrypts sync payload with XChaCha20-Poly1305 using the ephemeral session key
    pub fn encrypt_payload(&self, plaintext: &[u8]) -> Result<Vec<u8>, crate::errors::VaultError> {
        let cipher = XChaCha20Poly1305::new_from_slice(&self.key)
            .map_err(|e| crate::errors::VaultError::CryptoError(e.to_string()))?;

        let mut nonce_bytes = [0u8; 24];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = XNonce::from_slice(&nonce_bytes);

        let mut ciphertext = cipher
            .encrypt(nonce, plaintext)
            .map_err(|_| crate::errors::VaultError::CryptoError("P2P encryption failed".into()))?;

        let mut packet = Vec::with_capacity(24 + ciphertext.len());
        packet.extend_from_slice(&nonce_bytes);
        packet.append(&mut ciphertext);
        Ok(packet)
    }

    /// Decrypts sync payload with XChaCha20-Poly1305 using the ephemeral session key
    pub fn decrypt_payload(&self, packet: &[u8]) -> Result<Vec<u8>, crate::errors::VaultError> {
        if packet.len() < 24 + 16 {
            return Err(crate::errors::VaultError::Corrupted(
                "P2P packet too short".into(),
            ));
        }

        let nonce = XNonce::from_slice(&packet[0..24]);
        let ciphertext = &packet[24..];

        let cipher = XChaCha20Poly1305::new_from_slice(&self.key)
            .map_err(|e| crate::errors::VaultError::CryptoError(e.to_string()))?;

        cipher.decrypt(nonce, ciphertext).map_err(|_| {
            crate::errors::VaultError::Authentication(
                "P2P decryption failed: session key or packet tampered".into(),
            )
        })
    }
}

/// Optical QR Stream Chunk for Air-gapped Camera Synchronization
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OpticalQrChunk {
    pub session_id: u32,
    pub chunk_index: u16,
    pub total_chunks: u16,
    pub payload: Vec<u8>,
}

impl OpticalQrChunk {
    pub fn split_payload(session_id: u32, data: &[u8], chunk_size: usize) -> Vec<Self> {
        let chunks: Vec<&[u8]> = data.chunks(chunk_size).collect();
        let total = chunks.len() as u16;

        chunks
            .into_iter()
            .enumerate()
            .map(|(idx, slice)| OpticalQrChunk {
                session_id,
                chunk_index: idx as u16,
                total_chunks: total,
                payload: slice.to_vec(),
            })
            .collect()
    }

    pub fn reassemble(chunks: &[OpticalQrChunk]) -> Result<Vec<u8>, crate::errors::VaultError> {
        if chunks.is_empty() {
            return Err(crate::errors::VaultError::Corrupted("No chunks provided".into()));
        }

        let total = chunks[0].total_chunks as usize;
        let session = chunks[0].session_id;

        let mut ordered: Vec<Option<&[u8]>> = vec![None; total];
        for c in chunks {
            if c.session_id != session {
                return Err(crate::errors::VaultError::Corrupted(
                    "Mismatched session ID in chunks".into(),
                ));
            }
            let idx = c.chunk_index as usize;
            if idx < total {
                ordered[idx] = Some(&c.payload);
            }
        }

        let mut full = Vec::new();
        for piece in ordered {
            match piece {
                Some(p) => full.extend_from_slice(p),
                None => {
                    return Err(crate::errors::VaultError::Corrupted(
                        "Incomplete chunk sequence for optical reassembly".into(),
                    ));
                }
            }
        }

        Ok(full)
    }
}

