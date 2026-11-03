use std::path::PathBuf;
use std::sync::Mutex;
use uuid::Uuid;
use vault_core::audit_log::{AuditSeverity, SecurityAuditLog};
use vault_core::auditor::{SecurityAuditReport, SecurityAuditor};
use vault_core::brands::{BrandInfo, BrandRegistry};
use vault_core::export::{ImportPreview, VaultExporter};
use vault_core::generator::{generate_passphrase, generate_password, PasswordGenOptions};
use vault_core::models::{Entry, EntrySummary, RecoveryCode};
use vault_core::ocr::{OcrParsedResult, OcrSmartParser};
use vault_core::p2p::{OpticalQrChunk, P2PBeaconPacket};
use vault_core::search::{DomainGroup, SearchEngine, SearchFilter};
use vault_core::storage::{StorageEngine, UnlockedVaultSession};
use vault_core::totp::generate_totp;
use vault_core::HlcClock;

pub mod p2p_lan;

pub struct AppState {
    pub session: Mutex<Option<UnlockedVaultSession>>,
    pub vault_path: Mutex<Option<PathBuf>>,
    pub hlc: HlcClock,
    pub p2p: tokio::sync::Mutex<p2p_lan::P2PManager>,
    /// SECURITY (V-07): in-memory audit trail of secret-revealing operations.
    /// Kept in memory only so it never lands on disk beside the vault.
    pub audit: SecurityAuditLog,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            session: Mutex::new(None),
            vault_path: Mutex::new(None),
            hlc: HlcClock::new(1),
            p2p: tokio::sync::Mutex::new(p2p_lan::P2PManager::new()),
            audit: SecurityAuditLog::default(),
        }
    }
}

#[derive(serde::Serialize)]
pub struct VaultStatus {
    pub is_unlocked: bool,
    pub is_duress: bool,
    pub entry_count: usize,
    pub vault_path: Option<String>,
}

#[derive(serde::Serialize)]
pub struct EntrySecretPayload {
    pub password: String,
    pub notes: String,
    pub recovery_codes: Vec<RecoveryCode>,
}

#[derive(serde::Serialize)]
pub struct TotpResponse {
    pub code: String,
    pub remaining_seconds: u64,
}

pub mod commands {
    use super::*;
    use tauri::{Manager, State};

    /// SECURITY (V-26): converts a core error into a **user-safe** message.
    ///
    /// The detailed error text (`e.to_string()`) used to be returned to the
    /// renderer verbatim, which leaked internal detail such as the file format,
    /// the expected magic bytes, and the platform's memory-protection mechanism
    /// to anyone who could trigger an error. The full text is still logged on
    /// the Rust side; only a fixed, safe message crosses the IPC boundary.
    fn safe_error(error: &vault_core::errors::VaultError) -> String {
        eprintln!("[vaultzero] storage error: {}", error);
        error.user_message().to_string()
    }

    #[tauri::command]
    pub fn is_vault_unlocked(state: State<AppState>) -> bool {
        state.session.lock().unwrap().is_some()
    }

    #[tauri::command]
    pub fn get_vault_status(state: State<AppState>) -> VaultStatus {
        let session_guard = state.session.lock().unwrap();
        let path_guard = state.vault_path.lock().unwrap();

        match &*session_guard {
            Some(s) => VaultStatus {
                is_unlocked: true,
                is_duress: s.is_duress,
                entry_count: s.vault.entries.iter().filter(|e| !e.is_deleted).count(),
                vault_path: path_guard.as_ref().map(|p| p.to_string_lossy().to_string()),
            },
            None => VaultStatus {
                is_unlocked: false,
                is_duress: false,
                entry_count: 0,
                vault_path: path_guard.as_ref().map(|p| p.to_string_lossy().to_string()),
            },
        }
    }

