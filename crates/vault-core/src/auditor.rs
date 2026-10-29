use crate::generator::calculate_entropy;
use crate::models::Entry;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

/// Built-in offline dictionary of top 50 universally breached/weak passwords
const COMMON_BREACHED_PASSWORDS: &[&str] = &[
    "123456", "password", "123456789", "12345678", "12345", "111111", "1234567",
    "sunshine", "qwerty", "iloveyou", "princess", "admin", "welcome", "666666",
    "football", "monkey", "charlie", "donald", "password1", "password123", "secret",
    "pass123", "letmein", "master", "dragon", "123123", "baseball", "superman",
    "trustno1", "shadow", "michael", "ashley", "bailey", "access", "hunter2",
    "qwerty123", "starwars", "orange", "yellow", "purple", "computer", "killer",
    "ginger", "pepper", "phantom", "bullet", "freedom", "cookie", "monster",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityAuditReport {
    pub total_entries: usize,
    pub compromised_count: usize,
    pub compromised_ids: Vec<Uuid>,
    pub reused_count: usize,
    pub reused_ids: Vec<Uuid>,
    pub weak_count: usize,
    pub weak_ids: Vec<Uuid>,
    pub overall_security_score: u32, // 0 to 100
}

pub struct SecurityAuditor;

impl SecurityAuditor {
    pub fn audit(entries: &[Entry]) -> SecurityAuditReport {
        let active_entries: Vec<&Entry> = entries.iter().filter(|e| !e.is_deleted).collect();
        let total_entries = active_entries.len();

        let mut compromised_ids = Vec::new();
        let mut weak_ids = Vec::new();

        // 1. Password frequency mapping for Reuse detection
        let mut password_counts: HashMap<String, Vec<Uuid>> = HashMap::new();

        for entry in &active_entries {
            if entry.password.is_empty() {
                weak_ids.push(entry.id);
                continue;
            }

            // Check if known compromised
            let lower_pwd = entry.password.to_lowercase();
            if COMMON_BREACHED_PASSWORDS.contains(&lower_pwd.as_str()) {
                compromised_ids.push(entry.id);
            }

            // Check if weak (length < 10 or entropy < 45 bits)
            let entropy = calculate_entropy(&entry.password);
            if entry.password.len() < 10 || entropy < 45.0 {
                if !weak_ids.contains(&entry.id) {
                    weak_ids.push(entry.id);
                }
            }

            // Add to reuse tracking
            password_counts
                .entry(entry.password.clone())
                .or_default()
                .push(entry.id);
        }

        // Collect reused IDs
        let mut reused_set = HashSet::new();
        for (_, ids) in password_counts {
            if ids.len() > 1 {
                for id in ids {
                    reused_set.insert(id);
                }
            }
        }
        let reused_ids: Vec<Uuid> = reused_set.into_iter().collect();

        let compromised_count = compromised_ids.len();
        let reused_count = reused_ids.len();
        let weak_count = weak_ids.len();

        // Calculate overall score (0 to 100)
        let mut score = 100i32;
        if total_entries > 0 {
            let comp_penalty = (compromised_count as f64 / total_entries as f64) * 50.0;
            let reuse_penalty = (reused_count as f64 / total_entries as f64) * 30.0;
            let weak_penalty = (weak_count as f64 / total_entries as f64) * 20.0;
            score -= (comp_penalty + reuse_penalty + weak_penalty) as i32;
        }
        let overall_security_score = score.clamp(0, 100) as u32;

        SecurityAuditReport {
            total_entries,
            compromised_count,
            compromised_ids,
            reused_count,
            reused_ids,
            weak_count,
            weak_ids,
            overall_security_score,
        }
    }
}
