import {
  ArrowClockwise,
  ArrowRight,
  CaretDown,
  CheckCircle,
  ClockCounterClockwise,
  Fingerprint,
  GlobeHemisphereWest,
  Info,
  LockSimple,
  ShieldCheck,
  ShieldWarning,
} from "@phosphor-icons/react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Strength, VaultItem } from "../lib/vault";
import { softSpring } from "../lib/motion";
import GlassSelection from "./GlassSelection";
import { BrandMark, Modal } from "./ui";
import { useMotionSettings } from "./Tactile";
import {
  addSecurityAuditEntry,
  getRangeRequestCount,
  getSecurityAuditLog,
  isBreachOnlineEnabled,
  setBreachOnlineEnabled,
  scanPasswordsBreach,
  type BreachCheckResult,
  type SecurityAuditEntry,
} from "../lib/breachScanner";

const metrics = [
  { id: "strong" as const, label: "Strong", color: "var(--success)" },
  { id: "fair" as const, label: "To review", color: "var(--warning)" },
  { id: "weak" as const, label: "Weak", color: "var(--danger)" },
];

export default function SecurityCenterModal({
  items,
  onClose,
  onNotify,
  onReview,
  onOpenAuthenticator,
}: {
  items: VaultItem[];
  onClose: () => void;
  onNotify: (message: string) => void;
  onReview: (item: VaultItem) => void;
  onOpenAuthenticator: () => void;
}) {
  const [filter, setFilter] = useState<Strength | "all">("all");
  const [explained, setExplained] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState(Date.now());
  const [auditLogs, setAuditLogs] = useState<SecurityAuditEntry[]>(() => getSecurityAuditLog());
  const [breachScanning, setBreachScanning] = useState(false);
  const [breachProgress, setBreachProgress] = useState<{ done: number; total: number } | null>(null);
  const [onlineBreach, setOnlineBreach] = useState<boolean>(() => isBreachOnlineEnabled());
  const [showConsent, setShowConsent] = useState(false);
  const [breachCount, setBreachCount] = useState<number | null>(null);
  const [breachedDetails, setBreachedDetails] = useState<
    Array<{ item: VaultItem; result: BreachCheckResult }>
  >([]);

  const timer = useRef<number | undefined>(undefined);
  const groupId = useId();
  const { reduceMotion } = useMotionSettings();

  const counts = useMemo(
    () => ({
      strong: items.filter((item) => item.strength === "strong").length,
      fair: items.filter((item) => item.strength === "fair").length,
      weak: items.filter((item) => item.strength === "weak").length,
    }),
    [items, checkedAt]
  );

  const score = items.length
    ? Math.round(
        ((counts.strong + counts.fair * 0.65 + counts.weak * 0.2) / items.length) * 100
      )
    : 0;

  const unsecured = items.filter((item) => item.category === "login" && !item.totp).length;
  const filtered = items.filter((item) => filter === "all" || item.strength === filter);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const refresh = () => {
    setChecking(true);
    timer.current = window.setTimeout(() => {
      setCheckedAt(Date.now());
      setChecking(false);
      const updated = addSecurityAuditEntry(
        "Local Vault Audit",
        score >= 80 ? "safe" : "warning",
        `Reviewed ${items.length} secrets. Health score: ${score}%`
      );
      setAuditLogs(updated);
      onNotify(`Local report refreshed: ${items.length} items reviewed`);
    }, reduceMotion ? 0 : 500);
  };

  const runDeepBreachAudit = async () => {
    setBreachScanning(true);
    setBreachProgress(null);
    try {
      // PERFORMANCE (V-21) / SECURITY (V-19): the previous implementation
      // issued one sequential HTTPS request per password, with no cache and
      // no deduplication. This batches every distinct hash prefix into a
      // bounded-concurrency fetch, so a vault of 500 passwords with 50
      // distinct prefixes costs 50 requests instead of 500 — and it restores
      // the k-anonymity property, because the whole vault is answered from a
      // small set of shared range buckets rather than 500 unique ones.
      const scannable = items.filter(
        (item) => item.password && item.password !== "—"
      );
      const scannedCount = scannable.length;

      if (scannedCount === 0) {
        setBreachCount(0);
        setBreachedDetails([]);
        onNotify("No passwords to check.");
        return;
      }

      const batch = await scanPasswordsBreach(
        scannable.map((item) => item.password as string),
        "en",
        (done, total) => setBreachProgress({ done, total })
      );

      const leaked: Array<{ item: VaultItem; result: BreachCheckResult }> = [];
      for (const item of scannable) {
        const res = batch.results.get(item.password as string);
        if (res?.breached) {
          leaked.push({ item, result: res });
        }
      }

      setBreachCount(leaked.length);
      setBreachedDetails(leaked);

      // The log records only counts. Titles, usernames and hash prefixes are
      // metadata about secrets and must never be persisted (V-20).
      const logDetail =
        leaked.length > 0
          ? `Found ${leaked.length} compromised password(s) out of ${scannedCount} checked via HIBP k-Anonymity.`
          : `Zero of ${scannedCount} checked passwords found across 1B+ breach leaks via HIBP k-Anonymity.`;

      const updated = addSecurityAuditEntry(
        "Zero-Knowledge Breach Scan",
        leaked.length > 0 ? "breached" : "safe",
        logDetail
      );
      setAuditLogs(updated);
      onNotify(
        leaked.length > 0
          ? `⚠️ Breach Audit: ${leaked.length} items found in compromised registries!`
          : "✅ Zero breaches detected across entire vault!"
      );
    } catch {
      onNotify("Breach scan failed.");
    } finally {
      setBreachScanning(false);
      setBreachProgress(null);
    }
  };

  return (
    <>
    <Modal
      onClose={onClose}
      title="Security center"
      subtitle="Your vault at a glance. Zero-knowledge local audits and breach verification."
      icon={<ShieldCheck size={22} weight="duotone" />}
      width="max-w-[690px]"
      footer={
        <div className="security-report-footer flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[8.5px] text-faint">
            <LockSimple size={12} weight="duotone" className="text-success" />
            Zero-knowledge k-Anonymity · Client side only
            {getRangeRequestCount() > 0 && (
              <span
                title="Each request retrieves a whole range of hash prefixes at once, so one request covers many passwords."
                className="ml-1 rounded-md border border-[var(--border-soft)] bg-[var(--glass-soft)] px-1.5 py-0.5 font-mono text-[8px] text-faint"
              >
                {getRangeRequestCount()} range {getRangeRequestCount() === 1 ? "query" : "queries"} this session
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={runDeepBreachAudit}
              disabled={breachScanning}
              className="secondary-button flex h-9 items-center gap-1.5 rounded-[12px] px-3.5 text-[10.5px] font-semibold text-accent"
            >
              <ShieldWarning size={14} className={breachScanning ? "animate-spin" : ""} />
              {breachScanning
                ? `Scanning… ${breachProgress ? `${breachProgress.done}/${breachProgress.total}` : "…"}`
                : "🛡️ Scan Vault Breaches"}
            </button>
            <button onClick={refresh} disabled={checking} className="secondary-button flex h-9 items-center gap-1.5 rounded-[12px] px-3.5 text-[10.5px] font-semibold">
              <ArrowClockwise size={14} className={checking ? "animate-spin" : ""} />
              {checking ? "Reviewing items..." : "Refresh report"}
            </button>
            <button
              onClick={() => {
                if (onlineBreach) {
                  setBreachOnlineEnabled(false);
                  setOnlineBreach(false);
                } else {
                  setShowConsent(true);
                }
              }}
              title="The optional online check queries a hash-prefix range API. Your passwords never leave the device."
              className="secondary-button flex h-9 items-center gap-1.5 rounded-[12px] px-3.5 text-[10.5px] font-semibold"
            >
              <GlobeHemisphereWest size={14} className={onlineBreach ? "text-success" : "text-faint"} />
              {onlineBreach ? "Online check on" : "Offline only"}
            </button>
          </div>
        </div>
      }
    >
      <div className="security-overview">
        <div className="security-score-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="var(--border-ink)"
              strokeWidth="7"
            />
            <motion.circle
              key={checkedAt}
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="var(--success)"
              strokeWidth="7"
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
              initial={{ pathLength: reduceMotion ? score / 100 : 0 }}
              animate={{ pathLength: score / 100 }}
              transition={{ duration: reduceMotion ? 0 : 0.9, ease: "easeOut" }}
            />
          </svg>
          <div>
            <strong>
              {score}
              <small>%</small>
            </strong>
            <span>Vault health</span>
          </div>
        </div>
        <div className="security-overview-copy">
          <p className="text-success flex items-center gap-1">
            <ShieldCheck size={14} weight="duotone" />{" "}
            {score >= 80 ? "Looking good" : "A little attention goes a long way"}
          </p>
          <h3>{counts.strong} strong. Let's protect the rest.</h3>
          <p>
            {items.length} items reviewed using cryptographic ratings. Your data stays sealed on
            this machine.
          </p>
          <div className="mt-1 flex items-center gap-3">
            <span className="text-[8px] text-faint">
              Last checked{" "}
              {new Date(checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {breachCount !== null && (
              <span
                className={`rounded-full px-2 py-0.5 text-[7.5px] font-bold ${
                  breachCount > 0
                    ? "bg-[var(--danger-soft)] text-danger"
                    : "bg-[var(--success-soft)] text-success"
                }`}
              >
                {breachCount > 0 ? `🚨 ${breachCount} Leaked Passwords` : "✅ 0 Breaches Found"}
              </span>
            )}
          </div>
        </div>
      </div>

      <LayoutGroup id={groupId}>
        <div className="security-metrics" role="group" aria-label="Security categories">
          {metrics.map((metric) => (
            <button
              key={metric.id}
              data-glass-option="true"
              aria-label={`Review ${metric.label.toLowerCase()} items`}
              aria-pressed={filter === metric.id}
              onClick={() => setFilter(filter === metric.id ? "all" : metric.id)}
            >
              {filter === metric.id && <GlassSelection />}
              <span className="metric-label">
                <i style={{ background: metric.color }} />
                {metric.label}
              </span>
              <span className="metric-count">
                {counts[metric.id]}
                <ArrowRight size={14} />
              </span>
            </button>
          ))}
        </div>
      </LayoutGroup>

      {/* Leaked & Compromised Accounts Dedicated Section */}
      {breachedDetails.length > 0 && (
        <div className="rounded-[18px] border border-red-500/35 bg-red-500/10 p-3.5 text-left shadow-lg">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[11.5px] font-bold text-danger">
              <ShieldWarning size={17} weight="fill" />
              🚨 Leaked & Compromised Accounts ({breachedDetails.length})
            </span>
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[7.5px] font-bold text-danger uppercase tracking-wider">
              Immediate Action Required
            </span>
          </div>
          <p className="mt-1 text-[8.5px] text-muted">
            The following accounts have passwords that appeared in public data breaches. Anyone with breach records can access them. Rotate these passwords immediately.
          </p>
          <div className="mt-3 space-y-2 max-h-[170px] overflow-y-auto thin-scrollbar">
            {breachedDetails.map(({ item, result }) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-[13px] border border-red-500/25 bg-[var(--glass-strong)] p-2.5 transition-all hover:border-red-500/40"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <BrandMark brand={item.brand} size={36} url={item.url} title={item.title} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[11px] font-bold text-main">{item.title}</span>
                      {item.url && (
                        <span className="truncate text-[8px] text-faint">({item.url})</span>
                      )}
                    </div>
                    <p className="truncate text-[9px] text-muted">{item.username || "No username / email"}</p>
                    <p className="text-[7.5px] text-danger font-semibold">
                      Found {result.count.toLocaleString()} times in HIBP database (SHA-1 Prefix: {result.sha1Prefix}***)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onReview(item);
                  }}
                  className="primary-button shrink-0 flex items-center gap-1 rounded-[10px] px-2.5 py-1 text-[9.5px] font-semibold text-white shadow-md"
                  style={{ background: "var(--danger)" }}
                >
                  Change Password Now →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="security-list-heading">
        <h3>
          {filter === "all"
            ? "Your vault report"
            : `${metrics.find((metric) => metric.id === filter)?.label} items`}{" "}
          <span>{filtered.length}</span>
        </h3>
        {filter !== "all" ? (
          <button onClick={() => setFilter("all")}>Show all items</button>
        ) : (
          <span>Select an item to inspect</span>
        )}
      </div>
      <motion.div layoutScroll className="security-report-list thin-scrollbar max-h-[170px] overflow-y-auto">
        <AnimatePresence initial={false} mode="popLayout">
          {filtered.map((item) => (
            <motion.button
              layout="position"
              key={item.id}
              className="security-report-row"
              onClick={() => onReview(item)}
              aria-label={`Inspect ${item.title}`}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={
                reduceMotion ? { duration: 0 } : { ...softSpring, opacity: { duration: 0.12 } }
              }
            >
              <BrandMark brand={item.brand} size={34} />
              <span className="report-item-name">
                <strong>{item.title}</strong>
                <small>{item.username}</small>
              </span>
              <span
                className="report-item-status"
                style={{
                  color: metrics.find((metric) => metric.id === item.strength)?.color,
                }}
              >
                {metrics.find((metric) => metric.id === item.strength)?.label}
              </span>
              <ArrowRight size={14} />
            </motion.button>
          ))}
        </AnimatePresence>
        {!filtered.length && (
          <p className="security-empty">
            <CheckCircle size={21} weight="duotone" /> No items in this category.
          </p>
        )}
      </motion.div>

      {/* Local Security Audit Timeline */}
      {auditLogs.length > 0 && (
        <div className="rounded-[16px] border border-[var(--border-soft)] bg-[var(--glass-soft)] p-3 text-left">
          <div className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-[0.1em] text-muted">
            <ClockCounterClockwise size={12} weight="duotone" className="text-accent" />
            Local Security Audit Timeline
          </div>
          <div className="mt-2 space-y-1.5 max-h-[100px] overflow-y-auto thin-scrollbar">
            {auditLogs.slice(0, 4).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between text-[8px] border-b border-[var(--border-soft)]/50 pb-1 last:border-b-0"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      entry.status === "breached"
                        ? "bg-[var(--danger)]"
                        : entry.status === "warning"
                        ? "bg-[var(--warning)]"
                        : "bg-[var(--success)]"
                    }`}
                  />
                  <span className="font-semibold text-main">{entry.action}</span>
                  <span className="text-faint truncate max-w-[280px]">{entry.detail}</span>
                </div>
                <span className="text-faint text-[7px] shrink-0">
                  {new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="security-2fa-link" onClick={onOpenAuthenticator}>
        <Fingerprint size={24} weight="duotone" />
        <span>
          <strong>
            {unsecured
              ? `${unsecured} logins could use an extra layer`
              : "Your logins have two-factor protection"}
          </strong>
          <small>Open the authenticator to manage your accounts.</small>
        </span>
        <ArrowRight size={15} />
      </button>

      <div className="security-score-explanation">
        <button
          onClick={() => setExplained((current) => !current)}
          aria-expanded={explained}
          aria-controls="score-method"
        >
          <Info size={14} weight="duotone" /> How is this score calculated?
          <motion.span
            animate={{ rotate: explained ? 180 : 0 }}
            transition={reduceMotion ? { duration: 0 } : softSpring}
          >
            <CaretDown size={12} />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {explained && (
            <motion.div
              id="score-method"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : softSpring}
            >
              <p>
                Strong items contribute 100%, review items 65%, and weak items 20%. The average
                across your {items.length} saved items gives this report its {score}% score. Zero-Knowledge breach audits query the Cloudflare-backed k-Anonymity registry using only a 5-character SHA-1 prefix; your passwords never leave your device.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>

    {/* Consent dialog for the optional online breach check (V-18). */}
    {showConsent && (
      <Modal
        onClose={() => setShowConsent(false)}
        title="Enable the online breach check?"
        subtitle="This is optional. VaultZero works fully offline without it."
        icon={<GlobeHemisphereWest size={22} weight="duotone" />}
        width="max-w-[520px]"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setShowConsent(false)}
              className="secondary-button flex h-9 items-center rounded-[12px] px-4 text-[10.5px] font-semibold"
            >
              Stay offline
            </button>
            <button
              onClick={() => {
                setBreachOnlineEnabled(true);
                setOnlineBreach(true);
                setShowConsent(false);
                onNotify("Online breach check enabled.");
              }}
              className="primary-button flex h-9 items-center rounded-[12px] px-4 text-[10.5px] font-semibold"
            >
              Enable online check
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-[11px] leading-relaxed text-soft">
          <p>
            The offline audit always runs and never touches the network. Enabling this adds an
            <strong> optional</strong> lookup against Have I Been Pwned&apos;s range API.
          </p>
          <div className="glass-soft rounded-[14px] border border-[var(--border-soft)] p-3">
            <p className="mb-1.5 font-semibold text-main">What leaves your device</p>
            <ul className="ml-4 list-disc space-y-1 text-[10.5px] text-muted">
              <li>
                One SHA-1 hash <em>prefix</em> per distinct password prefix — 5 hexadecimal
                characters. Your password is never sent.
              </li>
              <li>
                Requests are batched, so many passwords share a single request. The Security
                Center shows the exact query count.
              </li>
            </ul>
            <p className="mb-1.5 mt-2.5 font-semibold text-main">What never leaves your device</p>
            <ul className="ml-4 list-disc space-y-1 text-[10.5px] text-muted">
              <li>The password itself, and the full hash used to match it locally.</li>
              <li>Your entry titles, usernames and notes.</li>
            </ul>
          </div>
          <p className="text-[10px] text-faint">
            You can switch this off at any time with the &ldquo;Offline only&rdquo; button.
          </p>
        </div>
      </Modal>
    )}
    </>
  );
}
