use serde::{Deserialize, Serialize};
use uuid::Uuid;
use zeroize::{Zeroize, ZeroizeOnDrop};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Category {
    Logins,
    Bookmarks,
    Safenotes,
    Identities,
    Payments,
}

impl Default for Category {
    fn default() -> Self {
        Category::Logins
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecoveryCode {
    pub code: String,
    pub used: bool,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PasswordHistoryEntry {
    pub password: String,
    pub changed_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TotpConfig {
    pub secret: String,
    pub algorithm: String, // SHA1, SHA256, SHA512
    pub digits: u32,       // 6 or 8
    pub period: u64,       // typically 30s
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Entry {
    pub id: Uuid,
    pub title: String,
    pub url: String,
    pub username: String,
    pub email: String,
    pub password: String,
    pub notes: String,
    pub folder_id: Option<Uuid>,
    pub category: Category,
    pub tags: Vec<String>,
    pub favorite: bool,
    pub brand_color: Option<String>,
    pub brand_icon_slug: Option<String>,
    pub custom_icon_base64: Option<String>,
    pub totp_config: Option<TotpConfig>,
    pub recovery_codes: Vec<RecoveryCode>,
    pub last_autofill: Option<u64>,
    pub created_at: u64,
    pub updated_at: u64,
    pub password_history: Vec<PasswordHistoryEntry>,
    // CRDT fields for offline P2P sync
    pub hlc_timestamp: u64,
    pub device_id: String,
    pub is_deleted: bool,
}

impl Zeroize for Entry {
    fn zeroize(&mut self) {
        self.password.zeroize();
        self.notes.zeroize();
        for code in &mut self.recovery_codes {
            code.code.zeroize();
        }
        for hist in &mut self.password_history {
            hist.password.zeroize();
        }
        if let Some(ref mut totp) = self.totp_config {
            totp.secret.zeroize();
        }
    }
}

impl Drop for Entry {
    fn drop(&mut self) {
        self.zeroize();
    }
}

impl ZeroizeOnDrop for Entry {}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Folder {
    pub id: Uuid,
    pub name: String,
    pub hlc_timestamp: u64,
    pub device_id: String,
    pub is_deleted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VaultMetadata {
    pub vault_id: Uuid,
    pub created_at: u64,
    pub updated_at: u64,
    pub device_id: String,
    pub duress_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Vault {
    pub version: u32,
    pub metadata: VaultMetadata,
    pub entries: Vec<Entry>,
    pub folders: Vec<Folder>,
}

impl Vault {
    pub fn new(device_id: String) -> Self {
        let now = chrono::Utc::now().timestamp() as u64;
        Self {
            version: 1,
            metadata: VaultMetadata {
                vault_id: Uuid::new_v4(),
                created_at: now,
                updated_at: now,
                device_id,
                duress_enabled: false,
            },
            entries: Vec::new(),
            folders: Vec::new(),
        }
    }
}

/// Non-secret summary returned to the UI frontend. Plaintext passwords and
/// sensitive recovery codes are omitted by default for defense-in-depth.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntrySummary {
    pub id: Uuid,
    pub title: String,
    pub url: String,
    pub domain: String,
    pub username: String,
    pub email: String,
    pub folder_id: Option<Uuid>,
    pub category: Category,
    pub tags: Vec<String>,
    pub favorite: bool,
    pub brand_color: Option<String>,
    pub brand_icon_slug: Option<String>,
    pub custom_icon_base64: Option<String>,
    pub has_totp: bool,
    pub recovery_codes_count: usize,
    pub created_at: u64,
    pub updated_at: u64,
    pub is_deleted: bool,
    pub password_length: usize,
}

impl Entry {
    pub fn extract_domain(&self) -> String {
        if self.url.is_empty() {
            return String::new();
        }
        let url_str = if !self.url.contains("://") {
            format!("https://{}", self.url)
        } else {
            self.url.clone()
        };

        if let Ok(parsed) = url::Url::parse(&url_str) {
            if let Some(host) = parsed.host_str() {
                let host = host.trim_start_matches("www.");
                return host.to_lowercase();
            }
        }
        self.url.to_lowercase()
    }

    pub fn to_summary(&self) -> EntrySummary {
        let domain = self.extract_domain();
        EntrySummary {
            id: self.id,
            title: self.title.clone(),
            url: self.url.clone(),
            domain,
            username: self.username.clone(),
            email: self.email.clone(),
            folder_id: self.folder_id,
            category: self.category,
            tags: self.tags.clone(),
            favorite: self.favorite,
            brand_color: self.brand_color.clone(),
            brand_icon_slug: self.brand_icon_slug.clone(),
            custom_icon_base64: self.custom_icon_base64.clone(),
            has_totp: self.totp_config.is_some(),
            recovery_codes_count: self.recovery_codes.len(),
            created_at: self.created_at,
            updated_at: self.updated_at,
            is_deleted: self.is_deleted,
            password_length: self.password.len(),
        }
    }
}

