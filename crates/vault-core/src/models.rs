use serde::{Deserialize, Serialize};
use uuid::Uuid;
use zeroize::{Zeroize, ZeroizeOnDrop};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum Category {
    #[default]
    Logins,
    Bookmarks,
    Safenotes,
    Identities,
    Payments,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecoveryCode {
    pub code: String,
    pub used: bool,
    pub note: Option<String>,
}

/// SECURITY (V-28): a recovery code is a one-time fallback that bypasses
/// 2FA. It is wiped when the struct is dropped, not only when it is
/// dropped as part of an `Entry`.
impl Zeroize for RecoveryCode {
    fn zeroize(&mut self) {
        self.code.zeroize();
        if let Some(ref mut note) = self.note {
            note.zeroize();
        }
    }
}

impl Drop for RecoveryCode {
    fn drop(&mut self) {
        self.zeroize();
    }
}

impl ZeroizeOnDrop for RecoveryCode {}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PasswordHistoryEntry {
    pub password: String,
    pub changed_at: u64,
}

/// SECURITY (V-28): a previous password is still a credential. It is wiped
/// on drop so it cannot outlive the entry it belongs to.
impl Zeroize for PasswordHistoryEntry {
    fn zeroize(&mut self) {
        self.password.zeroize();
    }
}

impl Drop for PasswordHistoryEntry {
    fn drop(&mut self) {
        self.zeroize();
    }
}

impl ZeroizeOnDrop for PasswordHistoryEntry {}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TotpConfig {
    pub secret: String,
    pub algorithm: String, // SHA1, SHA256, SHA512
    pub digits: u32,       // 6 or 8
    pub period: u64,       // typically 30s
}

/// SECURITY (V-28): the TOTP seed is the authenticator's master secret. It
/// never rotates, so leaking it is a permanent 2FA bypass. It is wiped when
/// the config is dropped.
impl Zeroize for TotpConfig {
    fn zeroize(&mut self) {
        self.secret.zeroize();
    }
}

impl Drop for TotpConfig {
    fn drop(&mut self) {
        self.zeroize();
    }
}

impl ZeroizeOnDrop for TotpConfig {}

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
    /// Precomputed, lowercased concatenation of every searchable field.
    ///
    /// PERFORMANCE: `SearchEngine::search` previously called `to_lowercase()`
    /// on six separate fields of every entry for **every keystroke**. At 10k
    /// entries that is ~60k string allocations per keypress. The blob is
    /// computed once when the summary is created and reused for all queries.
    ///
    /// It contains no secret material — titles, URLs, domains, usernames,
    /// emails and tags are all non-sensitive display fields.
    #[serde(default)]
    pub search_blob: String,
}

impl EntrySummary {
    /// Rebuilds the precomputed search blob for summaries that were
    /// deserialised from a vault written before the blob existed.
    pub fn ensure_search_blob(&mut self) {
        if self.search_blob.is_empty() {
            self.search_blob = Entry::build_search_blob(
                &self.title,
                &self.url,
                &self.domain,
                &self.username,
                &self.email,
                &self.tags,
            );
        }
    }
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

    /// Builds the precomputed lowercase search blob for this entry.
    pub fn build_search_blob(
        title: &str,
        url: &str,
        domain: &str,
        username: &str,
        email: &str,
        tags: &[String],
    ) -> String {
        let mut blob = String::with_capacity(
            title.len() + url.len() + domain.len() + username.len() + email.len() + 16,
        );
        blob.push_str(&title.to_lowercase());
        blob.push('\u{1}');
        blob.push_str(&url.to_lowercase());
        blob.push('\u{1}');
        blob.push_str(&domain.to_lowercase());
        blob.push('\u{1}');
        blob.push_str(&username.to_lowercase());
        blob.push('\u{1}');
        blob.push_str(&email.to_lowercase());
        blob.push('\u{1}');
        for tag in tags {
            blob.push_str(&tag.to_lowercase());
            blob.push('\u{1}');
        }
        blob
    }

    pub fn to_summary(&self) -> EntrySummary {
        let domain = self.extract_domain();
        let search_blob = Self::build_search_blob(
            &self.title,
            &self.url,
            &domain,
            &self.username,
            &self.email,
            &self.tags,
        );
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
            search_blob,
        }
    }
}


/// Current Unix timestamp in seconds.
pub fn now_seconds() -> u64 {
    chrono::Utc::now().timestamp().max(0) as u64
}

/// SECURITY (V-04): plausible, obviously-low-value filler accounts used to
/// populate the duress decoy vault.
///
/// A duress vault containing zero entries is an immediate tell: anyone
/// holding the device under coercion can see that the "vault" is empty and
/// conclude the user is being forced. These filler entries are deliberately
/// mundane (a saved news site, a forum, a food-delivery account) so the
/// decoy reads as a real but unremarkable vault.
pub fn decoy_entries() -> Vec<Entry> {
    let seeds: [(&str, &str, &str, &str, Category); 6] = [
        (
            "example-news",
            "https://news.example.com",
            "reader@example.com",
            "Reader#2024",
            Category::Bookmarks,
        ),
        (
            "example-forum",
            "https://forum.example.org",
            "guest_user",
            "Forums#8812",
            Category::Logins,
        ),
        (
            "Example Recipes",
            "https://recipes.example.net",
            "homecook@example.com",
            "Recipe#5521",
            Category::Logins,
        ),
        (
            "example-shop",
            "https://shop.example.com",
            "shopper@example.com",
            "Shopping#7723",
            Category::Payments,
        ),
        (
            "Example Travel",
            "https://travel.example.com",
            "traveller@example.com",
            "Travel#3390",
            Category::Logins,
        ),
        (
            "example-music",
            "https://music.example.net",
            "listener@example.com",
            "Music#4417",
            Category::Logins,
        ),
    ];

    seeds
        .iter()
        .map(|(title, url, username, password, category)| Entry {
            id: Uuid::new_v4(),
            title: title.to_string(),
            url: url.to_string(),
            username: username.to_string(),
            email: String::new(),
            password: password.to_string(),
            notes: String::new(),
            folder_id: None,
            category: *category,
            tags: Vec::new(),
            favorite: false,
            brand_color: None,
            brand_icon_slug: None,
            custom_icon_base64: None,
            totp_config: None,
            recovery_codes: Vec::new(),
            last_autofill: None,
            created_at: 0,
            updated_at: 0,
            password_history: Vec::new(),
            hlc_timestamp: 0,
            device_id: "decoy-device".to_string(),
            is_deleted: false,
        })
        .collect()
}
