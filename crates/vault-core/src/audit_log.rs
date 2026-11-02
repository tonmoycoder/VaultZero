use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

/// Severity of an audited action.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AuditSeverity {
    /// Routine read of a single secret.
    Info,
    /// A secret was revealed / copied to the clipboard.
    Warning,
    /// A bulk export or a vault lifecycle event.
    Critical,
}

impl AuditSeverity {
    pub fn as_str(self) -> &'static str {
        match self {
            AuditSeverity::Info => "INFO",
            AuditSeverity::Warning => "WARN",
            AuditSeverity::Critical => "CRIT",
        }
    }
}

/// A single entry in the in-memory security audit trail.
///
/// SECURITY (V-07): secret-revealing operations were previously performed
/// with no record at all. A password manager should be able to answer "when
/// was this credential last read?" — that is a core expectation of a
/// zero-knowledge vault's *auditability* (distinct from its secrecy).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    /// Unix timestamp in milliseconds.
    pub timestamp_ms: u64,
    /// The action, e.g. `reveal_entry_secret`.
    pub action: String,
    /// The object the action targeted, e.g. an entry id.
    pub target: Option<String>,
    /// Severity of the event.
    pub severity: AuditSeverity,
    /// Free-form detail (never contains secret material).
    pub detail: Option<String>,
}

impl AuditEvent {
    pub fn new(
        action: impl Into<String>,
        severity: AuditSeverity,
        target: Option<String>,
        detail: Option<String>,
    ) -> Self {
        Self {
            timestamp_ms: now_ms(),
            action: action.into(),
            target,
            severity,
            detail,
        }
    }

    /// Human-readable single-line rendering.
    pub fn format(&self) -> String {
        let target = self
            .target
            .as_deref()
            .map(|t| format!(" target={}", t))
            .unwrap_or_default();
        let detail = self
            .detail
            .as_deref()
            .map(|d| format!(" ({})", d))
            .unwrap_or_default();
        format!(
            "[{}] {}{}{}",
            self.severity.as_str(),
            self.action,
            target,
            detail
        )
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Bounded, in-memory ring buffer of security-relevant events.
///
/// Deliberately **not** persisted: writing an audit log to disk next to the
/// vault would create a second, unencrypted file describing vault activity.
/// Keeping it in memory means it disappears when the app closes and cannot be
/// harvested by a later attacker.
pub struct SecurityAuditLog {
    events: Mutex<VecDeque<AuditEvent>>,
    capacity: usize,
}

impl Default for SecurityAuditLog {
    fn default() -> Self {
        Self {
            events: Mutex::new(VecDeque::new()),
            capacity: 512,
        }
    }
}

impl SecurityAuditLog {
    pub fn new(capacity: usize) -> Self {
        Self {
            events: Mutex::new(VecDeque::new()),
            capacity: capacity.max(1),
        }
    }

    /// Records an event, evicting the oldest when the buffer is full.
    pub fn record(&self, event: AuditEvent) {
        let mut guard = match self.events.lock() {
            Ok(g) => g,
            // A poisoned mutex must not take down the app; drop the event.
            Err(_) => return,
        };
        if guard.len() >= self.capacity {
            guard.pop_front();
        }
        guard.push_back(event);
    }

    pub fn record_action(
        &self,
        action: impl Into<String>,
        severity: AuditSeverity,
        target: Option<String>,
        detail: Option<String>,
    ) {
        self.record(AuditEvent::new(action, severity, target, detail));
    }

    /// Returns a snapshot of the recorded events, oldest first.
    pub fn snapshot(&self) -> Vec<AuditEvent> {
        match self.events.lock() {
            Ok(g) => g.iter().cloned().collect(),
            Err(_) => Vec::new(),
        }
    }

    /// Number of events currently retained.
    pub fn len(&self) -> usize {
        self.events.lock().map(|g| g.len()).unwrap_or(0)
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Clears the log (called when the vault locks).
    pub fn clear(&self) {
        if let Ok(mut g) = self.events.lock() {
            g.clear();
        }
    }

    /// Renders the log as human-readable lines.
    pub fn render(&self) -> String {
        self.snapshot()
            .iter()
            .map(|e| e.format())
            .collect::<Vec<_>>()
            .join("\n")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audit_log_ring_buffer_evicts_oldest() {
        let log = SecurityAuditLog::new(3);
        for i in 0..5 {
            log.record_action(
                format!("action_{}", i),
                AuditSeverity::Info,
                None,
                None,
            );
        }
        let snap = log.snapshot();
        assert_eq!(snap.len(), 3);
        assert_eq!(snap[0].action, "action_2");
        assert_eq!(snap[2].action, "action_4");
    }

    #[test]
    fn test_audit_log_format_includes_severity_and_target() {
        let ev = AuditEvent::new(
            "reveal_entry_secret",
            AuditSeverity::Warning,
            Some("entry-123".into()),
            Some("manual reveal".into()),
        );
        let line = ev.format();
        assert!(line.contains("WARN"));
        assert!(line.contains("reveal_entry_secret"));
        assert!(line.contains("entry-123"));
    }

    #[test]
    fn test_audit_log_clear_empties() {
        let log = SecurityAuditLog::default();
        log.record_action("x", AuditSeverity::Info, None, None);
        assert!(!log.is_empty());
        log.clear();
        assert!(log.is_empty());
    }
}
