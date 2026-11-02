use serde::{Deserialize, Serialize};
use thiserror::Error;

/// A stable, user-safe error code.
///
/// SECURITY (V-26): the Rust error variants used to be surfaced to the
/// frontend verbatim (`e.to_string()`), so the UI could display internal
/// detail such as *"File header is invalid or has wrong magic bytes
/// (expected PMV1)"* or *"RAM memory lock error: ..."*. That leaks the
/// file format, the platform, and the memory-protection technique to anyone
/// who can trigger an error and read the message.
///
/// The frontend now receives a **code** plus a **fixed, safe message**.
/// The detailed text stays in the Rust-side log.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VaultErrorCode {
    /// The master password or keyfile was wrong.
    AuthFailed,
    /// The vault file is missing.
    VaultMissing,
    /// The vault file exists but its header is not a VaultZero vault.
    InvalidFormat,
    /// The integrity check failed — the file was modified.
    Tampered,
    /// The file could not be read or written.
    IoFailed,
    /// A cryptographic operation failed.
    CryptoFailed,
    /// The vault is locked, or the session changed.
    Locked,
    /// Anything else.
    Unknown,
}

impl VaultErrorCode {
    /// The stable code string sent across the IPC boundary.
    pub fn as_str(&self) -> &'static str {
        match self {
            VaultErrorCode::AuthFailed => "AUTH_FAILED",
            VaultErrorCode::VaultMissing => "VAULT_MISSING",
            VaultErrorCode::InvalidFormat => "INVALID_FORMAT",
            VaultErrorCode::Tampered => "TAMPERED",
            VaultErrorCode::IoFailed => "IO_FAILED",
            VaultErrorCode::CryptoFailed => "CRYPTO_FAILED",
            VaultErrorCode::Locked => "LOCKED",
            VaultErrorCode::Unknown => "UNKNOWN",
        }
    }

    /// A fixed, user-safe message. It never contains internal detail.
    pub fn user_message(&self) -> &'static str {
        match self {
            VaultErrorCode::AuthFailed => {
                "Incorrect master password or keyfile. Nothing was changed."
            }
            VaultErrorCode::VaultMissing => {
                "No vault was found at this location. Create one to get started."
            }
            VaultErrorCode::InvalidFormat => {
                "This file is not a VaultZero vault, or it is corrupted."
            }
            VaultErrorCode::Tampered => {
                "The vault failed its integrity check and was not modified."
            }
            VaultErrorCode::IoFailed => "The vault file could not be read or written.",
            VaultErrorCode::CryptoFailed => {
                "A cryptographic operation failed. The vault was not modified."
            }
            VaultErrorCode::Locked => "The vault is locked. Unlock it and try again.",
            VaultErrorCode::Unknown => "Something went wrong. The vault was not modified.",
        }
    }
}

#[derive(Error, Debug)]
pub enum VaultError {
    #[error("Authentication failed: invalid master password or corrupted key")]
    AuthenticationFailed,

    #[error("File header is invalid or has wrong magic bytes (expected PMV1)")]
    InvalidHeader,

    #[error("Data tampering detected: cryptographic integrity check (MAC/AAD) failed")]
    TamperedData,

    #[error("Decryption failed")]
    DecryptionFailed,

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("I/O error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("RAM memory lock error: {0}")]
    MemoryLockError(String),

    #[error("Key derivation parameter error: {0}")]
    KdfError(String),

    #[error("Cryptographic error: {0}")]
    CryptoError(String),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Corrupted data: {0}")]
    Corrupted(String),

    #[error("Authentication error: {0}")]
    Authentication(String),
}

impl VaultError {
    /// Maps the error to a stable, user-safe code.
    ///
    /// SECURITY (V-26): this is the only thing that should cross the IPC
    /// boundary. The detailed [`std::fmt::Display`] text stays on the Rust
    /// side.
    pub fn code(&self) -> VaultErrorCode {
        match self {
            VaultError::AuthenticationFailed | VaultError::Authentication(_) => {
                VaultErrorCode::AuthFailed
            }
            VaultError::InvalidHeader => VaultErrorCode::InvalidFormat,
            VaultError::TamperedData | VaultError::Corrupted(_) => VaultErrorCode::Tampered,
            VaultError::DecryptionFailed | VaultError::CryptoError(_) => {
                VaultErrorCode::CryptoFailed
            }
            VaultError::IoError(_) | VaultError::Storage(_) => VaultErrorCode::IoFailed,
            VaultError::SerializationError(_) | VaultError::MemoryLockError(_)
            | VaultError::KdfError(_) => VaultErrorCode::Unknown,
        }
    }

    /// The stable, user-safe message for this error.
    pub fn user_message(&self) -> &'static str {
        self.code().user_message()
    }

    /// The stable, user-safe code string for this error.
    pub fn code_string(&self) -> &'static str {
        self.code().as_str()
    }
}

pub type Result<T> = std::result::Result<T, VaultError>;

