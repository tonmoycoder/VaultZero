import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useIsPresent } from "framer-motion";
import { Check, Copy, X } from "@phosphor-icons/react";
import { brands, type BrandKey, type Strength } from "../lib/vault";
import { cn } from "../utils/cn";
import { hapticSuccess, useMotionSettings } from "./Tactile";
import { exitTransition, softSpring, spring, useDialogFocus } from "../lib/motion";

export function Logo({ size = 40, showGlow = true }: { size?: number; showGlow?: boolean }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      {showGlow && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-[28%] opacity-60 blur-md"
          style={{
            background: "radial-gradient(circle at 68% 82%, rgba(191, 95, 255, .9), rgba(91, 205, 255, .2) 60%, transparent 72%)",
          }}
        />
      )}
      <img
        src="/vaultzero-logo.png"
        alt="VaultZero emblem"
        width={size}
        height={size}
        className="relative h-full w-full rounded-[28%] border border-white/25 object-cover shadow-[0_4px_14px_rgba(30,20,70,.28)]"
      />
    </span>
  );
}

export function extractSafeDomain(urlOrDomain?: string): string | null {
  if (!urlOrDomain) return null;
  let raw = urlOrDomain.trim().toLowerCase();
  try {
    if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
      raw = `https://${raw}`;
    }
    const parsed = new URL(raw);
    const host = parsed.hostname;
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(host)) return null;
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host.endsWith(".lan") ||
      host.startsWith("127.") ||
      host.startsWith("192.168.") ||
      host.startsWith("10.")
    ) {
      return null;
    }
    return host;
  } catch {
    return null;
  }
}

