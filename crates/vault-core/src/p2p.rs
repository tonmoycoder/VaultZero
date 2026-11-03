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

/// Domain separation label for the pairing key schedule.
const P2P_KDF_INFO: &[u8] = b"VAULTZERO_P2P_PAIRING_V2";
/// Domain separation label for the direction-separated payload key.
const P2P_PAYLOAD_INFO: &[u8] = b"VAULTZERO_P2P_PAYLOAD_V2";
/// Domain separation label for the mutual authentication transcript.
const P2P_AUTH_INFO: &[u8] = b"VAULTZERO_P2P_AUTH_V2";
/// Domain separation label for the channel binding check.
const P2P_BINDING_INFO: &[u8] = b"VAULTZERO_P2P_BINDING_V2";

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

/// Role of a participant in the pairing handshake. Binding the role into the
/// transcript prevents reflection attacks where a peer replays our own
/// messages back at us.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum P2PRole {
    /// The device that exposes the sync host.
    Host,
    /// The device that connects to the host.
    Client,
}

impl P2PRole {
    fn as_byte(self) -> u8 {
        match self {
            P2PRole::Host => 0x01,
            P2PRole::Client => 0x02,
        }
    }

    /// The role of the other peer. Tags are direction-specific, so a peer's
    /// tag must be recomputed for *that* role rather than compared to ours.
    fn peer(self) -> Self {
        match self {
            P2PRole::Host => P2PRole::Client,
            P2PRole::Client => P2PRole::Host,
        }
    }
}

/// Ephemeral key exchange session for MITM-proof pairing.
///
/// # Security model
///
/// The pairing PIN is a low-entropy secret (~20 bits for a 6-digit code), so it
/// cannot by itself authenticate the exchange. Instead of deriving the session
/// key from the raw X25519 secret (which an active MitM silently substitutes
/// *before* the PIN is ever checked), we use a **transcript-bound PAKE-style**
/// construction:
///
/// 1. Both peers exchange their ephemeral X25519 public keys.
/// 2. The shared secret is **never** used directly. It is mixed with the PIN
///    through an HMAC-based key schedule that also binds both public keys and
///    the negotiated roles. Because the PIN participates *before* the final key
///    is emitted, a substituted public key yields a different derived key and
///    the mutual authentication tag check fails.
/// 3. Each side proves possession of the derived key by sending a MAC over
///    the **complete transcript** (both public keys, both roles, and both
///    authentication tags). A MitM who does not know the PIN cannot produce a
///    valid tag for the transcript it forged.
///
/// The resulting key is then split into independent subkeys via HKDF so that
/// the payload cipher key and the authentication key are never equal.
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

    /// Derives a 32-byte shared session key and mutual auth tag from the remote
    /// public key and the pairing PIN.
    ///
    /// The returned [`P2PSessionKey`] carries a **transcript binding hash**
    /// that both peers must compare; see [`P2PSessionKey::verify_transcript`].
    pub fn complete_handshake(
        self,
        remote_public: &PublicKey,
        pairing_pin: &str,
        local_role: P2PRole,
        remote_role: P2PRole,
    ) -> Result<P2PSessionKey, crate::errors::VaultError> {
        let shared_secret = self.secret.diffie_hellman(remote_public);
        let clean_pin = normalize_pin(pairing_pin);

        if clean_pin.is_empty() {
            return Err(crate::errors::VaultError::CryptoError(
                "Pairing PIN must not be empty".into(),
            ));
        }

        // Step 1: Build the canonical transcript. Both public keys are sorted
        // so that both peers compute the identical byte string regardless of
        // message ordering, while the roles keep the two directions distinct.
        //
        // IMPORTANT: the role must be attached to a key by *key identity*, not
        // by position. Both peers must derive the exact same sorted->role
        // mapping, otherwise their transcripts diverge and the mutual
        // authentication check fails for honest peers.
        let mut transcript = Vec::with_capacity(2 * 32 + 4);
        let own_pub = self.public_key.as_bytes();
        let remote_pub = remote_public.as_bytes();
        let (first, second) = if own_pub < remote_pub {
            (own_pub, remote_pub)
        } else {
            (remote_pub, own_pub)
        };
        // The key that is "ours" carries our role; the other carries the
        // peer's role. Both peers know which key is theirs, so both agree.
        let (first_role, second_role) = if first == own_pub {
            (local_role, remote_role)
        } else {
            (remote_role, local_role)
        };
        transcript.extend_from_slice(first);
        transcript.extend_from_slice(second);
        transcript.push(first_role.as_byte());
        transcript.push(second_role.as_byte());

        // Step 2: PIN-keyed mixing. The PIN is used as an HMAC key over the
        // raw shared secret and the transcript, so a MitM that substitutes a
        // public key ends up with completely different derived key material.
        let mut pin_mixer = <HmacSha256 as hmac::Mac>::new_from_slice(clean_pin.as_bytes())
            .map_err(|e| crate::errors::VaultError::CryptoError(e.to_string()))?;
        pin_mixer.update(shared_secret.as_bytes());
        pin_mixer.update(&transcript);
        let mixed = pin_mixer.finalize().into_bytes();

        // Step 3: HKDF expansion into independent subkeys.
        // `mixed` is the HKDF salt and the raw shared secret is the IKM, so
        // the final key depends on BOTH the PIN and the DH result.
        let hk = Hkdf::<Sha256>::new(Some(&mixed), shared_secret.as_bytes());
        let mut okm = [0u8; 32];
        hk.expand(P2P_KDF_INFO, &mut okm)
            .map_err(|_| crate::errors::VaultError::CryptoError("HKDF expansion failed".into()))?;

        // Step 4: Mutual authentication tag bound to the full transcript.
        // The tag is *direction-specific* (it includes our own role), so each
        // side verifies the tag it receives against the peer's role.
        let auth_tag = compute_auth_tag(&okm, &transcript, local_role)?;

        // Step 5: Channel binding hash. Both peers derive this from the same
        // session key, so it matches only when the transcript was identical —
        // i.e. when no key was substituted. This is the check that rejects a
        // man-in-the-middle.
        let bind_hk = Hkdf::<Sha256>::new(None, okm.as_ref());
        let mut binding = [0u8; 32];
        bind_hk
            .expand(P2P_BINDING_INFO, &mut binding)
            .map_err(|_| crate::errors::VaultError::CryptoError("HKDF expansion failed".into()))?;

        Ok(P2PSessionKey {
            key: okm,
            auth_tag,
            binding,
            transcript,
            role: local_role,
        })
    }
}

