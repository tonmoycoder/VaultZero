pub mod audit_log;
pub mod auditor;
pub mod brands;
pub mod crdt;
pub mod crypto;
pub mod data;
pub mod errors;
pub mod export;
pub mod generator;
pub mod memory;
pub mod models;
pub mod ocr;
pub mod p2p;
pub mod search;
pub mod shredder;
pub mod storage;
pub mod totp;

pub use audit_log::{AuditEvent, AuditSeverity, SecurityAuditLog};
pub use auditor::{SecurityAuditReport, SecurityAuditor};
pub use brands::{BrandInfo, BrandRegistry};
pub use crdt::{merge_vault_states, HlcClock};
pub use crypto::{derive_kek, generate_vault_key, KdfParams};
pub use data::wordlist::{WORDLIST, WORDLIST_LEN};
pub use errors::{Result, VaultError};
pub use export::{ImportPreview, VaultExporter};
pub use generator::{
    calculate_entropy, generate_passphrase, generate_password, passphrase_entropy,
    PasswordGenOptions,
};
pub use memory::LockedBuffer;
pub use models::{
    Category, Entry, EntrySummary, Folder, PasswordHistoryEntry, RecoveryCode, TotpConfig, Vault,
};
pub use ocr::{AmbiguousCharacter, OcrParsedResult, OcrSmartParser};
pub use p2p::{OpticalQrChunk, P2PBeaconPacket, P2PSessionHandshake, P2PSessionKey};
pub use search::{DomainGroup, SearchEngine, SearchFilter};
pub use shredder::SecureShredder;
pub use storage::{StorageEngine, UnlockedVaultSession};
pub use totp::{decode_base32, generate_totp, parse_otpauth_uri};

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;
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
        // SECURITY (V-04): the decoy vault now contains plausible filler
        // entries instead of being empty (an empty vault is an obvious tell).
        assert!(
            !duress_session.vault.entries.is_empty(),
            "duress vault must contain decoy entries"
        );
        // The decoy must NOT contain the real vault's entries.
        assert!(duress_session
            .vault
            .entries
            .iter()
            .all(|e| e.title != "GitHub"));

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

        StorageEngine::create_vault(path, &vault, master_pwd, None, None, Some(kdf_params))
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

        StorageEngine::create_vault(
            path,
            &vault,
            master_pwd,
            Some(keyfile_data),
            None,
            Some(kdf),
        )
        .unwrap();

        let session = StorageEngine::unlock_vault(path, master_pwd, Some(keyfile_data)).unwrap();
        assert_eq!(session.vault.entries.len(), 0);

        let res_no_kf = StorageEngine::unlock_vault(path, master_pwd, None);
        assert!(res_no_kf.is_err());

        let res_wrong_kf =
            StorageEngine::unlock_vault(path, master_pwd, Some(b"WrongKeyfileContent"));
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
        let uri = "otpauth://totp/GitHub:octocat?secret=JBSWY3DPEHPK3PXP&issuer=GitHub\
                   &algorithm=SHA1&digits=6&period=30";
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
                category: if i % 2 == 0 {
                    Category::Logins
                } else {
                    Category::Payments
                },
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
    fn test_search_blob_precomputation_matches_field_search() {
        // PERFORMANCE: the precomputed search_blob must produce exactly the
        // same matches as the original per-field lowercase search.
        let entry = Entry {
            id: Uuid::new_v4(),
            title: "GitHub Enterprise".to_string(),
            url: "https://github.example.com/acme".to_string(),
            username: "OctoCat".to_string(),
            email: "octo@github.example.com".to_string(),
            password: "x".to_string(),
            notes: "".to_string(),
            folder_id: None,
            category: Category::Logins,
            tags: vec!["Dev".to_string(), "VCS".to_string()],
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
            device_id: "test".to_string(),
            is_deleted: false,
        };

        let summary = entry.to_summary();
        assert!(summary.search_blob.contains("github enterprise"));
        assert!(summary.search_blob.contains("octocat"));
        assert!(summary.search_blob.contains("vcs"));

        // Every query that used to match a field must still match.
        for query in [
            "github",
            "enterprise",
            "octocat",
            "acme",
            "dev",
            "vcs",
            "EXAMPLE",
        ] {
            let filter = SearchFilter {
                query: query.to_string(),
                ..Default::default()
            };
            let results = SearchEngine::search(std::slice::from_ref(&summary), &filter);
            assert!(
                !results.is_empty(),
                "query '{}' should match via the precomputed blob",
                query
            );
        }

        // A non-matching query must still not match.
        let filter = SearchFilter {
            query: "zzzznotpresent".to_string(),
            ..Default::default()
        };
        assert!(SearchEngine::search(&[summary], &filter).is_empty());
    }

    #[test]
    fn test_search_blob_is_rebuilt_for_legacy_summaries() {
        let mut summary = Entry {
            id: Uuid::new_v4(),
            title: "Legacy Entry".to_string(),
            url: "https://legacy.example.com".to_string(),
            username: "legacyuser".to_string(),
            email: "".to_string(),
            password: "x".to_string(),
            notes: "".to_string(),
            folder_id: None,
            category: Category::Logins,
            tags: vec!["old".to_string()],
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
            device_id: "test".to_string(),
            is_deleted: false,
        }
        .to_summary();

        // Simulate a vault written before the blob existed.
        summary.search_blob = String::new();
        summary.ensure_search_blob();
        assert!(summary.search_blob.contains("legacy entry"));

        let filter = SearchFilter {
            query: "legacy".to_string(),
            ..Default::default()
        };
        assert_eq!(SearchEngine::search(&[summary], &filter).len(), 1);
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

        let brand2 =
            BrandRegistry::match_brand("Vacation Home Rental", "https://www.airbnb.com/rooms/123");
        assert!(brand2.is_some());
        assert_eq!(brand2.unwrap().slug, "airbnb");
    }

    #[test]
    fn test_p2p_pairing_mutual_auth_and_mitm_rejection() {
        use crate::p2p::P2PRole;

        let pin = "849201";

        // Desktop (host) and Phone (client) ephemeral handshakes
        let desktop_hs = P2PSessionHandshake::new();
        let phone_hs = P2PSessionHandshake::new();

        let desktop_pub = desktop_hs.public_key;
        let phone_pub = phone_hs.public_key;

        // Complete handshake with matching PIN and correct roles
        let desktop_session = desktop_hs
            .complete_handshake(&phone_pub, pin, P2PRole::Host, P2PRole::Client)
            .unwrap();
        let phone_session = phone_hs
            .complete_handshake(&desktop_pub, pin, P2PRole::Client, P2PRole::Host)
            .unwrap();

        // Mutual auth tag check
        assert!(desktop_session.verify_auth_tag(&phone_session.auth_tag));
        assert!(phone_session.verify_auth_tag(&desktop_session.auth_tag));

        // Channel binding hash must match on both sides (V-02: this is the
        // check that actually rejects a man-in-the-middle).
        assert!(desktop_session.verify_transcript(&phone_session.binding));
        assert!(phone_session.verify_transcript(&desktop_session.binding));

        // Encrypt on Desktop -> Decrypt on Phone
        let payload = b"CRDT_VAULT_DELTA_ENCRYPTED_PAYLOAD_TEST";
        let encrypted = desktop_session.encrypt_payload(payload).unwrap();
        let decrypted = phone_session.decrypt_payload(&encrypted).unwrap();
        assert_eq!(&decrypted, payload);

        // MITM Test: attacker relays with its own ephemeral key.
        let attacker_hs = P2PSessionHandshake::new();
        let attacker_session = attacker_hs
            .complete_handshake(&desktop_pub, pin, P2PRole::Client, P2PRole::Host)
            .unwrap();

        // The attacker's binding hash must NOT match the host's.
        assert!(!attacker_session.verify_transcript(&desktop_session.binding));
        // The attacker's auth tag must NOT match either.
        assert!(!attacker_session.verify_auth_tag(&desktop_session.auth_tag));
        // And it must not be able to decrypt the host's payload.
        assert!(attacker_session.decrypt_payload(&encrypted).is_err());
    }

    #[test]
    fn test_p2p_wrong_pin_cannot_decrypt_payload() {
        use crate::p2p::P2PRole;

        let desktop_hs = P2PSessionHandshake::new();
        let phone_hs = P2PSessionHandshake::new();
        let desktop_pub = desktop_hs.public_key;
        let phone_pub = phone_hs.public_key;

        let desktop_session = desktop_hs
            .complete_handshake(&phone_pub, "849201", P2PRole::Host, P2PRole::Client)
            .unwrap();
        // Attacker guesses the wrong PIN.
        let attacker_session = phone_hs
            .complete_handshake(&desktop_pub, "000000", P2PRole::Client, P2PRole::Host)
            .unwrap();

        assert!(!attacker_session.verify_transcript(&desktop_session.binding));

        let encrypted = desktop_session.encrypt_payload(b"top secret").unwrap();
        assert!(attacker_session.decrypt_payload(&encrypted).is_err());
    }

    #[test]
    fn test_p2p_direction_separation_prevents_reflection() {
        use crate::p2p::P2PRole;

        let a_hs = P2PSessionHandshake::new();
        let b_hs = P2PSessionHandshake::new();
        let a_pub = a_hs.public_key;
        let b_pub = b_hs.public_key;

        let a_session = a_hs
            .complete_handshake(&b_pub, "424242", P2PRole::Host, P2PRole::Client)
            .unwrap();
        let b_session = b_hs
            .complete_handshake(&a_pub, "424242", P2PRole::Client, P2PRole::Host)
            .unwrap();

        // Host->Client direction must not decrypt as Client->Host.
        let msg = a_session
            .encrypt_payload_with_direction(b"payload", 0x01)
            .unwrap();
        assert!(b_session.decrypt_payload_with_direction(&msg, 0x01).is_ok());
        assert!(b_session
            .decrypt_payload_with_direction(&msg, 0x02)
            .is_err());
    }

    #[test]
    fn test_optical_qr_chunking_and_reassembly() {
        let original_data = vec![42u8; 850];
        let chunks = OpticalQrChunk::split_payload(1337, &original_data, 200);
        assert_eq!(chunks.len(), 5);

        // Reverse chunks order to test out-of-order reassembly
        let mut reversed = chunks;
        reversed.reverse();

        let reassembled = OpticalQrChunk::reassemble(&reversed).unwrap();
        assert_eq!(reassembled, original_data);
    }

    #[test]
    fn test_ocr_smart_regex_parsing() {
        let raw = r#"
            Login to GitHub
            URL: https://github.com/login
            Username: octocat_admin
            Email: octo@github.com
            Password: P0ssw1rd!
            otpauth://totp/GitHub:octo?secret=JBSWY3DPEHPK3PXP&issuer=GitHub
            Recovery: 1A2B-3C4D-5E6F
        "#;

        let parsed = OcrSmartParser::parse(raw);
        assert_eq!(parsed.url.unwrap(), "https://github.com/login");
        assert_eq!(parsed.username.unwrap(), "octocat_admin");
        assert_eq!(parsed.email.unwrap(), "octo@github.com");
        assert_eq!(parsed.password.unwrap(), "P0ssw1rd!");
        assert_eq!(parsed.totp_secret.unwrap(), "JBSWY3DPEHPK3PXP");
        assert_eq!(parsed.recovery_codes.len(), 1);
        assert_eq!(parsed.recovery_codes[0], "1A2B-3C4D-5E6F");

        // Verify ambiguous characters in "P0ssw1rd!" ('0' and '1')
        assert_eq!(parsed.ambiguous_characters.len(), 2);
        let corrected = OcrSmartParser::replace_character("P0ssw1rd!", 1, 'o');
        assert_eq!(corrected, "Possw1rd!");
    }

    #[test]
    fn test_csv_injection_neutralization() {
        let malicious_inputs = vec![
            ("=cmd|' /C calc'!A0", "'=cmd|' /C calc'!A0"),
            ("+12345", "'+12345"),
            ("-999", "'-999"),
            ("@SUM(A1:A10)", "'@SUM(A1:A10)"),
            ("normal_title", "normal_title"),
        ];

        for (input, expected) in malicious_inputs {
            assert_eq!(VaultExporter::sanitize_csv_cell(input), expected);
        }
    }

    #[test]
    fn test_hlc_packs_without_overflow_and_stays_monotonic() {
        // SECURITY (V-10): the old layout used `(ms << 24)` which overflowed
        // u64 for real millisecond timestamps. Verify the packed value stays
        // inside u64 and that ordering is preserved.
        let clock = HlcClock::new(7);
        let mut previous = 0u64;
        for _ in 0..2000 {
            let now = clock.now();
            assert!(now > previous, "HLC must be strictly increasing");
            previous = now;
        }

        // The packed value must be representable in u64 (no silent wrap).
        let physical_ms = chrono::Utc::now().timestamp_millis().max(0) as u64;
        let packed = clock.now();
        let unpacked_physical = packed >> 16;
        assert!(
            unpacked_physical <= physical_ms + 1000,
            "unpacked physical component should track wall-clock ms"
        );
    }

    #[test]
    fn test_entropy_does_not_overstate_repetitive_passwords() {
        // SECURITY (V-09): the old estimator reported 56.9 bits for
        // "aaaaaaaaaaaa" because it assumed the full 26-char pool per
        // position. The corrected estimator must be far more conservative.
        let repetitive = calculate_entropy("aaaaaaaaaaaa");
        assert!(
            repetitive < 20.0,
            "repetitive password entropy overstated: {} bits",
            repetitive
        );

        // A genuinely random-looking password must still score well.
        let strong = calculate_entropy("x7#Qm2!pL9@vR4$kN8^");
        assert!(
            strong > 80.0,
            "strong password entropy too low: {} bits",
            strong
        );

        // A dictionary password must be capped near dictionary-weak levels.
        let dict = calculate_entropy("password123");
        assert!(
            dict < 45.0,
            "dictionary password should not pass the weak-password threshold: {} bits",
            dict
        );
    }

    #[test]
    fn test_password_generator_has_no_modulo_bias() {
        // SECURITY (V-08): sample the generator and check that no character
        // in the charset is meaningfully over-represented.
        let opts = PasswordGenOptions {
            length: 64,
            include_uppercase: true,
            include_lowercase: true,
            include_numbers: true,
            include_symbols: true,
            exclude_ambiguous: true,
        };

        let mut counts = std::collections::HashMap::new();
        let samples = 400;
        for _ in 0..samples {
            for c in generate_password(&opts).chars() {
                *counts.entry(c).or_insert(0u32) += 1;
            }
        }

        let charset_len = 24 + 25 + 8 + 24; // upper + lower + digits + symbols
        let total: u32 = counts.values().sum();
        let expected = total as f64 / charset_len as f64;

        // No character should appear more than 2x the expected frequency
        // (a modulo-bias implementation produces a ~1.35x spike).
        for (ch, count) in &counts {
            let observed = *count as f64;
            assert!(
                observed <= expected * 2.0,
                "character '{}' is over-represented: {} vs expected {}",
                ch,
                observed,
                expected
            );
        }
    }

    #[test]
    fn test_duress_decoy_is_not_empty() {
        // SECURITY (V-04): an empty decoy vault is an obvious tell.
        let decoy = crate::models::decoy_entries();
        assert!(
            !decoy.is_empty(),
            "duress decoy must contain filler entries"
        );
        assert!(decoy.len() >= 5);
        for e in &decoy {
            assert!(!e.title.is_empty());
            assert!(!e.password.is_empty());
        }
    }

    #[test]
    fn test_duress_vault_contains_decoy_entries_after_unlock() {
        let file = NamedTempFile::new().unwrap();
        let path = file.path();

        let vault = Vault::new("device-win1".to_string());
        let kdf = KdfParams::fast_for_testing();

        StorageEngine::create_vault(
            path,
            &vault,
            "PrimaryPass#2026",
            None,
            Some("DecoyPass#2026"),
            Some(kdf),
        )
        .unwrap();

        let duress = StorageEngine::unlock_vault(path, "DecoyPass#2026", None).unwrap();
        assert!(duress.is_duress);
        assert!(
            !duress.vault.entries.is_empty(),
            "duress vault must not be empty (it would be an obvious tell)"
        );
    }

    #[test]
    fn test_dod_3pass_file_shredder() {
        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file
            .write_all(b"SUPER_SECRET_PLAINTEXT_KEYS_TO_DESTROY")
            .unwrap();
        let path = temp_file.path().to_path_buf();
        assert!(path.exists());

        SecureShredder::shred_file(&path).unwrap();
        assert!(!path.exists());
    }
}
