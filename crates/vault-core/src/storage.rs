use crate::crypto::{
    decrypt_payload, derive_kek, encrypt_payload, generate_vault_key, unwrap_key, wrap_key,
    KdfParams, KEY_LEN, NONCE_LEN, SALT_LEN,
};
use crate::errors::{Result, VaultError};
use crate::memory::LockedBuffer;
use crate::models::Vault;
use rand::rngs::OsRng;
use rand::RngCore;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub const MAGIC_BYTES: &[u8; 4] = b"PMV1";

#[derive(Debug, Clone)]
pub struct VaultFileHeader {
    pub version: u16,
    pub kdf_params: KdfParams,
    pub salt: [u8; SALT_LEN],
    pub primary_wrapped_key: Vec<u8>,
    pub primary_nonce: [u8; NONCE_LEN],
    pub has_duress: bool,
    pub duress_salt: [u8; SALT_LEN],
    pub duress_wrapped_key: Vec<u8>,
    pub duress_nonce: [u8; NONCE_LEN],
    pub primary_body_len: u64,
    pub duress_body_len: u64,
}

impl VaultFileHeader {
    pub fn serialize(&self) -> Vec<u8> {
        let mut buf = Vec::with_capacity(256);
        buf.extend_from_slice(MAGIC_BYTES);
        buf.extend_from_slice(&self.version.to_le_bytes());
        buf.extend_from_slice(&self.kdf_params.memory_kib.to_le_bytes());
        buf.extend_from_slice(&self.kdf_params.iterations.to_le_bytes());
        buf.extend_from_slice(&self.kdf_params.lanes.to_le_bytes());
        buf.extend_from_slice(&self.salt);
        buf.extend_from_slice(&self.primary_nonce);
        buf.extend_from_slice(&(self.primary_wrapped_key.len() as u32).to_le_bytes());
        buf.extend_from_slice(&self.primary_wrapped_key);

        buf.push(if self.has_duress { 1 } else { 0 });
        if self.has_duress {
            buf.extend_from_slice(&self.duress_salt);
            buf.extend_from_slice(&self.duress_nonce);
            buf.extend_from_slice(&(self.duress_wrapped_key.len() as u32).to_le_bytes());
            buf.extend_from_slice(&self.duress_wrapped_key);
        }

        buf.extend_from_slice(&self.primary_body_len.to_le_bytes());
        buf.extend_from_slice(&self.duress_body_len.to_le_bytes());
        buf
    }

    pub fn deserialize(data: &[u8]) -> Result<(Self, usize)> {
        if data.len() < 4 + 2 + 12 + SALT_LEN + NONCE_LEN + 4 {
            return Err(VaultError::InvalidHeader);
        }

        if &data[0..4] != MAGIC_BYTES {
            return Err(VaultError::InvalidHeader);
        }

        let mut offset = 4;
        let version = u16::from_le_bytes(data[offset..offset + 2].try_into().unwrap());
        offset += 2;

        let memory_kib = u32::from_le_bytes(data[offset..offset + 4].try_into().unwrap());
        offset += 4;
        let iterations = u32::from_le_bytes(data[offset..offset + 4].try_into().unwrap());
        offset += 4;
        let lanes = u32::from_le_bytes(data[offset..offset + 4].try_into().unwrap());
        offset += 4;

        let kdf_params = KdfParams {
            memory_kib,
            iterations,
            lanes,
        };

        let mut salt = [0u8; SALT_LEN];
        salt.copy_from_slice(&data[offset..offset + SALT_LEN]);
        offset += SALT_LEN;

        let mut primary_nonce = [0u8; NONCE_LEN];
        primary_nonce.copy_from_slice(&data[offset..offset + NONCE_LEN]);
        offset += NONCE_LEN;

        let key_len = u32::from_le_bytes(data[offset..offset + 4].try_into().unwrap()) as usize;
        offset += 4;

        if offset + key_len > data.len() {
            return Err(VaultError::InvalidHeader);
        }
        let primary_wrapped_key = data[offset..offset + key_len].to_vec();
        offset += key_len;

        if offset >= data.len() {
            return Err(VaultError::InvalidHeader);
        }
        let has_duress = data[offset] == 1;
        offset += 1;

        let mut duress_salt = [0u8; SALT_LEN];
        let mut duress_nonce = [0u8; NONCE_LEN];
        let mut duress_wrapped_key = Vec::new();

        if has_duress {
            if offset + SALT_LEN + NONCE_LEN + 4 > data.len() {
                return Err(VaultError::InvalidHeader);
            }
            duress_salt.copy_from_slice(&data[offset..offset + SALT_LEN]);
            offset += SALT_LEN;

            duress_nonce.copy_from_slice(&data[offset..offset + NONCE_LEN]);
            offset += NONCE_LEN;

            let d_len = u32::from_le_bytes(data[offset..offset + 4].try_into().unwrap()) as usize;
            offset += 4;

            if offset + d_len > data.len() {
                return Err(VaultError::InvalidHeader);
            }
            duress_wrapped_key = data[offset..offset + d_len].to_vec();
            offset += d_len;
        }

        if offset + 16 > data.len() {
            return Err(VaultError::InvalidHeader);
        }
        let primary_body_len = u64::from_le_bytes(data[offset..offset + 8].try_into().unwrap());
        offset += 8;
        let duress_body_len = u64::from_le_bytes(data[offset..offset + 8].try_into().unwrap());
        offset += 8;

        Ok((
            Self {
                version,
                kdf_params,
                salt,
                primary_wrapped_key,
                primary_nonce,
                has_duress,
                duress_salt,
                duress_wrapped_key,
                duress_nonce,
                primary_body_len,
                duress_body_len,
            },
            offset,
        ))
    }
}