impl Default for P2PSessionHandshake {
    fn default() -> Self {
        Self::new()
    }
}

/// Derives a separate authentication subkey and MACs the transcript for one
/// direction of the pairing.
///
/// V-45: the tag used to be `HMAC(session_key, transcript || own_role)` and
/// `verify_auth_tag` compared two tags for equality. Honest peers have
/// different roles, so their tags can never be equal and mutual
/// authentication always failed. Verification now recomputes the tag the
/// peer must have produced.
fn compute_auth_tag(
    session_key: &[u8; 32],
    transcript: &[u8],
    role: P2PRole,
) -> Result<[u8; 32], crate::errors::VaultError> {
    let hk = Hkdf::<Sha256>::new(None, session_key);
    let mut auth_key = [0u8; 32];
    hk.expand(P2P_AUTH_INFO, &mut auth_key)
        .map_err(|_| crate::errors::VaultError::CryptoError("HKDF expansion failed".into()))?;

    let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(&auth_key)
        .map_err(|e| crate::errors::VaultError::CryptoError(e.to_string()))?;
    mac.update(transcript);
    mac.update(&[role.as_byte()]);
    let tag: [u8; 32] = mac.finalize().into_bytes().into();
    auth_key.zeroize();
    Ok(tag)
}

/// Normalizes a pairing PIN: strips whitespace and separators, uppercases.
pub fn normalize_pin(pin: &str) -> String {
    pin.chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .map(|c| c.to_ascii_uppercase())
        .collect()
}

pub struct P2PSessionKey {
    key: [u8; 32],
    /// Role of the local peer, used to derive the peer's expected auth tag.
    role: P2PRole,
    pub auth_tag: [u8; 32],
    /// Transcript binding hash. Both peers MUST verify that these match.
    pub binding: [u8; 32],
    /// Canonical transcript used to derive the tags.
    pub transcript: Vec<u8>,
}