    /// Returns the canonical, absolute path of the vault file.
    ///
    /// SECURITY (V-33): the frontend used to pass the **relative** path
    /// `"local-vault.pmv"` to `create_vault` / `unlock_vault`. A relative path
    /// resolves against the current working directory, which differs between
    /// an Explorer launch, a shortcut, a Task Scheduler job and a service.
    /// The vault could therefore be written somewhere unexpected and
    /// possibly world-readable, and a second launch from a different working
    /// directory would not find it at all.
    ///
    /// The path is now resolved once, in the Rust core, into the platform's
    /// application-data directory and created with restrictive permissions.
    #[tauri::command]
    pub fn vault_file_path(app: tauri::AppHandle) -> Result<String, String> {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Could not resolve the application data directory: {}", e))?;

        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Could not create the application data directory: {}", e))?;

        // Restrict the directory to the current user where the platform
        // supports it (no-op on Windows, where the ACL is inherited).
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(metadata) = std::fs::metadata(&dir) {
                let mut permissions = metadata.permissions();
                permissions.set_mode(0o700);
                let _ = std::fs::set_permissions(&dir, permissions);
            }
        }

        Ok(dir.join("local-vault.pmv").to_string_lossy().to_string())
    }

    /// Writes an already-verified update artifact to disk and returns its
    /// absolute path.
    ///
    /// SECURITY (V-32): the updater used to download the artifact, hash
    /// it, and then hand the *original URL* to the browser — which
    /// downloaded the same file a second time. The file the user ended up
    /// running was therefore not the file that had been hashed: a
    /// compromised release asset could be swapped between the two
    /// requests, and the checksum guarantee did not hold for the bytes
    /// that were actually installed.
    ///
    /// The bytes that were hashed are now written here, so the artifact
    /// the user opens is byte-for-byte the artifact that was verified.
    ///
    /// The file is written to a temporary name first and then renamed, so
    /// a crash mid-write cannot leave a half-written installer behind
    /// under the final name. The name is derived from the caller-supplied
    /// file name, but only the base name is used — a path separator in
    /// the input cannot escape the download directory.
    #[tauri::command]
    pub fn save_update_artifact(
        app: tauri::AppHandle,
        file_name: String,
        bytes_base64: String,
    ) -> Result<String, String> {
        // Only the base name is honoured. Anything that looks like a path
        // is rejected outright rather than silently sanitised, so the
        // caller cannot write outside the download directory.
        if file_name.is_empty()
            || file_name.contains('/')
            || file_name.contains('\\')
            || file_name.contains("..")
            || file_name.contains('\0')
        {
            return Err("The update artifact name is not acceptable.".into());
        }

        // A release asset is a few tens of megabytes. The ceiling keeps a
        // malformed request from allocating an unbounded buffer.
        const MAX_ARTIFACT_BYTES: usize = 256 * 1024 * 1024;

        let encoded_len = bytes_base64.len();
        if encoded_len == 0 || encoded_len > MAX_ARTIFACT_BYTES / 3 * 4 + 4 {
            return Err("The update artifact is not within the accepted size range.".into());
        }

        let raw = decode_base64(&bytes_base64)
            .ok_or_else(|| "The update artifact could not be decoded.".to_string())?;

        if raw.is_empty() || raw.len() > MAX_ARTIFACT_BYTES {
            return Err("The update artifact is not within the accepted size range.".into());
        }

        let dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Could not resolve the application data directory: {}", e))?;

        let downloads = dir.join("updates");
        std::fs::create_dir_all(&downloads)
            .map_err(|e| format!("Could not create the update directory: {}", e))?;

        // The directory holds an installer, so it is restricted to the
        // current user on the platforms that support POSIX permissions.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(metadata) = std::fs::metadata(&downloads) {
                let mut permissions = metadata.permissions();
                permissions.set_mode(0o700);
                let _ = std::fs::set_permissions(&downloads, permissions);
            }
        }

        let target = downloads.join(&file_name);
        let temporary = downloads.join(format!(".{}.partial", file_name));

        // Write to the temporary name first, then rename it into place.
        // A crash between the two leaves a `.partial` file rather than a
        // truncated installer that looks complete.
        std::fs::write(&temporary, &raw)
            .map_err(|e| format!("The update artifact could not be written: {}", e))?;
        std::fs::rename(&temporary, &target).map_err(|e| {
            let _ = std::fs::remove_file(&temporary);
            format!("The update artifact could not be moved into place: {}", e)
        })?;

        // The file is opened here rather than by the frontend. The
        // frontend cannot launch a local file, and handing it the path
        // and letting it shell out would mean trusting a path that
        // crossed the IPC boundary. The path was built in this
        // function, so opening it here is both simpler and safer.
        /*
         * V-63 — download -> install -> restart, with no data loss.
         *
         * On Windows the verified installer is launched on a background
         * thread with `start /wait`. When it exits, `AppHandle::restart()`
         * starts the freshly installed build. The vault lives in the app
         * data directory (never inside the install directory), so the
         * installer cannot overwrite it; `restorePreUpdateBackupIfNeeded()`
         * on the frontend is the second layer of protection.
         *
         * On other platforms the file is handed to the OS synchronously;
         * Android keeps it on disk because an APK cannot be installed from
         * a plain file path.
         */
        #[cfg(target_os = "windows")]
        {
            let handle = app.clone();
            let installer = target.clone();
            std::thread::spawn(move || {
                let _ = open_artifact(&installer);
                handle.restart();
            });
        }

        #[cfg(not(target_os = "windows"))]
        open_artifact(&target)?;

        Ok(target.to_string_lossy().to_string())
    }

    /// Decodes standard base64 into bytes.
    ///
    /// The decoder is written out here rather than pulled in as a crate
    /// so the update path does not grow a dependency for one function.
    /// It follows RFC 4648: the alphabet is the standard one, padding is
    /// required, whitespace is rejected, and the padding has to be
    /// consistent with the length.
    fn decode_base64(input: &str) -> Option<Vec<u8>> {
        fn value(byte: u8) -> Option<u8> {
            match byte {
                b'A'..=b'Z' => Some(byte - b'A'),
                b'a'..=b'z' => Some(byte - b'a' + 26),
                b'0'..=b'9' => Some(byte - b'0' + 52),
                b'+' => Some(62),
                b'/' => Some(63),
                _ => None,
            }
        }

        let bytes = input.as_bytes();

        // The encoded length has to be a multiple of four, and the input
        // may carry at most two padding characters.
        if bytes.is_empty() || !bytes.len().is_multiple_of(4) {
            return None;
        }

        let padding = bytes.iter().rev().take_while(|b| **b == b'=').count();
        if padding > 2 {
            return None;
        }

        let data = &bytes[..bytes.len() - padding];

        let mut out = Vec::with_capacity(bytes.len() / 4 * 3);
        let mut accumulator: u32 = 0;
        let mut bits: u32 = 0;

        for byte in data {
            let six = value(*byte)?;
            accumulator = (accumulator << 6) | six as u32;
            bits += 6;
            if bits >= 8 {
                bits -= 8;
                out.push(((accumulator >> bits) & 0xff) as u8);
            }
        }

        // The bits that are left over must be zero, otherwise the input
        // carries data that the encoding cannot represent.
        if bits > 0 && (accumulator & ((1 << bits) - 1)) != 0 {
            return None;
        }

        // One leftover character is not a valid encoding.
        if data.len() % 4 == 1 {
            return None;
        }

        Some(out)
    }

    /// Hands a file to the operating system's default handler.
    ///
    /// The path is always one this process has just written, so it never
    /// carries an argument that could be interpreted as an option by the
    /// launcher. The launcher is still invoked without a shell, so the
    /// file name cannot be expanded into a command.
    #[cfg(target_os = "android")]
    fn open_artifact(_path: &std::path::Path) -> Result<(), String> {
        // Android has no `xdg-open` and an APK cannot be silently installed
        // from a plain path. The verified APK stays in the app data dir and
        // the frontend surfaces its path to the user.
        Ok(())
    }

    #[cfg(not(target_os = "android"))]
    fn open_artifact(path: &std::path::Path) -> Result<(), String> {
        use std::process::Command;

        #[cfg(target_os = "windows")]
        let mut command = {
            let mut c = Command::new("cmd");
            // `/c` with `start` is the documented way to open a file with
            // the default handler on Windows. The empty string is the
            // window title, which `start` would otherwise take from the
            // first argument.
            // `/wait` blocks until the NSIS installer exits. It runs on a
            // background thread (see `save_update_artifact`), so the UI is
            // never frozen and the app restarts only after its files have
            // actually been replaced.
            c.arg("/c").arg("start").arg("/wait").arg("").arg(path);
            c
        };

        #[cfg(target_os = "macos")]
        let mut command = {
            let mut c = Command::new("open");
            c.arg(path);
            c
        };

        #[cfg(all(unix, not(target_os = "macos")))]
        let mut command = {
            let mut c = Command::new("xdg-open");
            c.arg(path);
            c
        };

        #[cfg(not(any(target_os = "windows", target_os = "macos", unix)))]
        {
            let _ = path;
            return Err("Opening the update artifact is not supported on this platform.".into());
        }

        // The launcher must not inherit the terminal. On Windows it uses
        // `start /wait`, so the caller can restart VaultZero only AFTER the
        // installer has finished replacing its files.
        command
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null());

        #[cfg(target_os = "windows")]
        let result = command
            .status()
            .map(|_| ())
            .map_err(|e| format!("The update artifact could not be opened: {}", e));

        #[cfg(not(target_os = "windows"))]
        let result = command
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("The update artifact could not be opened: {}", e));

        result
    }

    #[tauri::command]
    pub fn lock_vault(state: State<AppState>) -> Result<(), String> {
        let mut session_guard = state.session.lock().unwrap();
        *session_guard = None;
        // SECURITY (V-07): the audit trail is cleared on lock so it cannot be
        // harvested after the session ends.
        state.audit.clear();
        Ok(())
    }

    #[tauri::command]
    pub fn create_vault(
        path: String,
        master_password: String,
        keyfile_content: Option<String>,
        duress_password: Option<String>,
        state: State<AppState>,
    ) -> Result<(), String> {
        let p = PathBuf::from(&path);
        let vault = vault_core::models::Vault::new("desktop-device".into());

        let kf_bytes = keyfile_content.as_ref().map(|s| s.as_bytes());
        let d_pwd = duress_password.as_deref().filter(|s| !s.is_empty());

        StorageEngine::create_vault(&p, &vault, &master_password, kf_bytes, d_pwd, None)
            .map_err(|e| safe_error(&e))?;

        let session = StorageEngine::unlock_vault(&p, &master_password, kf_bytes)
            .map_err(|e| safe_error(&e))?;

        *state.session.lock().unwrap() = Some(session);
        *state.vault_path.lock().unwrap() = Some(p);

        Ok(())
    }

    #[tauri::command]
    pub fn unlock_vault(
        path: String,
        master_password: String,
        keyfile_content: Option<String>,
        state: State<AppState>,
    ) -> Result<VaultStatus, String> {
        let p = PathBuf::from(&path);
        let kf_bytes = keyfile_content.as_ref().map(|s| s.as_bytes());

        let session = StorageEngine::unlock_vault(&p, &master_password, kf_bytes)
            .map_err(|e| e.to_string())?;

        let is_duress = session.is_duress;
        let entry_count = session
            .vault
            .entries
            .iter()
            .filter(|e| !e.is_deleted)
            .count();

        *state.session.lock().unwrap() = Some(session);
        *state.vault_path.lock().unwrap() = Some(p.clone());

        Ok(VaultStatus {
            is_unlocked: true,
            is_duress,
            entry_count,
            vault_path: Some(p.to_string_lossy().to_string()),
        })
    }

    #[tauri::command]
    pub fn list_entries(
        filter: Option<SearchFilter>,
        state: State<AppState>,
    ) -> Result<Vec<EntrySummary>, String> {
        let session_guard = state.session.lock().unwrap();
        let session = session_guard
            .as_ref()
            .ok_or_else(|| "Vault is locked".to_string())?;

        let summaries: Vec<EntrySummary> = session
            .vault
            .entries
            .iter()
            .map(|e| e.to_summary())
            .collect();

        match filter {
            Some(f) => Ok(SearchEngine::search(&summaries, &f)),
            None => Ok(summaries.into_iter().filter(|e| !e.is_deleted).collect()),
        }
    }

    #[tauri::command]
    pub fn get_domain_groups(state: State<AppState>) -> Result<Vec<DomainGroup>, String> {
        let session_guard = state.session.lock().unwrap();
        let session = session_guard
            .as_ref()
            .ok_or_else(|| "Vault is locked".to_string())?;

        let summaries: Vec<EntrySummary> = session
            .vault
            .entries
            .iter()
            .map(|e| e.to_summary())
            .collect();

        Ok(SearchEngine::group_by_domain(&summaries))
    }

    #[tauri::command]
    pub fn get_security_audit(state: State<AppState>) -> Result<SecurityAuditReport, String> {
        let session_guard = state.session.lock().unwrap();
        let session = session_guard
            .as_ref()
            .ok_or_else(|| "Vault is locked".to_string())?;

        Ok(SecurityAuditor::audit(&session.vault.entries))
    }

    #[tauri::command]
    pub fn get_brands() -> Vec<BrandInfo> {
        BrandRegistry::all_brands()
    }

    #[tauri::command]
    pub fn generate_password_cmd(
        length: usize,
        uppercase: bool,
        lowercase: bool,
        numbers: bool,
        symbols: bool,
        exclude_ambiguous: bool,
    ) -> String {
        let opts = PasswordGenOptions {
            length,
            include_uppercase: uppercase,
            include_lowercase: lowercase,
            include_numbers: numbers,
            include_symbols: symbols,
            exclude_ambiguous,
        };
        generate_password(&opts)
    }

    #[tauri::command]
    pub fn generate_passphrase_cmd(words: usize, separator: String, capitalize: bool) -> String {
        generate_passphrase(words, &separator, capitalize)
    }

    #[tauri::command]
    pub fn reveal_entry_secret(
        entry_id: String,
        state: State<AppState>,
    ) -> Result<EntrySecretPayload, String> {
        let uid = Uuid::parse_str(&entry_id).map_err(|e| e.to_string())?;
        let session_guard = state.session.lock().unwrap();
        let session = session_guard
            .as_ref()
            .ok_or_else(|| "Vault is locked".to_string())?;

        let entry = session
            .vault
            .entries
            .iter()
            .find(|e| e.id == uid && !e.is_deleted)
            .ok_or_else(|| "Entry not found".to_string())?;

        // SECURITY (V-07): record every secret reveal.
        state.audit.record_action(
            "reveal_entry_secret",
            AuditSeverity::Warning,
            Some(entry.title.clone()),
            Some("manual reveal".into()),
        );

        Ok(EntrySecretPayload {
            password: entry.password.clone(),
            notes: entry.notes.clone(),
            recovery_codes: entry.recovery_codes.clone(),
        })
    }

    /// Returns the in-memory security audit trail (V-07).
    #[tauri::command]
    pub fn get_audit_log(state: State<AppState>) -> Vec<String> {
        state.audit.snapshot().iter().map(|e| e.format()).collect()
    }

    #[tauri::command]
    pub fn get_totp_code(entry_id: String, state: State<AppState>) -> Result<TotpResponse, String> {
        let uid = Uuid::parse_str(&entry_id).map_err(|e| e.to_string())?;
        let session_guard = state.session.lock().unwrap();
        let session = session_guard
            .as_ref()
            .ok_or_else(|| "Vault is locked".to_string())?;

        let entry = session
            .vault
            .entries
            .iter()
            .find(|e| e.id == uid && !e.is_deleted)
            .ok_or_else(|| "Entry not found".to_string())?;

        let totp_cfg = entry
            .totp_config
            .as_ref()
            .ok_or_else(|| "Entry does not have 2FA/TOTP configured".to_string())?;

        let now_epoch = chrono::Utc::now().timestamp() as u64;
        let (code, remaining) = generate_totp(
            &totp_cfg.secret,
            now_epoch,
            totp_cfg.period,
            totp_cfg.digits,
            &totp_cfg.algorithm,
        )
        .map_err(|e| e.to_string())?;

        // SECURITY (V-07): generating a 2FA code is a secret-revealing action.
        state.audit.record_action(
            "get_totp_code",
            AuditSeverity::Info,
            Some(entry.title.clone()),
            None,
        );

        Ok(TotpResponse {
            code,
            remaining_seconds: remaining,
        })
    }

    #[tauri::command]
    pub fn upsert_entry(mut entry: Entry, state: State<AppState>) -> Result<EntrySummary, String> {
        let mut session_guard = state.session.lock().unwrap();
        let session = session_guard
            .as_mut()
            .ok_or_else(|| "Vault is locked".to_string())?;

        let now = chrono::Utc::now().timestamp() as u64;
        let hlc_ts = state.hlc.now();

        entry.hlc_timestamp = hlc_ts;
        entry.updated_at = now;

        if let Some(existing) = session.vault.entries.iter_mut().find(|e| e.id == entry.id) {
            if existing.password != entry.password && !existing.password.is_empty() {
                entry
                    .password_history
                    .push(vault_core::models::PasswordHistoryEntry {
                        password: existing.password.clone(),
                        changed_at: existing.updated_at,
                    });
            }
            *existing = entry.clone();
        } else {
            if entry.created_at == 0 {
                entry.created_at = now;
            }
            session.vault.entries.push(entry.clone());
        }

        if let Some(ref path) = *state.vault_path.lock().unwrap() {
            StorageEngine::save_vault(path, session).map_err(|e| safe_error(&e))?;
        }

        Ok(entry.to_summary())
    }

    #[tauri::command]
    pub fn delete_entry(entry_id: String, state: State<AppState>) -> Result<(), String> {
        let uid = Uuid::parse_str(&entry_id).map_err(|e| e.to_string())?;
        let mut session_guard = state.session.lock().unwrap();
        let session = session_guard
            .as_mut()
            .ok_or_else(|| "Vault is locked".to_string())?;

        let now = chrono::Utc::now().timestamp() as u64;
        let hlc_ts = state.hlc.now();

        if let Some(entry) = session.vault.entries.iter_mut().find(|e| e.id == uid) {
            entry.is_deleted = true;
            entry.updated_at = now;
            entry.hlc_timestamp = hlc_ts;
        }

        if let Some(ref path) = *state.vault_path.lock().unwrap() {
            StorageEngine::save_vault(path, session).map_err(|e| safe_error(&e))?;
        }

        Ok(())
    }

    #[tauri::command]
    pub fn classify_ocr_text(text: String) -> OcrParsedResult {
        OcrSmartParser::parse(&text)
    }

    #[tauri::command]
    pub fn export_vault_cmd(format: String, state: State<AppState>) -> Result<String, String> {
        let session_guard = state.session.lock().unwrap();
        let session = session_guard
            .as_ref()
            .ok_or_else(|| "Vault is locked".to_string())?;

        let active_count = session
            .vault
            .entries
            .iter()
            .filter(|e| !e.is_deleted)
            .count();

        // SECURITY (V-07): a bulk export releases *every* secret in the vault
        // in cleartext. It is recorded at CRITICAL severity.
        state.audit.record_action(
            "export_vault",
            AuditSeverity::Critical,
            Some(format.to_lowercase()),
            Some(format!("{} entries exported in cleartext", active_count)),
        );

        match format.to_lowercase().as_str() {
            "csv" => Ok(VaultExporter::export_csv(&session.vault.entries)),
            "markdown" | "md" => Ok(VaultExporter::export_markdown(&session.vault.entries)),
            "json" => VaultExporter::export_json(&session.vault.entries).map_err(|e| e.to_string()),
            _ => Err("Unsupported export format".to_string()),
        }
    }

    #[tauri::command]
    pub fn import_csv_cmd(
        csv_content: String,
        state: State<AppState>,
    ) -> Result<ImportPreview, String> {
        let mut session_guard = state.session.lock().unwrap();
        let session = session_guard
            .as_mut()
            .ok_or_else(|| "Vault is locked".to_string())?;

        let preview = VaultExporter::parse_csv_import(&csv_content, &session.vault.entries)
            .map_err(|e| e.to_string())?;

        for entry in &preview.new_entries {
            session.vault.entries.push(entry.clone());
        }

        if let Some(ref path) = *state.vault_path.lock().unwrap() {
            StorageEngine::save_vault(path, session).map_err(|e| safe_error(&e))?;
        }

        Ok(preview)
    }

    #[tauri::command]
    pub fn generate_p2p_beacon_cmd(device_name: String, port: u16) -> P2PBeaconPacket {
        P2PBeaconPacket::new("vaultzero-desktop".into(), device_name, port)
    }

    #[tauri::command]
    pub fn chunk_optical_payload_cmd(data: String, chunk_size: usize) -> Vec<OpticalQrChunk> {
        let session_id = chrono::Utc::now().timestamp_subsec_nanos() ^ 0x5A5A5A5A;
        OpticalQrChunk::split_payload(session_id, data.as_bytes(), chunk_size)
    }

    #[tauri::command]
    pub fn reassemble_optical_chunks_cmd(chunks: Vec<OpticalQrChunk>) -> Result<String, String> {
        let bytes = OpticalQrChunk::reassemble(&chunks).map_err(|e| e.to_string())?;
        String::from_utf8(bytes).map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn set_screen_protection(window: tauri::Window, enabled: bool) -> Result<(), String> {
        #[cfg(target_os = "windows")]
        {
            use windows_sys::Win32::UI::WindowsAndMessaging::{
                SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE, WDA_NONE,
            };
            if let Ok(hwnd) = window.hwnd() {
                let affinity = if enabled {
                    WDA_EXCLUDEFROMCAPTURE
                } else {
                    WDA_NONE
                };
                unsafe {
                    SetWindowDisplayAffinity(hwnd.0 as _, affinity);
                }
            }
        }
        let _ = (window, enabled);
        Ok(())
    }

    /// Starts the LAN P2P host and serves the vault to a paired peer.
    ///
    /// SECURITY (V-25): the command previously took an arbitrary
    /// `payload: String` from the renderer. The renderer therefore chose the
    /// exact bytes that were encrypted and shipped to any peer that knew the
    /// PIN — a confused-deputy, since a compromised renderer could serve
    /// arbitrary content under the user's identity. Worse, the frontend
    /// passed `payload: ""`, so the "Send vault" feature transferred nothing
    /// at all.
    ///
    /// The payload is now derived **inside the Rust core** from the unlocked
    /// session. The renderer never handles the snapshot bytes.
    #[tauri::command]
    pub async fn start_p2p_host(
        pin: String,
        device_name: Option<String>,
        state: State<'_, AppState>,
    ) -> Result<p2p_lan::P2PHostInfo, String> {
        // Serialise the vault from the session while it is still locked
        // behind the mutex, then drop the borrow before awaiting.
        let payload = {
            let session_guard = state.session.lock().unwrap();
            let session = session_guard
                .as_ref()
                .ok_or_else(|| "Vault is locked".to_string())?;
            serde_json::to_string(&session.vault)
                .map_err(|e| format!("Failed to serialise the vault for transfer: {}", e))?
        };

        let name = device_name.unwrap_or_else(|| "VaultZero-Peer".into());
        let mut mgr = state.p2p.lock().await;
        mgr.start_host(pin, payload, name).await
    }

    #[tauri::command]
    pub async fn discover_peers() -> Result<Vec<p2p_lan::DiscoveredPeer>, String> {
        p2p_lan::P2PManager::discover_peers().await
    }

    #[tauri::command]
    pub async fn sync_vault_payload(
        peer_ip: String,
        peer_port: u16,
        pin: String,
    ) -> Result<String, String> {
        p2p_lan::P2PManager::sync_from_peer(peer_ip, peer_port, pin).await
    }

    #[tauri::command]
    pub fn generate_totp_cmd(secret: String) -> Result<TotpResponse, String> {
        let clean: String = secret
            .chars()
            .filter(|c| !c.is_whitespace() && *c != '-')
            .collect();
        let clean = clean.to_ascii_uppercase();
        let re = regex::Regex::new(r"^[A-Z2-7]+=*$").map_err(|e| e.to_string())?;
        if !re.is_match(&clean) {
            return Err("Invalid Base32 secret key: only A-Z and 2-7 characters allowed".into());
        }
        if clean.trim_end_matches('=').len() < 16 {
            return Err("Secret key must be at least 16 characters for RFC 6238 compliance".into());
        }
        let now_epoch = chrono::Utc::now().timestamp() as u64;
        let (code, remaining) =
            generate_totp(&clean, now_epoch, 30, 6, "SHA1").map_err(|e| e.to_string())?;
        Ok(TotpResponse {
            code,
            remaining_seconds: remaining,
        })
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::is_vault_unlocked,
            commands::get_vault_status,
            commands::lock_vault,
            commands::vault_file_path,
            commands::save_update_artifact,
            commands::create_vault,
            commands::unlock_vault,
            commands::list_entries,
            commands::get_domain_groups,
            commands::get_security_audit,
            commands::get_brands,
            commands::generate_password_cmd,
            commands::generate_passphrase_cmd,
            commands::reveal_entry_secret,
            commands::get_audit_log,
            commands::get_totp_code,
            commands::upsert_entry,
            commands::delete_entry,
            commands::classify_ocr_text,
            commands::export_vault_cmd,
            commands::import_csv_cmd,
            commands::generate_p2p_beacon_cmd,
            commands::chunk_optical_payload_cmd,
            commands::reassemble_optical_chunks_cmd,
            commands::start_p2p_host,
            commands::discover_peers,
            commands::sync_vault_payload,
            commands::generate_totp_cmd,
            commands::set_screen_protection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