pub struct UnlockedVaultSession {
    pub vault: Vault,
    pub is_duress: bool,
    pub primary_key: LockedBuffer,
    pub duress_key: Option<LockedBuffer>,
    pub kdf_params: KdfParams,
    pub salt: [u8; SALT_LEN],
    pub duress_salt: [u8; SALT_LEN],
}

pub struct StorageEngine;

impl StorageEngine {
    /// Creates a brand new encrypted vault file on disk.
    pub fn create_vault(
        path: &Path,
        vault: &Vault,
        master_password: &str,
        keyfile_bytes: Option<&[u8]>,
        duress_password: Option<&str>,
        kdf_params: Option<KdfParams>,
    ) -> Result<()> {
        let params = kdf_params.unwrap_or_else(KdfParams::default);

        // Generate primary salt & Vault Key
        let mut salt = [0u8; SALT_LEN];
        OsRng.fill_bytes(&mut salt);
        let kek = derive_kek(master_password, &salt, keyfile_bytes, &params)?;

        let primary_vk = generate_vault_key();
        let primary_vk_bytes: [u8; KEY_LEN] = primary_vk.as_slice().try_into().map_err(|_| {
            VaultError::CryptoError("Invalid key length".into())
        })?;
        let (primary_wrapped_key, primary_nonce) = wrap_key(&primary_vk_bytes, &kek)?;

        // Setup duress slot if provided
        let has_duress = duress_password.is_some();
        let mut duress_salt = [0u8; SALT_LEN];
        let mut duress_nonce = [0u8; NONCE_LEN];
        let mut duress_wrapped_key = Vec::new();
        let mut duress_vk_opt = None;

        if let Some(d_pwd) = duress_password {
            OsRng.fill_bytes(&mut duress_salt);
            let d_kek = derive_kek(d_pwd, &duress_salt, None, &params)?;
            let d_vk = generate_vault_key();
            let d_vk_bytes: [u8; KEY_LEN] = d_vk.as_slice().try_into().map_err(|_| {
                VaultError::CryptoError("Invalid duress key length".into())
            })?;
            let (w_key, n_bytes) = wrap_key(&d_vk_bytes, &d_kek)?;
            duress_nonce = n_bytes;
            duress_wrapped_key = w_key;
            duress_vk_opt = Some(d_vk);
        }

        // Serialize vault payload using MessagePack
        let primary_payload = rmp_serde::to_vec_named(vault)
            .map_err(|e| VaultError::SerializationError(e.to_string()))?;

        // Prepare dummy/empty decoy vault if duress is active
        let duress_payload = if has_duress {
            let mut decoy = Vault::new("decoy-device".to_string());
            decoy.metadata.duress_enabled = true;
            rmp_serde::to_vec_named(&decoy)
                .map_err(|e| VaultError::SerializationError(e.to_string()))?
        } else {
            Vec::new()
        };

        // Temporary header to compute sizes
        let dummy_header = VaultFileHeader {
            version: 1,
            kdf_params: params,
            salt,
            primary_wrapped_key: primary_wrapped_key.clone(),
            primary_nonce,
            has_duress,
            duress_salt,
            duress_wrapped_key: duress_wrapped_key.clone(),
            duress_nonce,
            primary_body_len: 0,
            duress_body_len: 0,
        };

        // Encrypt bodies with AAD
        // Notice: body size is payload + 24-byte nonce + 16-byte Poly1305 MAC tag
        let primary_body_len = (primary_payload.len() + NONCE_LEN + 16) as u64;
        let duress_body_len = if has_duress {
            (duress_payload.len() + NONCE_LEN + 16) as u64
        } else {
            0
        };

        let final_header = VaultFileHeader {
            primary_body_len,
            duress_body_len,
            ..dummy_header
        };

        let header_bytes = final_header.serialize();

        // Encrypt primary body using final_header bytes as AAD
        let (encrypted_primary, primary_body_nonce) =
            encrypt_payload(&primary_payload, &primary_vk, &header_bytes)?;

        // Encrypt duress body if present
        let (encrypted_duress, duress_body_nonce) = if has_duress {
            let d_vk = duress_vk_opt.as_ref().unwrap();
            let (enc, n) = encrypt_payload(&duress_payload, d_vk, &header_bytes)?;
            (enc, n)
        } else {
            (Vec::new(), [0u8; NONCE_LEN])
        };

        // Assemble full file buffer
        let mut file_data = header_bytes;
        file_data.extend_from_slice(&primary_body_nonce);
        file_data.extend_from_slice(&encrypted_primary);

        if has_duress {
            file_data.extend_from_slice(&duress_body_nonce);
            file_data.extend_from_slice(&encrypted_duress);
        }

        Self::atomic_write(path, &file_data)?;
        Ok(())
    }

