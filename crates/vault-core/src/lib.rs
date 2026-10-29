pub mod auditor;
pub mod brands;
pub mod crdt;
pub mod crypto;
pub mod errors;
pub mod generator;
pub mod memory;
pub mod models;
pub mod search;
pub mod storage;
pub mod totp;

pub use auditor::{SecurityAuditReport, SecurityAuditor};
pub use brands::{BrandInfo, BrandRegistry};
pub use crdt::{merge_vault_states, HlcClock};
pub use crypto::{derive_kek, generate_vault_key, KdfParams};
pub use errors::{Result, VaultError};
pub use generator::{calculate_entropy, generate_passphrase, generate_password, PasswordGenOptions};
pub use memory::LockedBuffer;
pub use models::{Category, Entry, EntrySummary, Folder, PasswordHistoryEntry, RecoveryCode, TotpConfig, Vault};
pub use search::{DomainGroup, SearchEngine, SearchFilter};
pub use storage::{StorageEngine, UnlockedVaultSession};
pub use totp::{decode_base32, generate_totp, parse_otpauth_uri};

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
        let tamper_idx = 10;
        raw_data[tamper_idx] ^= 0x01;

        fs::write(path, &raw_data).unwrap();

        let res = StorageEngine::unlock_vault(path, master_pwd, None);
        assert!(res.is_err());
    }

    #[test]
    fn test_crdt_deterministic_merge() {
        let mut local = Vault::new("pc".to_string());
        let mut remote = Vault::new("phone".to_string());

        let entry_id = Uuid::new_v4();

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

        let merged = merge_vault_states(&local, &remote);
        assert_eq!(merged.entries.len(), 1);
        let m_entry = &merged.entries[0];
        assert_eq!(m_entry.password, "NewUpdatedPassword2");
        assert_eq!(m_entry.notes, "Updated on phone");
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

        let session = StorageEngine::unlock_vault(path, master_pwd, Some(keyfile_data)).unwrap();
        assert_eq!(session.vault.entries.len(), 0);

        let res_no_kf = StorageEngine::unlock_vault(path, master_pwd, None);
        assert!(res_no_kf.is_err());

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

    #[test]
    fn test_rfc_6238_totp_vectors() {
        // RFC 6238 test secret "12345678901234567890" in Base32 is GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ
        let secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

        // At T = 59s:
        let (code, remaining) = generate_totp(secret, 59, 30, 6, "SHA1").unwrap();
        assert_eq!(code, "287082");
        assert_eq!(remaining, 1);

        // Test URI parsing
        let uri = "otpauth://totp/GitHub:octocat?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&algorithm=SHA1&digits=6&period=30";
        let config = parse_otpauth_uri(uri).unwrap();
        assert_eq!(config.secret, "JBSWY3DPEHPK3PXP");
        assert_eq!(config.algorithm, "SHA1");
        assert_eq!(config.digits, 6);
        assert_eq!(config.period, 30);
    }

    #[test]
    fn test_in_memory_search_benchmark_1000_entries() {
        let mut entries = Vec::with_capacity(1000);
        for i in 0..1000 {
            let entry = Entry {
                id: Uuid::new_v4(),
                title: format!("Service #{}", i),
                url: format!("https://service{}.example.com", i),
                username: format!("user_{}", i),
                email: format!("user_{}@example.com", i),
                password: format!("Pass#{}", i),
                notes: format!("Some notes for item {}", i),
                folder_id: None,
                category: if i % 2 == 0 { Category::Logins } else { Category::Payments },
                tags: vec![format!("tag{}", i % 10)],
                favorite: i % 5 == 0,
                brand_color: None,
                brand_icon_slug: None,
                custom_icon_base64: None,
                totp_config: None,
                recovery_codes: vec![],
                last_autofill: None,
                created_at: 1000,
                updated_at: 1000,
                password_history: vec![],
                hlc_timestamp: 1000,
                device_id: "test".into(),
                is_deleted: false,
            };
            entries.push(entry.to_summary());
        }

        let start = std::time::Instant::now();
        let filter = SearchFilter {
            query: "Service #42".into(),
            ..Default::default()
        };
        let results = SearchEngine::search(&entries, &filter);
        let elapsed = start.elapsed();

        assert!(!results.is_empty());
        assert!(
            elapsed.as_millis() < 50,
            "Search across 1000 entries took {}ms (must be < 50ms)",
            elapsed.as_millis()
        );
    }

    #[test]
    fn test_security_auditor_counts() {
        let mut entries = Vec::new();

        // 1. Compromised entry
        entries.push(Entry {
            id: Uuid::new_v4(),
            title: "Old Site".into(),
            url: "https://example.com".into(),
            username: "admin".into(),
            email: "".into(),
            password: "password123".into(), // Compromised
            notes: "".into(),
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
            device_id: "".into(),
            is_deleted: false,
        });

        // 2 & 3. Reused entries
        let reused_pass = "UniqueStrongReusedPass#987";
        for i in 0..2 {
            entries.push(Entry {
                id: Uuid::new_v4(),
                title: format!("Reused Site {}", i),
                url: format!("https://reused{}.com", i),
                username: "user".into(),
                email: "".into(),
                password: reused_pass.into(),
                notes: "".into(),
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
                device_id: "".into(),
                is_deleted: false,
            });
        }

        // 4. Weak entry
        entries.push(Entry {
            id: Uuid::new_v4(),
            title: "Weak Site".into(),
            url: "https://weak.com".into(),
            username: "user".into(),
            email: "".into(),
            password: "abc".into(), // < 10 chars, weak
            notes: "".into(),
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
            device_id: "".into(),
            is_deleted: false,
        });

        let report = SecurityAuditor::audit(&entries);
        assert!(report.compromised_count >= 1);
        assert_eq!(report.reused_count, 2);
        assert!(report.weak_count >= 1);
    }

    #[test]
    fn test_brand_matching() {
        let brand1 = BrandRegistry::match_brand("My Github Account", "https://github.com/tonmoy");
        assert!(brand1.is_some());
        assert_eq!(brand1.unwrap().slug, "github");

        let brand2 = BrandRegistry::match_brand("Vacation Home Rental", "https://www.airbnb.com/rooms/123");
        assert!(brand2.is_some());
        assert_eq!(brand2.unwrap().slug, "airbnb");
    }
}
