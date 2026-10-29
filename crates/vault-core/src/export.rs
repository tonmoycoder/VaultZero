use crate::models::{Category, Entry};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportPreview {
    pub total_parsed: usize,
    pub new_entries: Vec<Entry>,
    pub duplicate_count: usize,
    pub duplicate_titles: Vec<String>,
}

pub struct VaultExporter;

impl VaultExporter {
    /// Neutralizes CSV Formula Injection (DDE) by prepending a single quote
    /// if a field starts with =, +, -, @, \t, or \r.
    pub fn sanitize_csv_cell(value: &str) -> String {
        if value.is_empty() {
            return String::new();
        }

        let first = value.chars().next().unwrap();
        if matches!(first, '=' | '+' | '-' | '@' | '\t' | '\r') {
            format!("'{}", value)
        } else {
            value.to_string()
        }
    }

    /// Exports entries to sanitized CSV
    pub fn export_csv(entries: &[Entry]) -> String {
        let mut out = String::from("title,url,username,email,password,notes,category\n");
        for e in entries.iter().filter(|e| !e.is_deleted) {
            let row = format!(
                "\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{:?}\"\n",
                Self::sanitize_csv_cell(&e.title).replace('"', "\"\""),
                Self::sanitize_csv_cell(&e.url).replace('"', "\"\""),
                Self::sanitize_csv_cell(&e.username).replace('"', "\"\""),
                Self::sanitize_csv_cell(&e.email).replace('"', "\"\""),
                Self::sanitize_csv_cell(&e.password).replace('"', "\"\""),
                Self::sanitize_csv_cell(&e.notes).replace('"', "\"\""),
                e.category
            );
            out.push_str(&row);
        }
        out
    }

    /// Exports entries to formatted Markdown with masked password spoilers
    pub fn export_markdown(entries: &[Entry]) -> String {
        let mut out = String::from("# VaultZero Exported Credentials\n\n");
        out.push_str("> Warning: Sensitive credentials. Shred after physical storage.\n\n");

        for e in entries.iter().filter(|e| !e.is_deleted) {
            out.push_str(&format!("## {}\n", e.title));
            if !e.url.is_empty() {
                out.push_str(&format!("- **URL:** {}\n", e.url));
            }
            if !e.username.is_empty() {
                out.push_str(&format!("- **Username:** {}\n", e.username));
            }
            if !e.email.is_empty() {
                out.push_str(&format!("- **Email:** {}\n", e.email));
            }
            out.push_str(&format!("- **Password:** ||{}||\n", e.password));
            if !e.notes.is_empty() {
                out.push_str(&format!("- **Notes:** {}\n", e.notes));
            }
            out.push_str("\n---\n\n");
        }
        out
    }

    /// Exports entries to JSON
    pub fn export_json(entries: &[Entry]) -> Result<String, crate::errors::VaultError> {
        let active: Vec<&Entry> = entries.iter().filter(|e| !e.is_deleted).collect();
        serde_json::to_string_pretty(&active)
            .map_err(|e| crate::errors::VaultError::Storage(e.to_string()))
    }

    /// Parses CSV content (standard browser/1Password/Bitwarden format) with duplicate detection
    pub fn parse_csv_import(
        csv_content: &str,
        existing_entries: &[Entry],
    ) -> Result<ImportPreview, crate::errors::VaultError> {
        let existing_keys: HashSet<String> = existing_entries
            .iter()
            .filter(|e| !e.is_deleted)
            .map(|e| format!("{}:{}", e.title.to_lowercase(), e.username.to_lowercase()))
            .collect();

        let mut lines = csv_content.lines();
        let _header = lines.next(); // Skip header

        let mut new_entries = Vec::new();
        let mut duplicate_count = 0;
        let mut duplicate_titles = Vec::new();
        let now = chrono::Utc::now().timestamp() as u64;

        for line in lines {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            // Simple CSV split (respecting quotes)
            let fields = Self::split_csv_line(trimmed);
            if fields.is_empty() {
                continue;
            }

            let title = fields.first().cloned().unwrap_or_default();
            let url = fields.get(1).cloned().unwrap_or_default();
            let username = fields.get(2).cloned().unwrap_or_default();
            let email = fields.get(3).cloned().unwrap_or_default();
            let password = fields.get(4).cloned().unwrap_or_default();
            let notes = fields.get(5).cloned().unwrap_or_default();

            let key = format!("{}:{}", title.to_lowercase(), username.to_lowercase());
            if existing_keys.contains(&key) {
                duplicate_count += 1;
                duplicate_titles.push(title);
                continue;
            }

            let entry = Entry {
                id: Uuid::new_v4(),
                title,
                url,
                username,
                email,
                password,
                notes,
                folder_id: None,
                category: Category::Logins,
                tags: Vec::new(),
                favorite: false,
                brand_color: None,
                brand_icon_slug: None,
                custom_icon_base64: None,
                totp_config: None,
                recovery_codes: Vec::new(),
                last_autofill: None,
                created_at: now,
                updated_at: now,
                password_history: Vec::new(),
                hlc_timestamp: now * 1000,
                device_id: "import-csv".into(),
                is_deleted: false,
            };
            new_entries.push(entry);
        }

        let total = new_entries.len() + duplicate_count;
        Ok(ImportPreview {
            total_parsed: total,
            new_entries,
            duplicate_count,
            duplicate_titles,
        })
    }

    fn split_csv_line(line: &str) -> Vec<String> {
        let mut res = Vec::new();
        let mut in_quotes = false;
        let mut cur = String::new();

        let chars: Vec<char> = line.chars().collect();
        let mut i = 0;
        while i < chars.len() {
            let ch = chars[i];
            if ch == '"' {
                if in_quotes && i + 1 < chars.len() && chars[i + 1] == '"' {
                    cur.push('"');
                    i += 1;
                } else {
                    in_quotes = !in_quotes;
                }
            } else if ch == ',' && !in_quotes {
                res.push(cur.trim().to_string());
                cur.clear();
            } else {
                cur.push(ch);
            }
            i += 1;
        }
        res.push(cur.trim().to_string());
        res
    }
}

