use crate::models::{Category, EntrySummary};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainGroup {
    pub domain: String,
    pub display_name: String,
    pub account_count: usize,
    pub brand_color: Option<String>,
    pub brand_icon_slug: Option<String>,
    pub entries: Vec<EntrySummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SearchFilter {
    pub query: String,
    pub category: Option<Category>,
    pub favorite_only: bool,
    pub tag: Option<String>,
    pub folder_id: Option<uuid::Uuid>,
}

pub struct SearchEngine;

impl SearchEngine {
    /// Performs ultra-fast in-memory filtering across entry summaries (<50ms for 10,000+ entries).
    ///
    /// PERFORMANCE: the free-text match now runs against a **precomputed**
    /// lowercase `search_blob` on each summary instead of calling
    /// `to_lowercase()` on six separate fields for every entry on every
    /// keystroke. The blob is built once, when the summary is created.
    pub fn search(entries: &[EntrySummary], filter: &SearchFilter) -> Vec<EntrySummary> {
        let q = filter.query.trim().to_lowercase();
        let has_q = !q.is_empty();

        entries
            .iter()
            .filter(|e| !e.is_deleted)
            .filter(|e| {
                if filter.favorite_only && !e.favorite {
                    return false;
                }
                if let Some(cat) = filter.category {
                    if e.category != cat {
                        return false;
                    }
                }
                if let Some(fid) = filter.folder_id {
                    if e.folder_id != Some(fid) {
                        return false;
                    }
                }
                if let Some(ref tag) = filter.tag {
                    if !e.tags.iter().any(|t| t.eq_ignore_ascii_case(tag)) {
                        return false;
                    }
                }
                if has_q {
                    // Fast path: precomputed blob.
                    if !e.search_blob.is_empty() {
                        // V-45: a non-matching blob must reject the entry.
                        // The old code returned `true` on a match and then
                        // fell through to `true` for everything else, so
                        // every query matched every modern entry.
                        if !e.search_blob.contains(&q) {
                            return false;
                        }
                        // Fall through to the per-field checks only when the
                        // blob is empty (e.g. summaries deserialised from an
                        // older vault that predates the blob field).
                    } else {
                        let matches_title = e.title.to_lowercase().contains(&q);
                        let matches_url = e.url.to_lowercase().contains(&q);
                        let matches_domain = e.domain.to_lowercase().contains(&q);
                        let matches_user = e.username.to_lowercase().contains(&q);
                        let matches_email = e.email.to_lowercase().contains(&q);
                        let matches_tag = e.tags.iter().any(|t| t.to_lowercase().contains(&q));

                        if !(matches_title
                            || matches_url
                            || matches_domain
                            || matches_user
                            || matches_email
                            || matches_tag)
                        {
                            return false;
                        }
                    }
                }
                true
            })
            .cloned()
            .collect()
    }

    /// Groups entries by domain for Bento Grid and service overview
    /// (computing "2 accounts", "5 accounts", etc.).
    pub fn group_by_domain(entries: &[EntrySummary]) -> Vec<DomainGroup> {
        let mut map: HashMap<String, Vec<EntrySummary>> = HashMap::new();

        for e in entries {
            if e.is_deleted {
                continue;
            }
            let key = if !e.domain.is_empty() {
                e.domain.clone()
            } else if !e.title.is_empty() {
                e.title.to_lowercase()
            } else {
                "other".to_string()
            };

            map.entry(key).or_default().push(e.clone());
        }

        let mut groups = Vec::new();
        for (domain, mut group_entries) in map {
            group_entries.sort_by_key(|a| std::cmp::Reverse(a.updated_at));
            let brand_color = group_entries.iter().find_map(|e| e.brand_color.clone());
            let brand_icon_slug = group_entries.iter().find_map(|e| e.brand_icon_slug.clone());
            let display_name = group_entries[0].title.clone();

            groups.push(DomainGroup {
                domain,
                display_name,
                account_count: group_entries.len(),
                brand_color,
                brand_icon_slug,
                entries: group_entries,
            });
        }

        // Sort descending by account count, then alphabetically
        groups.sort_by(|a, b| {
            b.account_count
                .cmp(&a.account_count)
                .then_with(|| a.domain.cmp(&b.domain))
        });

        groups
    }
}