    /// Unlocks a vault file from disk, detecting if the provided password matches
    /// the real vault or the duress/decoy vault.
    pub fn unlock_vault(
        path: &Path,
        password: &str,
        keyfile_bytes: Option<&[u8]>,
    ) -> Result<UnlockedVaultSession> {
        let mut file = File::open(path)?;
        let mut data = Vec::new();
        file.read_to_end(&mut data)?;

        let (header, header_size) = VaultFileHeader::deserialize(&data)?;
        let header_bytes = &data[..header_size];

        // 1. Try unlocking primary vault
        let primary_kek_res = derive_kek(
            password,
            &header.salt,
            keyfile_bytes,
            &header.kdf_params,
        );

        if let Ok(primary_kek) = primary_kek_res {
            if let Ok(primary_vk) = unwrap_key(
                &header.primary_wrapped_key,
                &header.primary_nonce,
                &primary_kek,
            ) {
                // Decrypt primary body
                let body_start = header_size;
                let body_end = body_start + header.primary_body_len as usize;
                if data.len() < body_end || header.primary_body_len < NONCE_LEN as u64 {
                    return Err(VaultError::TamperedData);
                }

                let mut body_nonce = [0u8; NONCE_LEN];
                body_nonce.copy_from_slice(&data[body_start..body_start + NONCE_LEN]);
                let ciphertext = &data[body_start + NONCE_LEN..body_end];

                let decrypted = decrypt_payload(ciphertext, &body_nonce, &primary_vk, header_bytes)?;
                let vault: Vault = rmp_serde::from_slice(&decrypted)
                    .map_err(|e| VaultError::SerializationError(e.to_string()))?;

                return Ok(UnlockedVaultSession {
                    vault,
                    is_duress: false,
                    primary_key: primary_vk,
                    duress_key: None,
                    kdf_params: header.kdf_params,
                    salt: header.salt,
                    duress_salt: header.duress_salt,
                });
            }
        }

        // 2. Try unlocking duress vault if configured
        if header.has_duress {
            let duress_kek_res = derive_kek(
                password,
                &header.duress_salt,
                None, // duress does not use keyfile for seamless emergency entry
                &header.kdf_params,
            );

            if let Ok(duress_kek) = duress_kek_res {
                if let Ok(duress_vk) = unwrap_key(
                    &header.duress_wrapped_key,
                    &header.duress_nonce,
                    &duress_kek,
                ) {
                    let d_start = header_size + header.primary_body_len as usize;
                    let d_end = d_start + header.duress_body_len as usize;
                    if data.len() < d_end || header.duress_body_len < NONCE_LEN as u64 {
                        return Err(VaultError::TamperedData);
                    }

                    let mut d_nonce = [0u8; NONCE_LEN];
                    d_nonce.copy_from_slice(&data[d_start..d_start + NONCE_LEN]);
                    let d_ciphertext = &data[d_start + NONCE_LEN..d_end];

                    let decrypted = decrypt_payload(d_ciphertext, &d_nonce, &duress_vk, header_bytes)?;
                    let vault: Vault = rmp_serde::from_slice(&decrypted)
                        .map_err(|e| VaultError::SerializationError(e.to_string()))?;

                    return Ok(UnlockedVaultSession {
                        vault,
                        is_duress: true,
                        primary_key: LockedBuffer::new(vec![0u8; KEY_LEN]),
                        duress_key: Some(duress_vk),
                        kdf_params: header.kdf_params,
                        salt: header.salt,
                        duress_salt: header.duress_salt,
                    });
                }
            }
        }

        Err(VaultError::AuthenticationFailed)
    }