export function BrandMark({
  brand,
  size = 40,
  className,
  muted = false,
  url,
  title,
}: {
  brand: BrandKey;
  size?: number;
  className?: string;
  muted?: boolean;
  url?: string;
  title?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const data = brands[brand] || brands.vault;
  const safeDomain = useMemo(() => extractSafeDomain(url), [url]);

  // 1. Registered vector in simple-icons (non-vault)
  if (brand !== "vault" && data.path) {
    return (
      <span
        className={cn(
          "brand-tile inline-flex shrink-0 items-center justify-center rounded-[30%]",
          className,
        )}
        style={{ width: size, height: size }}
        aria-label={data.name}
      >
        <svg
          viewBox="0 0 24 24"
          width={size * 0.52}
          height={size * 0.52}
          fill={muted ? "currentColor" : data.hex}
          aria-hidden="true"
          className="opacity-95"
        >
          <path d={data.path} />
        </svg>
      </span>
    );
  }

  // 2. Safe official high-res favicon if valid domain exists and hasn't errored
  if (safeDomain && !imgFailed) {
    return (
      <span
        className={cn(
          "brand-tile inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[30%] border border-white/20 bg-white/10 p-1 shadow-sm",
          className,
        )}
        style={{ width: size, height: size }}
        aria-label={title || safeDomain}
      >
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(safeDomain)}&sz=128`}
          alt={title || safeDomain}
          referrerPolicy="no-referrer"
          className="h-full w-full object-contain rounded-[20%]"
          onError={() => setImgFailed(true)}
        />
      </span>
    );
  }

  // 3. Clean Monogram Initial Avatar (Zero Wrong Logos fallback)
  const initial = (title || data.name || "V").trim().charAt(0).toUpperCase();

  return (
    <span
      className={cn(
        "brand-tile inline-flex shrink-0 items-center justify-center rounded-[30%]",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label={data.name}
    >
      {initial && initial !== "V" ? (
        <span
          className="flex h-full w-full items-center justify-center rounded-[30%] font-semibold text-main text-[12px] border border-white/10"
          style={{ background: data.tint || "rgba(124, 107, 255, 0.14)", color: data.hex || "var(--accent)" }}
        >
          {initial}
        </span>
      ) : (
        <svg viewBox="0 0 24 24" width={size * 0.54} height={size * 0.54} fill="none" aria-hidden="true">
          <path d="M5 10.5V8a7 7 0 0 1 14 0v2.5" stroke={data.hex} strokeWidth="2.1" strokeLinecap="round" />
          <rect x="4" y="10" width="16" height="10" rx="3.2" fill={data.hex} opacity=".16" />
          <rect x="4" y="10" width="16" height="10" rx="3.2" stroke={data.hex} strokeWidth="1.7" />
          <circle cx="12" cy="15" r="1.45" fill={data.hex} />
          <path d="M12 16v2" stroke={data.hex} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

export function Avatar({
  name = "Ayaan Rahman",
  size = 34,
  className,
}: {
  name?: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/40 font-semibold text-white shadow-[0_5px_14px_rgba(70,45,150,.22)]",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.32,
        background:
          "radial-gradient(circle at 72% 24%, #e7c5ff 0%, #ab79e8 33%, #6850c4 67%, #293a81 100%)",
      }}
      aria-label={name}
    >
      <span className="relative z-10 tracking-tight">{initials}</span>
      <span className="absolute inset-x-1 top-0 h-1/2 rounded-full bg-white/20 blur-sm" />
    </span>
  );
}

export function Tooltip({
  label,
  children,
  side,
  up,
  className,
}: {
  label: string;
  children: ReactNode;
  side?: boolean;
  up?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("tooltip-wrap inline-flex", className)}>
      {children}
      <span className={cn("tooltip-bubble", side && "side", up && "up")} role="tooltip">
        {label}
      </span>
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>;
}

export function Modal({
  onClose,
  title,
  subtitle,
  icon,
  children,
  width = "max-w-[560px]",
  className,
  bodyClassName,
  footer,
}: {
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  width?: string;
  className?: string;
  bodyClassName?: string;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const isPresent = useIsPresent();
  const { reduceMotion } = useMotionSettings();
  useDialogFocus(ref, onClose, isPresent);

  return createPortal(
    <motion.div
      ref={ref}
      tabIndex={-1}
      className="modal-overlay fixed inset-0 z-[100] flex items-end justify-center bg-[#070914]/35 p-0 backdrop-blur-[10px] sm:items-center sm:p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
      style={{ pointerEvents: isPresent ? "auto" : "none" }}
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <motion.div
        initial={{ y: reduceMotion ? 0 : 24, scale: reduceMotion ? 1 : 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: reduceMotion ? 0 : 16, scale: reduceMotion ? 1 : 0.97, transition: reduceMotion ? { duration: 0 } : exitTransition }}
        transition={reduceMotion ? { duration: 0 } : softSpring}
        className={cn(
          "glass-strong modal-surface flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] sm:rounded-[26px]",
          width,
          className,
        )}
        style={{ boxShadow: "0 40px 100px rgba(8,10,28,.38), var(--inset-hi)" }}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <span
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border"
                style={{
                  color: "var(--accent)",
                  background: "var(--accent-soft)",
                  borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)",
                }}
              >
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2 id={titleId} className="font-display text-[19px] font-semibold leading-tight tracking-[-0.02em] text-main">{title}</h2>
              {subtitle && <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{subtitle}</p>}
            </div>
          </div>
          <Tooltip label="Close · Esc">
            <button
              onClick={onClose}
              className="icon-button -mr-1 -mt-1 h-8 w-8 shrink-0 rounded-full"
              aria-label="Close dialog"
            >
              <X size={15} weight="bold" />
            </button>
          </Tooltip>
        </header>
        <div className={cn("thin-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6", bodyClassName)}>
          {children}
        </div>
        {footer && (
          <footer
            className="shrink-0 border-t border-[var(--border-soft)] px-5 py-3.5 sm:px-6"
            style={{ background: "var(--glass-soft)" }}
          >
            {footer}
          </footer>
        )}
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  const { reduceMotion } = useMotionSettings();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors duration-200"
      style={{
        background: checked ? "var(--accent)" : "var(--border-ink)",
        borderColor: checked ? "color-mix(in srgb, var(--accent) 70%, white)" : "var(--border-soft)",
      }}
    >
      <motion.span
        className="absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white shadow-sm"
        initial={false}
        animate={{ x: checked ? 16 : 0 }}
        transition={reduceMotion ? { duration: 0 } : spring}
        style={{ left: 2 }}
      />
    </button>
  );
}

export function StrengthDots({ strength, score, className }: { strength: Strength; score: number; className?: string }) {
  const color = strength === "strong" ? "var(--success)" : strength === "fair" ? "var(--warning)" : "var(--danger)";
  return (
    <span className={cn("inline-flex items-center gap-[3px]", className)} aria-label={`Password strength: ${strength}`}>
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className="h-[3px] w-[9px] rounded-full transition-colors"
          style={{ background: n <= score ? color : "var(--border-ink)" }}
        />
      ))}
    </span>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[9px] font-bold uppercase tracking-[0.14em] text-faint", className)}>{children}</p>
  );
}

export function CopyButton({
  value,
  onCopied,
  label = "Copy",
  filled,
  className,
}: {
  value: string;
  onCopied: (message: string) => void;
  label?: string;
  filled?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    hapticSuccess();
    onCopied(`${label} copied to clipboard`);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Tooltip label={copied ? "Copied" : label}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void copy();
        }}
        className={cn(
          "inline-flex items-center justify-center rounded-full transition-colors",
          filled
            ? "h-8 gap-1.5 px-3 text-[10.5px] font-semibold text-white"
            : "h-7 w-7 text-muted hover:text-main",
          className,
        )}
        style={filled ? { background: "var(--accent)" } : {}}
        aria-label={label}
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={copied ? "copied" : "copy"}
            className="inline-flex"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.13 }}
          >
            {copied ? <Check size={13} weight="bold" className="text-success" /> : <Copy size={13} weight="duotone" />}
          </motion.span>
        </AnimatePresence>
        {filled && <span>{copied ? "Copied" : label}</span>}
      </button>
    </Tooltip>
  );
}

export function useCountdown(period = 30) {
  const [remaining, setRemaining] = useState(() => {
    const now = Math.floor(Date.now() / 1000);
    return period - (now % period);
  });
  useEffect(() => {
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      setRemaining(period - (now % period));
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [period]);
  return { remaining, progress: remaining / period };
}

export function TotpRing({
  size = 32,
  remaining,
  progress,
  stroke = 2.5,
}: {
  size?: number;
  remaining: number;
  progress: number;
  stroke?: number;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = remaining <= 5 ? "var(--danger)" : "var(--accent)";
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-ink)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span
        className="absolute font-mono font-semibold tabular-nums"
        style={{ color, fontSize: size * 0.3 }}
      >
        {remaining}
      </span>
    </span>
  );
}

export function GlassCheck({
  checked,
  onChange,
  label,
  className,
  style,
}: {
  checked: boolean;
  onChange: () => void;
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border transition-all",
        className,
      )}
      style={{
        background: checked ? "var(--accent)" : "var(--glass-input)",
        borderColor: checked ? "var(--accent)" : "var(--border)",
        ...style,
      }}
    >
      {checked && <Check size={11} weight="bold" className="text-white" />}
    </button>
  );
}
