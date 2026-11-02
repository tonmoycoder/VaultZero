use rand::rngs::OsRng;
use rand::RngCore;
use std::fs::OpenOptions;
use std::io::{Seek, SeekFrom, Write};
use std::path::Path;

pub struct SecureShredder;

impl SecureShredder {
    /// Overwrites the file using the DoD 5220.22-M 3-Pass specification:
    /// Pass 1: 0x00
    /// Pass 2: 0xFF
    /// Pass 3: Cryptographically secure random bytes
    /// Flushes disk writes with sync_all() and removes the file.
    pub fn shred_file<P: AsRef<Path>>(path: P) -> Result<(), crate::errors::VaultError> {
        let p = path.as_ref();
        if !p.exists() {
            return Ok(());
        }

        let metadata =
            std::fs::metadata(p).map_err(|e| crate::errors::VaultError::Storage(e.to_string()))?;
        let file_size = metadata.len();

        let mut file = OpenOptions::new()
            .read(true)
            .write(true)
            .open(p)
            .map_err(|e| crate::errors::VaultError::Storage(e.to_string()))?;

        let buffer_size = 64 * 1024; // 64 KB write buffer

        // Pass 1: 0x00
        Self::write_pattern(&mut file, file_size, 0x00, buffer_size)?;
        file.sync_all()
            .map_err(|e| crate::errors::VaultError::Storage(e.to_string()))?;

        // Pass 2: 0xFF
        Self::write_pattern(&mut file, file_size, 0xFF, buffer_size)?;
        file.sync_all()
            .map_err(|e| crate::errors::VaultError::Storage(e.to_string()))?;

        // Pass 3: CSPRNG random bytes
        Self::write_random(&mut file, file_size, buffer_size)?;
        file.sync_all()
            .map_err(|e| crate::errors::VaultError::Storage(e.to_string()))?;

        // Truncate to zero and unlink
        file.set_len(0)
            .map_err(|e| crate::errors::VaultError::Storage(e.to_string()))?;
        drop(file);

        std::fs::remove_file(p).map_err(|e| crate::errors::VaultError::Storage(e.to_string()))?;

        Ok(())
    }

    fn write_pattern(
        file: &mut std::fs::File,
        total_len: u64,
        byte_val: u8,
        buf_size: usize,
    ) -> Result<(), crate::errors::VaultError> {
        file.seek(SeekFrom::Start(0))
            .map_err(|e| crate::errors::VaultError::Storage(e.to_string()))?;

        let buffer = vec![byte_val; buf_size];
        let mut written = 0u64;

        while written < total_len {
            let to_write = std::cmp::min((total_len - written) as usize, buf_size);
            file.write_all(&buffer[..to_write])
                .map_err(|e| crate::errors::VaultError::Storage(e.to_string()))?;
            written += to_write as u64;
        }

        Ok(())
    }

    fn write_random(
        file: &mut std::fs::File,
        total_len: u64,
        buf_size: usize,
    ) -> Result<(), crate::errors::VaultError> {
        file.seek(SeekFrom::Start(0))
            .map_err(|e| crate::errors::VaultError::Storage(e.to_string()))?;

        let mut buffer = vec![0u8; buf_size];
        let mut written = 0u64;

        while written < total_len {
            let to_write = std::cmp::min((total_len - written) as usize, buf_size);
            OsRng.fill_bytes(&mut buffer[..to_write]);
            file.write_all(&buffer[..to_write])
                .map_err(|e| crate::errors::VaultError::Storage(e.to_string()))?;
            written += to_write as u64;
        }

        Ok(())
    }
}