    /// Saves an updated vault session back to disk atomically, maintaining existing
    /// header attributes and updating backups.
    pub fn save_vault(path: &Path, session: &UnlockedVaultSession) -> Result<()> {
        let serialized_vault = rmp_serde::to_vec_named(&session.vault)
            .map_err(|e| VaultError::SerializationError(e.to_string()))?;

        // Read existing file header to preserve wrapped keys
        let mut file = File::open(path)?;
        let mut data = Vec::new();
        file.read_to_end(&mut data)?;

        let (mut header, header_size) = VaultFileHeader::deserialize(&data)?;

        let (enc_primary, p_nonce) = if !session.is_duress {
            // Re-encrypt primary
            let primary_body_len = (serialized_vault.len() + NONCE_LEN + 16) as u64;
            header.primary_body_len = primary_body_len;
            let header_bytes = header.serialize();
            let (enc, n) = encrypt_payload(&serialized_vault, &session.primary_key, &header_bytes)?;
            (enc, n)
        } else {
            // If currently in duress mode, preserve real primary vault without touching it
            let p_start = header_size;
            let p_end = p_start + header.primary_body_len as usize;
            let mut n = [0u8; NONCE_LEN];
            n.copy_from_slice(&data[p_start..p_start + NONCE_LEN]);
            let enc = data[p_start + NONCE_LEN..p_end].to_vec();
            (enc, n)
        };

        let (enc_duress, d_nonce) = if session.is_duress && session.duress_key.is_some() {
            let duress_body_len = (serialized_vault.len() + NONCE_LEN + 16) as u64;
            header.duress_body_len = duress_body_len;
            let header_bytes = header.serialize();
            let (enc, n) = encrypt_payload(
                &serialized_vault,
                session.duress_key.as_ref().unwrap(),
                &header_bytes,
            )?;
            (enc, n)
        } else if header.has_duress {
            // Preserve existing duress body
            let d_start = header_size + header.primary_body_len as usize;
            let d_end = d_start + header.duress_body_len as usize;
            if data.len() >= d_end {
                let mut n = [0u8; NONCE_LEN];
                n.copy_from_slice(&data[d_start..d_start + NONCE_LEN]);
                let enc = data[d_start + NONCE_LEN..d_end].to_vec();
                (enc, n)
            } else {
                (Vec::new(), [0u8; NONCE_LEN])
            }
        } else {
            (Vec::new(), [0u8; NONCE_LEN])
        };

        let header_bytes = header.serialize();
        let mut final_data = header_bytes;
        final_data.extend_from_slice(&p_nonce);
        final_data.extend_from_slice(&enc_primary);

        if header.has_duress {
            final_data.extend_from_slice(&d_nonce);
            final_data.extend_from_slice(&enc_duress);
        }

        // Rotate backups before writing
        Self::rotate_backups(path)?;
        Self::atomic_write(path, &final_data)?;

        Ok(())
    }

    /// Atomically writes data to a file by writing to a temporary file,
    /// flushing with sync_all(), and renaming over the destination.
    fn atomic_write(path: &Path, data: &[u8]) -> Result<()> {
        let parent = path.parent().unwrap_or_else(|| Path::new("."));
        let tmp_path = parent.join(format!(
            ".{}.tmp.{}",
            path.file_name().unwrap_or_default().to_string_lossy(),
            Uuid::new_v4()
        ));

        let mut tmp_file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&tmp_path)?;

        tmp_file.write_all(data)?;
        tmp_file.sync_all()?;
        drop(tmp_file);

        fs::rename(&tmp_path, path)?;
        Ok(())
    }

    /// Rotates the last 5 encrypted backups (.bak1 to .bak5).
    pub fn rotate_backups(path: &Path) -> Result<()> {
        if !path.exists() {
            return Ok(());
        }

        let base_str = path.to_string_lossy();
        for i in (1..5).rev() {
            let src = PathBuf::from(format!("{}.bak{}", base_str, i));
            let dst = PathBuf::from(format!("{}.bak{}", base_str, i + 1));
            if src.exists() {
                let _ = fs::rename(&src, &dst);
            }
        }

        let bak1 = PathBuf::from(format!("{}.bak1", base_str));
        let _ = fs::copy(path, &bak1);
        Ok(())
    }
}