impl Drop for P2PSessionKey {
    fn drop(&mut self) {
        self.key.zeroize();
    }
}

impl P2PSessionKey {
    pub fn verify_auth_tag(&self, peer_tag: &[u8; 32]) -> bool {
        let Ok(expected) = compute_auth_tag(&self.key, &self.transcript, self.role.peer()) else {
            return false;
        };
        subtle::ConstantTimeEq::ct_eq(expected.as_slice(), peer_tag.as_slice()).into()
    }

    /// Verifies that the peer's channel binding hash matches ours. This is the
    /// check that actually rejects a MitM: both peers derive the binding hash
    /// from the *same* transcript, so a substituted public key changes it.
    pub fn verify_transcript(&self, peer_binding: &[u8; 32]) -> bool {
        subtle::ConstantTimeEq::ct_eq(self.binding.as_slice(), peer_binding.as_slice()).into()
    }

    /// Derives the direction-separated payload encryption key.
    fn payload_key(&self, direction: u8) -> Result<[u8; 32], crate::errors::VaultError> {
        let hk = Hkdf::<Sha256>::new(None, self.key.as_ref());
        let mut okm = [0u8; 32];
        hk.expand(&[P2P_PAYLOAD_INFO, &[direction]].concat(), &mut okm)
            .map_err(|_| crate::errors::VaultError::CryptoError("HKDF expansion failed".into()))?;
        Ok(okm)
    }

    /// Encrypts sync payload with XChaCha20-Poly1305 using the ephemeral session key.
    ///
    /// `direction` separates the two directions of the transfer so that a
    /// message cannot be reflected back at its sender.
    pub fn encrypt_payload_with_direction(
        &self,
        plaintext: &[u8],
        direction: u8,
    ) -> Result<Vec<u8>, crate::errors::VaultError> {
        let cipher = XChaCha20Poly1305::new_from_slice(&self.payload_key(direction)?)
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

    /// Decrypts sync payload with XChaCha20-Poly1305 using the ephemeral session key.
    pub fn decrypt_payload_with_direction(
        &self,
        packet: &[u8],
        direction: u8,
    ) -> Result<Vec<u8>, crate::errors::VaultError> {
        if packet.len() < 24 + 16 {
            return Err(crate::errors::VaultError::Corrupted(
                "P2P packet too short".into(),
            ));
        }

        let nonce = XNonce::from_slice(&packet[0..24]);
        let ciphertext = &packet[24..];

        let cipher = XChaCha20Poly1305::new_from_slice(&self.payload_key(direction)?)
            .map_err(|e| crate::errors::VaultError::CryptoError(e.to_string()))?;

        cipher.decrypt(nonce, ciphertext).map_err(|_| {
            crate::errors::VaultError::Authentication(
                "P2P decryption failed: session key or packet tampered".into(),
            )
        })
    }

    /// Encrypts sync payload with XChaCha20-Poly1305 using the ephemeral session key.
    pub fn encrypt_payload(&self, plaintext: &[u8]) -> Result<Vec<u8>, crate::errors::VaultError> {
        self.encrypt_payload_with_direction(plaintext, 0x01)
    }

    /// Decrypts sync payload with XChaCha20-Poly1305 using the ephemeral session key.
    pub fn decrypt_payload(&self, packet: &[u8]) -> Result<Vec<u8>, crate::errors::VaultError> {
        self.decrypt_payload_with_direction(packet, 0x01)
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
        let chunks: Vec<&[u8]> = data.chunks(chunk_size.max(1)).collect();
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
            return Err(crate::errors::VaultError::Corrupted(
                "No chunks provided".into(),
            ));
        }

        let total = chunks[0].total_chunks as usize;
        let session = chunks[0].session_id;

        // Guard against a maliciously large `total_chunks` causing a huge
        // allocation before any payload has been validated.
        if total == 0 || total > 65_535 {
            return Err(crate::errors::VaultError::Corrupted(
                "Invalid chunk count in optical payload".into(),
            ));
        }

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
