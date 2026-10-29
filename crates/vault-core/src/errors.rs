use thiserror::Error;

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
}

pub type Result<T> = std::result::Result<T, VaultError>;
