use crate::models::{Entry, Folder, Vault};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use uuid::Uuid;

/// Hybrid Logical Clock (HLC) providing monotonically increasing timestamps
/// across devices and preserving causal ordering.
///
/// # Bit layout (48-bit physical | 8-bit logical | 8-bit node id)
///
/// `| 48 bits physical ms | 8 bits logical counter | 8 bits node id |`
///
/// The physical field holds milliseconds since the Unix epoch. 48 bits of
/// milliseconds covers ~8,900 years, so the packed value never overflows a
/// `u64`.
///
/// SECURITY (V-10): the previous layout used `(ms << 24)`, which requires
/// 40 bits of milliseconds — but the value being shifted was already in
/// *milliseconds* (~1.78e12, needing 41 bits). `1.78e12 << 24 ≈ 3.0e19`
/// overflows `u64::MAX` (1.8e19). In debug builds that panics; in release
/// builds (`panic = "abort"`) it wraps silently, producing non-monotonic
/// timestamps that break CRDT last-write-wins merge ordering.
pub struct HlcClock {
    last_physical_ms: AtomicU64,
    logical_counter: AtomicU64,
    node_id: u8,
}

impl HlcClock {
    /// Mask for the physical millisecond field (48 bits).
    const PHYSICAL_MASK: u64 = (1u64 << 48) - 1;
    /// Mask for the logical counter field (8 bits).
    const LOGICAL_MASK: u64 = 0xFF;

    pub fn new(node_id: u8) -> Self {
        Self {
            last_physical_ms: AtomicU64::new(0),
            logical_counter: AtomicU64::new(0),
            node_id,
        }
    }

    pub fn now(&self) -> u64 {
        let physical = chrono::Utc::now().timestamp_millis().max(0) as u64;
        let last = self.last_physical_ms.load(Ordering::SeqCst);

        let (chosen_time, counter) = if physical > last {
            self.last_physical_ms.store(physical, Ordering::SeqCst);
            self.logical_counter.store(0, Ordering::SeqCst);
            (physical, 0u64)
        } else {
            let next_count = self.logical_counter.fetch_add(1, Ordering::SeqCst) + 1;
            (last, next_count)
        };

        // Combine: (physical_ms & 0xFFFFFFFFFFFF) << 16 | (counter & 0xFF) << 8 | node_id
        let packed_physical = chosen_time & Self::PHYSICAL_MASK;
        (packed_physical << 16) | ((counter & Self::LOGICAL_MASK) << 8) | (self.node_id as u64)
    }
}

/// Deterministically merges two Vault states (local and remote) without losing history.
/// Follows CRDT Last-Write-Wins (LWW) semantics per entry based on HLC timestamps.
/// When passwords are overwritten, old passwords are systematically preserved into `password_history`.
pub fn merge_vault_states(local: &Vault, remote: &Vault) -> Vault {
    let mut merged = local.clone();

    // 1. Merge Entries
    let mut local_map: HashMap<Uuid, Entry> = local
        .entries
        .iter()
        .cloned()
        .map(|e| (e.id, e))
        .collect();

    for remote_entry in &remote.entries {
        match local_map.get_mut(&remote_entry.id) {
            Some(local_entry) => {
                // If remote has a newer HLC timestamp
                if remote_entry.hlc_timestamp > local_entry.hlc_timestamp {
                    let mut winner = remote_entry.clone();

                    // If password changed, preserve previous password into password_history
                    if local_entry.password != winner.password && !local_entry.password.is_empty() {
                        let already_has = winner
                            .password_history
                            .iter()
                            .any(|h| h.password == local_entry.password);
                        if !already_has {
                            winner.password_history.push(crate::models::PasswordHistoryEntry {
                                password: local_entry.password.clone(),
                                changed_at: local_entry.updated_at,
                            });
                        }
                    }

                    // Also preserve any distinct history entries from local
                    for hist in &local_entry.password_history {
                        if !winner.password_history.iter().any(|h| h.password == hist.password) {
                            winner.password_history.push(hist.clone());
                        }
                    }

                    *local_entry = winner;
                } else {
                    // Local won or tied (tie-breaker deterministic by device_id)
                    // If local won, ensure remote's distinct historical passwords are kept
                    if local_entry.password != remote_entry.password && !remote_entry.password.is_empty() {
                        let already_has = local_entry
                            .password_history
                            .iter()
                            .any(|h| h.password == remote_entry.password);
                        if !already_has {
                            local_entry.password_history.push(crate::models::PasswordHistoryEntry {
                                password: remote_entry.password.clone(),
                                changed_at: remote_entry.updated_at,
                            });
                        }
                    }

                    for hist in &remote_entry.password_history {
                        if !local_entry.password_history.iter().any(|h| h.password == hist.password) {
                            local_entry.password_history.push(hist.clone());
                        }
                    }
                }
            }
            None => {
                // Entry only exists on remote
                local_map.insert(remote_entry.id, remote_entry.clone());
            }
        }
    }

    let mut merged_entries: Vec<Entry> = local_map.into_values().collect();
    // Sort deterministically by id
    merged_entries.sort_by_key(|e| e.id);
    merged.entries = merged_entries;

    // 2. Merge Folders
    let mut folder_map: HashMap<Uuid, Folder> = local
        .folders
        .iter()
        .cloned()
        .map(|f| (f.id, f))
        .collect();

    for remote_folder in &remote.folders {
        match folder_map.get_mut(&remote_folder.id) {
            Some(local_folder) => {
                if remote_folder.hlc_timestamp > local_folder.hlc_timestamp {
                    *local_folder = remote_folder.clone();
                }
            }
            None => {
                folder_map.insert(remote_folder.id, remote_folder.clone());
            }
        }
    }

    let mut merged_folders: Vec<Folder> = folder_map.into_values().collect();
    merged_folders.sort_by_key(|f| f.id);
    merged.folders = merged_folders;

    // 3. Update metadata timestamps
    merged.metadata.updated_at = std::cmp::max(local.metadata.updated_at, remote.metadata.updated_at);

    merged
}
