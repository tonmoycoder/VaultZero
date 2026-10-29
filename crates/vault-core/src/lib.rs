pub mod crdt;
pub mod crypto;
pub mod errors;
pub mod memory;
pub mod models;
pub mod storage;

pub use crdt::{merge_vault_states, HlcClock};
pub use crypto::{derive_kek, generate_vault_key, KdfParams};
pub use errors::{Result, VaultError};
pub use memory::LockedBuffer;
pub use models::{Category, Entry, EntrySummary, Folder, PasswordHistoryEntry, RecoveryCode, TotpConfig, Vault};
pub use storage::{StorageEngine, UnlockedVaultSession};

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::NamedTempFile;
    use uuid::Uuid;

    #[test]
    fn test_create_and_unlock_vault() {
        let file = NamedTempFile::new().unwrap();
        let path = file.path();

        let mut vault = Vault::new("device-win1".to_string());
        let entry = Entry {
            id: Uuid::new_v4(),
            title: "GitHub".to_string(),
            url: "https://github.com".to_string(),
            username: "octocat".to_string(),
            email: "octo@github.com".to_string(),
            password: "SuperSecretPassword123!".to_string(),
            notes: "Developer portal login".to_string(),
            folder_id: None,
            category: Category::Logins,
            tags: vec!["dev".to_string(), "vcs".to_string()],
            favorite: true,
            brand_color: Some("#181717".to_string()),
            brand_icon_slug: Some("github".to_string()),
            custom_icon_base64: None,
            totp_config: None,
            recovery_codes: vec![],
            last_autofill: None,
            created_at: 1000,
            updated_at: 1000,
            password_history: vec![],
            hlc_timestamp: 1000,
            device_id: "device-win1".to_string(),
            is_deleted: false,
        };
        vault.entries.push(entry);

        let kdf_params = KdfParams::fast_for_testing();
        let master_pwd = "MyMasterPassword#2026";

        // Create vault
        StorageEngine::create_vault(
            path,
            &vault,
            master_pwd,
            None,
            Some("DecoyPassword#123"),
            Some(kdf_params),
        )
        .expect("Vault creation should succeed");

        // Unlock with correct password
        let session = StorageEngine::unlock_vault(path, master_pwd, None)
            .expect("Unlocking with correct password should succeed");
        assert!(!session.is_duress);
        assert_eq!(session.vault.entries.len(), 1);
        assert_eq!(session.vault.entries[0].title, "GitHub");
        assert_eq!(session.vault.entries[0].password, "SuperSecretPassword123!");

        // Unlock with duress password
        let duress_session = StorageEngine::unlock_vault(path, "DecoyPassword#123", None)
            .expect("Unlocking with duress password should succeed");
        assert!(duress_session.is_duress);
        assert!(duress_session.vault.metadata.duress_enabled);
        assert_eq!(duress_session.vault.entries.len(), 0);

        // Reject wrong password
        let wrong_res = StorageEngine::unlock_vault(path, "WrongPasswordTotally", None);
        assert!(matches!(wrong_res, Err(VaultError::AuthenticationFailed)));
    }

    #[test]
    fn test_tamper_detection_on_header_and_body() {
        let file = NamedTempFile::new().unwrap();
        let path = file.path();

        let vault = Vault::new("device-win1".to_string());
        let kdf_params = KdfParams::fast_for_testing();
        let master_pwd = "TamperProofMaster#999";

        StorageEngine::create_vault(
            path,
            &vault,
            master_pwd,
            None,
            None,
            Some(kdf_params),
        )
        .unwrap();

        // Read raw data and tamper with a single bit in header
        let mut raw_data = fs::read(path).unwrap();
        let tamper_idx = 10; // inside header params/salt
        raw_data[tamper_idx] ^= 0x01; // flip 1 bit

        fs::write(path, &raw_data).unwrap();

        // Decryption must fail due to MAC / AAD failure
        let res = StorageEngine::unlock_vault(path, master_pwd, None);
        assert!(res.is_err());
    }

    #[test]
    fn test_crdt_deterministic_merge() {
        let mut local = Vault::new("pc".to_string());
        let mut remote = Vault::new("phone".to_string());

        let entry_id = Uuid::new_v4();

        // Local has old password at hlc 100
        let local_entry = Entry {
            id: entry_id,
            title: "Netflix".to_string(),
            url: "https://netflix.com".to_string(),
            username: "user@example.com".to_string(),
            email: "user@example.com".to_string(),
            password: "OldPassword1".to_string(),
            notes: "".to_string(),
            folder_id: None,
            category: Category::Logins,
            tags: vec![],
            favorite: false,
            brand_color: None,
            brand_icon_slug: None,
            custom_icon_base64: None,
            totp_config: None,
            recovery_codes: vec![],
            last_autofill: None,
            created_at: 100,
            updated_at: 100,
            password_history: vec![],
            hlc_timestamp: 100,
            device_id: "pc".to_string(),
            is_deleted: false,
        };
        local.entries.push(local_entry);

        // Remote has updated password at hlc 200
        let remote_entry = Entry {
            id: entry_id,
            title: "Netflix".to_string(),
            url: "https://netflix.com".to_string(),
            username: "user@example.com".to_string(),
            email: "user@example.com".to_string(),
            password: "NewUpdatedPassword2".to_string(),
            notes: "Updated on phone".to_string(),
            folder_id: None,
            category: Category::Logins,
            tags: vec![],
            favorite: true,
            brand_color: None,
            brand_icon_slug: None,
            custom_icon_base64: None,
            totp_config: None,
            recovery_codes: vec![],
            last_autofill: None,
            created_at: 100,
            updated_at: 200,
            password_history: vec![],
            hlc_timestamp: 200,
            device_id: "phone".to_string(),
            is_deleted: false,
        };
        remote.entries.push(remote_entry);

        // Merge local & remote
        let merged = merge_vault_states(&local, &remote);
        assert_eq!(merged.entries.len(), 1);
        let m_entry = &merged.entries[0];
        assert_eq!(m_entry.password, "NewUpdatedPassword2");
        assert_eq!(m_entry.notes, "Updated on phone");
        // Check that old password was pushed to password_history!
        assert_eq!(m_entry.password_history.len(), 1);
        assert_eq!(m_entry.password_history[0].password, "OldPassword1");
    }

    #[test]
    fn test_backup_rotation() {
        let file = NamedTempFile::new().unwrap();
        let path = file.path();

        let vault = Vault::new("device".to_string());
        let kdf = KdfParams::fast_for_testing();
        StorageEngine::create_vault(path, &vault, "pass", None, None, Some(kdf)).unwrap();

        let mut session = StorageEngine::unlock_vault(path, "pass", None).unwrap();
        session.vault.entries.push(Entry {
            id: Uuid::new_v4(),
            title: "Test".to_string(),
            url: "".to_string(),
            username: "".to_string(),
            email: "".to_string(),
            password: "".to_string(),
            notes: "".to_string(),
            folder_id: None,
            category: Category::Logins,
            tags: vec![],
            favorite: false,
            brand_color: None,
            brand_icon_slug: None,
            custom_icon_base64: None,
            totp_config: None,
            recovery_codes: vec![],
            last_autofill: None,
            created_at: 0,
            updated_at: 0,
            password_history: vec![],
            hlc_timestamp: 0,
            device_id: "".to_string(),
            is_deleted: false,
        });

        StorageEngine::save_vault(path, &session).unwrap();

        let bak1 = format!("{}.bak1", path.to_string_lossy());
        assert!(std::path::Path::new(&bak1).exists());
        let _ = fs::remove_file(bak1);
    }

    #[test]
    fn test_keyfile_mix_and_rejection() {
        let file = NamedTempFile::new().unwrap();
        let path = file.path();

        let vault = Vault::new("pc".to_string());
        let kdf = KdfParams::fast_for_testing();
        let master_pwd = "VaultMasterKeyfilePass#2026";
        let keyfile_data = b"ArbitraryRandomKeyfileBytes32874129";

        StorageEngine::create_vault(path, &vault, master_pwd, Some(keyfile_data), None, Some(kdf)).unwrap();

        // Unlock with correct keyfile
        let session = StorageEngine::unlock_vault(path, master_pwd, Some(keyfile_data)).unwrap();
        assert_eq!(session.vault.entries.len(), 0);

        // Unlock without keyfile must fail
        let res_no_kf = StorageEngine::unlock_vault(path, master_pwd, None);
        assert!(res_no_kf.is_err());

        // Unlock with wrong keyfile must fail
        let res_wrong_kf = StorageEngine::unlock_vault(path, master_pwd, Some(b"WrongKeyfileContent"));
        assert!(res_wrong_kf.is_err());
    }

    #[test]
    fn test_hlc_monotonicity() {
        let clock = HlcClock::new(42);
        let mut last = clock.now();
        for _ in 0..1000 {
            let next = clock.now();
            assert!(next >= last, "HLC clock must be strictly monotonic");
            last = next;
        }
    }
}
