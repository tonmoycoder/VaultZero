import { ArrowClockwise, ArrowRight, CaretDown, CheckCircle, Fingerprint, Info, LockSimple, ShieldCheck } from "@phosphor-icons/react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Strength, VaultItem } from "../lib/vault";
import { softSpring } from "../lib/motion";
import GlassSelection from "./GlassSelection";
import { BrandMark, Modal } from "./ui";
import { useMotionSettings } from "./Tactile";

const metrics = [
  { id: "strong" as const, label: "Strong", color: "var(--success)" },
  { id: "fair" as const, label: "To review", color: "var(--warning)" },
  { id: "weak" as const, label: "Weak", color: "var(--danger)" },
];

export default function SecurityCenterModal({ items, onClose, onNotify, onReview, onOpenAuthenticator }: {
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
  const timer = useRef<number | undefined>(undefined);
  const groupId = useId();
  const { reduceMotion } = useMotionSettings();
  const counts = useMemo(() => ({
    strong: items.filter((item) => item.strength === "strong").length,
    fair: items.filter((item) => item.strength === "fair").length,
    weak: items.filter((item) => item.strength === "weak").length,
  }), [items, checkedAt]);
  const score = items.length ? Math.round((counts.strong + counts.fair * 0.65 + counts.weak * 0.2) / items.length * 100) : 0;
  const unsecured = items.filter((item) => item.category === "login" && !item.totp).length;
  const filtered = items.filter((item) => filter === "all" || item.strength === filter);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const refresh = () => {
    setChecking(true);
    timer.current = window.setTimeout(() => {
      setCheckedAt(Date.now());
      setChecking(false);
      onNotify(`Local report refreshed: ${items.length} items reviewed`);
    }, reduceMotion ? 0 : 650);
  };

  return (
    <Modal
      onClose={onClose}
      title="Security center"
      subtitle="Your vault at a glance. Select a category to take a closer look."
      icon={<ShieldCheck size={22} weight="duotone" />}
      width="max-w-[670px]"
      footer={
        <div className="security-report-footer">
          <span><LockSimple size={12} /> Local report, no online breach check</span>
          <button onClick={refresh} disabled={checking} className="secondary-button">
            <ArrowClockwise size={14} className={checking ? "animate-spin" : ""} />
            {checking ? "Reviewing items..." : "Refresh report"}
          </button>
        </div>
      }
    >
      <div className="security-overview">
        <div className="security-score-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border-ink)" strokeWidth="7" />
            <motion.circle
              key={checkedAt}
              cx="60" cy="60" r="50" fill="none" stroke="var(--success)" strokeWidth="7" strokeLinecap="round"
              transform="rotate(-90 60 60)"
              initial={{ pathLength: reduceMotion ? score / 100 : 0 }}
              animate={{ pathLength: score / 100 }}
              transition={{ duration: reduceMotion ? 0 : 0.9, ease: "easeOut" }}
            />
          </svg>
          <div><strong>{score}<small>%</small></strong><span>Vault health</span></div>
        </div>
        <div className="security-overview-copy">
          <p className="text-success"><ShieldCheck size={14} weight="duotone" /> {score >= 80 ? "Looking good" : "A little attention goes a long way"}</p>
          <h3>{counts.strong} strong. Let's protect the rest.</h3>
          <p>{items.length} items reviewed using their saved security ratings. Your report stays right here.</p>
          <span>Last checked {new Date(checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
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
              <span className="metric-label"><i style={{ background: metric.color }} />{metric.label}</span>
              <span className="metric-count">{counts[metric.id]}<ArrowRight size={14} /></span>
            </button>
          ))}
        </div>
      </LayoutGroup>

      <div className="security-list-heading">
        <h3>{filter === "all" ? "Your vault report" : `${metrics.find((metric) => metric.id === filter)?.label} items`} <span>{filtered.length}</span></h3>
        {filter !== "all" ? <button onClick={() => setFilter("all")}>Show all items</button> : <span>Select an item to inspect</span>}
      </div>
      <motion.div layoutScroll className="security-report-list thin-scrollbar">
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
              transition={reduceMotion ? { duration: 0 } : { ...softSpring, opacity: { duration: 0.12 } }}
            >
              <BrandMark brand={item.brand} size={34} />
              <span className="report-item-name"><strong>{item.title}</strong><small>{item.username}</small></span>
              <span className="report-item-status" style={{ color: metrics.find((metric) => metric.id === item.strength)?.color }}>
                {metrics.find((metric) => metric.id === item.strength)?.label}
              </span>
              <ArrowRight size={14} />
            </motion.button>
          ))}
        </AnimatePresence>
        {!filtered.length && <p className="security-empty"><CheckCircle size={21} weight="duotone" /> No items in this category.</p>}
      </motion.div>

      <button className="security-2fa-link" onClick={onOpenAuthenticator}>
        <Fingerprint size={24} weight="duotone" />
        <span><strong>{unsecured ? `${unsecured} logins could use an extra layer` : "Your logins have two-factor protection"}</strong><small>Open the authenticator to manage your accounts.</small></span>
        <ArrowRight size={15} />
      </button>
      <div className="security-score-explanation">
        <button onClick={() => setExplained((current) => !current)} aria-expanded={explained} aria-controls="score-method">
          <Info size={14} weight="duotone" /> How is this score calculated?
          <motion.span animate={{ rotate: explained ? 180 : 0 }} transition={reduceMotion ? { duration: 0 } : softSpring}><CaretDown size={12} /></motion.span>
        </button>
        <AnimatePresence initial={false}>
          {explained && <motion.div id="score-method" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduceMotion ? { duration: 0 } : softSpring}>
            <p>Strong items contribute 100%, review items 65%, and weak items 20%. The average across your {items.length} saved items gives this report its {score}% score. Open an item for its individual password checks. This preview does not query a breach database.</p>
          </motion.div>}
        </AnimatePresence>
      </div>
    </Modal>
  );
}