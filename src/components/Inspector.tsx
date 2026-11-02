import {
  ArrowSquareOut,
  Check,
  Clock,
  ClockCountdown,
  Copy,
  Eye,
  EyeSlash,
  Fingerprint,
  FolderSimple,
  Globe,
  Key,
  LockSimple,
  NotePencil,
  PencilSimple,
  ShieldCheck,
  Sparkle,
  Star,
  Timer,
  Trash,
  X,
} from "@phosphor-icons/react";
import { memo, useEffect, useId, useState, type PointerEvent, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { brands, buildFormattedQuickCopy, strengthMeta, t, type Language, type VaultItem } from "../lib/vault";
import { cn } from "../utils/cn";
import { sanitizeVaultUrl } from "../lib/url";
import { BrandMark, CopyButton, SectionLabel, StrengthDots, Tooltip, TotpRing, useCountdown } from "./ui";
import GlassSelection from "./GlassSelection";
import ItemSecurity from "./ItemSecurity";
import { useMotionSettings } from "./Tactile";

async function copyText(value: string, onNotify: (message: string) => void, message: string) {
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
  onNotify(message);
}

function FieldRow({
  label,
  value,
  mono,
  children,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 px-3 py-[9px]">
      <div className="min-w-0 flex-1">
        <p className="inspector-field-label font-bold uppercase tracking-[0.1em] text-faint">{label}</p>
        <p className={cn("inspector-field-value mt-1 truncate font-medium leading-normal text-main", mono && "font-mono")}>
          {value}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">{children}</div>
    </div>
  );
}

const IsolatedInspectorTotp = memo(function IsolatedInspectorTotp({
  code,
  lang,
  onNotify,
}: {
  code: string;
  lang: Language;
  onNotify: (msg: string) => void;
}) {
  const { remaining, progress } = useCountdown();
  return (
    <div
      className="inspector-field"
      style={{
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.03)",
        borderColor: "color-mix(in srgb, var(--accent) 18%, transparent)",
      }}
    >
      <div className="flex items-center justify-between px-3 pb-1.5 pt-2.5">
        <div className="flex items-center gap-1.5">
          <Fingerprint size={12} weight="duotone" style={{ color: "var(--accent)" }} />
          <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-muted">{t(lang, "totp")}</span>
          <span className="rounded-full px-1 py-[1px] text-[6.5px] font-bold text-[var(--success)]" style={{ background: "var(--success-soft)" }}>
            TOTP
          </span>
        </div>
        <span className="flex items-center gap-1 text-[7.5px] text-faint">
          <Timer size={9} />
          {t(lang, "expires")} {remaining}{t(lang, "seconds")}
        </span>
      </div>
      <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-0.5">
        <TotpRing size={29} remaining={remaining} progress={progress} stroke={2.3} />
        <button
          onClick={() => void copyText(code.replace(/\s/g, ""), onNotify, "2FA code copied")}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-label="Copy two factor code"
        >
          <span className="font-mono text-[18px] font-semibold tracking-[0.14em] text-main">{code}</span>
          <Copy size={11} className="text-faint" />
        </button>
        <span className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--success)]" style={{ background: "var(--success-soft)" }}>
          <Check size={10} weight="bold" />
        </span>
      </div>
      <div className="h-[2px] bg-[var(--border-soft)]">
        <div className="h-full transition-[width] duration-1000 ease-linear" style={{ width: `${progress * 100}%`, background: "var(--accent)" }} />
      </div>
    </div>
  );
});

function InspectorBody({
  item,
  lang,
  onNotify,
  onTool,
  onInspectSecurity,
  onRestorePassword,
}: {
  item: VaultItem;
  lang: Language;
  onNotify: (message: string) => void;
  onTool?: (tool: "authenticator" | "generator" | "security") => void;
  onInspectSecurity: () => void;
  onRestorePassword?: (item: VaultItem, restoredPassword: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [codesRevealed, setCodesRevealed] = useState(false);
  const [revealedHistoryIndex, setRevealedHistoryIndex] = useState<number | null>(null);
  const brand = brands[item.brand];
  const strength = strengthMeta[item.strength];
  const masked = "•".repeat(Math.min(Math.max(item.password.length, 10), 16));
  // SECURITY: a stored URL is user data. It is sanitised before it can
  // reach an `href`, so a `javascript:` or `data:` URL from an imported CSV
  // can never execute in the app's origin.
  const siteUrl = sanitizeVaultUrl(item.url);

  return (
    <div className="inspector-body thin-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-1 max-w-full box-border">
      {/* Item hero */}
      <div
        className="relative overflow-visible rounded-[18px] border p-3.5"
        style={{
          borderColor: "var(--border)",
          background: `linear-gradient(145deg, ${brand.tint}, var(--glass-soft))`,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full opacity-25 blur-3xl overflow-hidden"
          style={{ background: brand.hex }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[18px] bg-gradient-to-r from-transparent via-white/70 to-transparent" />
        <div className="relative flex items-center gap-3">
          <span className="relative shrink-0">
            <BrandMark brand={item.brand} size={52} url={item.url} title={item.title} />
            <span
              className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[var(--glass-solid)] text-white"
              style={{ background: "var(--success)" }}
              title="Locally sealed"
            >
              <Check size={7} weight="bold" />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1.5">
              <h2 className="min-w-0 flex-1 truncate font-display text-[19px] font-semibold leading-tight tracking-[-0.025em] text-main">
                {item.title}
              </h2>
              {item.favorite && <Star size={13} weight="fill" style={{ color: "var(--warning)" }} />}
            </div>
            <a
              href={siteUrl ?? undefined}
              target={siteUrl ? "_blank" : undefined}
              rel="noreferrer"
              className="mt-0.5 flex items-center gap-1 truncate text-[9px] font-medium text-muted transition-colors hover:text-accent"
            >
              <Globe size={10} weight="duotone" />
              {item.url || "Stored locally"}
            </a>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span
                className="rounded-full px-1.5 py-[3px] text-[7.5px] font-bold uppercase tracking-[0.08em]"
                style={{ color: "var(--accent)", background: "var(--accent-soft)" }}
              >
                {item.category === "note" ? "Secure note" : item.category}
              </span>
              {item.tags?.slice(0, 2).map((tag) => (
                <span key={tag} className="rounded-full border border-[var(--border-soft)] px-1.5 py-[3px] text-[7.5px] font-medium text-muted">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="relative mt-3 grid grid-cols-2 gap-1.5">
          <a
            href={siteUrl ?? undefined}
            target={siteUrl ? "_blank" : undefined}
            rel="noreferrer"
            aria-disabled={!siteUrl}
            onClick={(e) => {
              if (!siteUrl) e.preventDefault();
            }}
            className={cn(
              "flex h-[33px] items-center justify-center gap-1.5 rounded-[10px] text-[10px] font-semibold",
              siteUrl ? "primary-button" : "secondary-button cursor-default opacity-55"
            )}
          >
            <ArrowSquareOut size={12} weight="bold" />
            {t(lang, "launchWebsite")}
          </a>
          <Tooltip
            up
            className="w-full"
            label={
              lang === "bn"
                ? "অ্যাকাউন্টের সকল তথ্য (নাম, ওয়েবসাইট, ইউজারনেম, পাসওয়ার্ড, 2FA কোড ও নোট) সাজানো লাইন-বাই-লাইন আকারে এক ক্লিকে কপি করুন"
                : "Copy all account details (Title, Website, Username, Password, 2FA Code & Notes) formatted line-by-line"
            }
          >
            <button
              onClick={() => {
                const formatted = buildFormattedQuickCopy(item, item.totp);
                void copyText(
                  formatted,
                  onNotify,
                  lang === "bn"
                    ? "✓ অ্যাকাউন্টের সব তথ্য লাইন-বাই-লাইন কপি হয়েছে!"
                    : "✓ All account details copied line-by-line!"
                );
              }}
              className="secondary-button flex h-[33px] w-full items-center justify-center gap-1.5 rounded-[10px] text-[10px] font-semibold"
              aria-label="Quick copy all details"
            >
              <Copy size={12} weight="duotone" />
              Quick copy
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Credentials */}
      <div className="glass-soft mt-2.5 divide-y divide-[var(--border-soft)] overflow-hidden rounded-[16px] border border-[var(--border-soft)]">
        <FieldRow label={t(lang, "username")} value={item.username}>
          <CopyButton value={item.username} label={t(lang, "username")} onCopied={onNotify} />
        </FieldRow>
        <FieldRow label={t(lang, "password")} value={<span className={cn(revealed && "text-accent")}>{revealed ? item.password : masked}</span>} mono>
          <Tooltip label={revealed ? t(lang, "hide") : t(lang, "reveal")}>
            <button
              onClick={() => setRevealed((value) => !value)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-[var(--hover)] hover:text-main"
              aria-label={revealed ? t(lang, "hide") : t(lang, "reveal")}
            >
              {revealed ? <EyeSlash size={13} weight="duotone" /> : <Eye size={13} weight="duotone" />}
            </button>
          </Tooltip>
          <CopyButton value={item.password} label={t(lang, "password")} onCopied={onNotify} />
        </FieldRow>
        <button
          className="password-health-action flex w-full items-center justify-between gap-2 bg-[var(--glass-soft)] px-3 py-2"
          onClick={onInspectSecurity}
          aria-label="View password security details"
        >
          <span className="flex items-center gap-1.5 text-[8px] font-medium" style={{ color: strength.color }}>
            <ShieldCheck size={12} weight="duotone" />
            {t(lang, "strength")}: {t(lang, strength.labelKey)}
          </span>
          <StrengthDots strength={item.strength} score={item.score} />
        </button>
      </div>

      {/* Authenticator */}
      {item.totp ? (
        <IsolatedInspectorTotp code={item.totp} lang={lang} onNotify={onNotify} />
      ) : (
        <button
          onClick={() => onTool?.("authenticator")}
          className="glass-soft mt-2.5 flex w-full items-center gap-2.5 rounded-[16px] border-dashed px-3 py-2.5 text-left transition-colors hover:bg-[var(--hover)]"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-[9px] text-faint" style={{ background: "var(--glass-strong)" }}>
            <Fingerprint size={15} weight="duotone" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[9.5px] font-semibold text-main">Add two-factor protection</span>
            <span className="block text-[8px] text-faint">A stronger shield for this account</span>
          </span>
          <span className="text-[8.5px] font-semibold text-accent">Set up</span>
        </button>
      )}

      {/* Password History Time Machine */}
      <div className="glass-soft mt-2.5 overflow-hidden rounded-[16px] border border-[var(--border-soft)]">
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-3 py-2">
          <span className="flex items-center gap-1.5 text-[8.5px] font-semibold text-main">
            <ClockCountdown size={12} weight="duotone" className="text-accent" />
            {t(lang, "passwordHistory")}
          </span>
          <span className="font-mono text-[7.5px] text-faint">
            {item.passwordHistory?.length || 0}
          </span>
        </div>
        <div className="divide-y divide-[var(--border-soft)]">
          {item.passwordHistory && item.passwordHistory.length > 0 ? (
            item.passwordHistory.map((hist, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 px-3 py-2 text-[8.5px]">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[9.5px] text-muted">
                    {revealedHistoryIndex === idx ? hist.password : "••••••••••••"}
                  </p>
                  <p className="text-[7.5px] text-faint">{hist.changedAt}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setRevealedHistoryIndex(revealedHistoryIndex === idx ? null : idx)
                    }
                    className="flex h-6 w-6 items-center justify-center rounded-full text-faint hover:text-main"
                    title="Toggle reveal"
                  >
                    {revealedHistoryIndex === idx ? <EyeSlash size={11} /> : <Eye size={11} />}
                  </button>
                  {onRestorePassword && (
                    <button
                      type="button"
                      onClick={() => onRestorePassword(item, hist.password)}
                      className="secondary-button h-6 rounded-md px-2 text-[7.5px] font-semibold text-accent"
                      title="Restore this past password"
                    >
                      {t(lang, "restorePassword")}
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="px-3 py-2.5 text-[8px] italic text-faint">
              {t(lang, "noPasswordHistory")}
            </p>
          )}
        </div>
      </div>

      {/* Recovery codes */}
      {item.recoveryCodes && (
        <div className="glass-soft mt-2.5 overflow-hidden rounded-[16px] border border-[var(--border-soft)]">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border-soft)] px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Key size={12} weight="duotone" className="text-muted" />
              <span className="text-[8.5px] font-semibold text-main">{t(lang, "recovery")}</span>
              <span className="font-mono text-[7px] text-faint">{item.recoveryCodes.length}</span>
            </div>
            <div className="flex items-center gap-0.5">
              <Tooltip label={codesRevealed ? "Hide codes" : "Reveal codes"}>
                <button
                  onClick={() => setCodesRevealed((value) => !value)}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-faint hover:bg-[var(--hover)] hover:text-main"
                  aria-label="Reveal recovery codes"
                >
                  {codesRevealed ? <EyeSlash size={11} /> : <Eye size={11} />}
                </button>
              </Tooltip>
              <CopyButton
                value={item.recoveryCodes.join("\n")}
                label="Recovery codes"
                onCopied={onNotify}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 px-2.5 py-2">
            {item.recoveryCodes.map((code, index) => (
              <div
                key={code}
                className="flex min-w-0 items-center gap-1.5 rounded-[7px] border border-[var(--border-soft)] bg-[var(--glass-input)] px-1.5 py-1.5"
              >
                <span className="w-2 shrink-0 font-mono text-[7px] text-faint">{index + 1}</span>
                <span className="truncate font-mono text-[8px] tracking-tight text-soft">
                  {codesRevealed ? code : "••••-••••-••••"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Note */}
      {item.note && (
        <div className="glass-soft mt-2.5 rounded-[15px] border border-[var(--border-soft)] p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.1em] text-faint">
            <NotePencil size={10} weight="duotone" />
            Secure note
          </p>
          <p className="text-[9px] leading-relaxed text-soft">{item.note}</p>
        </div>
      )}

      <section className="inspector-metadata" aria-label="Additional item information">
        <SectionLabel>Item information</SectionLabel>
        <dl>
          <div><dt><FolderSimple size={12} weight="duotone" /> Folder</dt><dd>{item.folder ?? "Unfiled"}</dd></div>
          <div><dt><Clock size={12} weight="duotone" /> Last edited</dt><dd>{item.modified}</dd></div>
          <div><dt><Key size={12} weight="duotone" /> Password length</dt><dd>{item.password.length} characters</dd></div>
          <div><dt><Fingerprint size={12} weight="duotone" /> Authenticator</dt><dd className={item.totp ? "text-success" : "text-muted"}>{item.totp ? "Connected" : "Not set up"}</dd></div>
        </dl>
      </section>
    </div>
  );
}

export default function DetailInspector({
  item,
  lang,
  onClose,
  onNotify,
  onTool,
  onEdit,
  onDelete,
  onFavorite,
  onRestorePassword,
  onDragHandlePointerDown,
  mode = "panel",
}: {
  item: VaultItem | null;
  lang: Language;
  onClose: () => void;
  onNotify: (message: string) => void;
  onTool?: (tool: "authenticator" | "generator" | "security") => void;
  onEdit: (item: VaultItem) => void;
  onDelete?: (item: VaultItem) => void;
  onFavorite: (item: VaultItem) => void;
  onRestorePassword?: (item: VaultItem, restoredPassword: string) => void;
  onDragHandlePointerDown?: (event: PointerEvent) => void;
  mode?: "panel" | "drawer" | "sheet";
}) {
  const groupId = useId();
  const [tab, setTab] = useState<"details" | "security">("details");
  const { reduceMotion } = useMotionSettings();
  useEffect(() => { setTab("details"); }, [item?.id]);
  if (!item) return null;

  return (
    <div
      className={cn(
        "glass inspector-surface flex h-full min-h-0 flex-col overflow-hidden overflow-x-hidden max-w-full box-border",
        mode === "panel" && "rounded-[28px]",
        mode === "drawer" && "h-full w-full rounded-[26px]",
        mode === "sheet" && "h-full w-full rounded-t-[28px]"
      )}
      style={{
        boxShadow: mode === "panel" ? undefined : "0 40px 100px rgba(5,8,24,.4), var(--inset-hi)",
        ...(mode === "sheet"
          ? {
              background: "color-mix(in srgb, var(--glass-solid) 94%, transparent)",
              backdropFilter: "blur(52px) saturate(150%)",
              WebkitBackdropFilter: "blur(52px) saturate(150%)",
              borderColor: "var(--border)",
            }
          : {}),
      }}
    >
      {mode === "sheet" && (
        <button
          className="sheet-drag-handle flex shrink-0 justify-center pb-2 pt-3"
          onPointerDown={onDragHandlePointerDown}
          onClick={onClose}
          aria-label="Drag down to close details"
          data-no-tactile="true"
        >
          <span className="h-1 w-9 rounded-full bg-[var(--text-faint)] opacity-40" />
        </button>
      )}
      <header className="flex shrink-0 items-center justify-between gap-2 px-3.5 pb-2 pt-3">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-md" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <Sparkle size={10} weight="fill" />
          </span>
          <SectionLabel className="tracking-[0.13em]">{t(lang, "details")}</SectionLabel>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip label={item.favorite ? "Remove favorite" : "Add favorite"}>
            <button className="inspector-icon" onClick={() => onFavorite(item)} aria-label={item.favorite ? "Remove favorite" : "Add favorite"} aria-pressed={item.favorite}>
              <Star size={14} weight={item.favorite ? "fill" : "regular"} style={{ color: item.favorite ? "var(--warning)" : undefined }} />
            </button>
          </Tooltip>
          <Tooltip label="Edit this item">
            <button
              onClick={() => onEdit(item)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-[var(--hover)] hover:text-main"
              aria-label="Edit this item"
            >
              <PencilSimple size={13} weight="duotone" />
            </button>
          </Tooltip>
          {onDelete && (
            <Tooltip label={t(lang, "delete")}>
              <button
                onClick={() => {
                  if (window.confirm(t(lang, "confirmDelete"))) {
                    onDelete(item);
                    onClose();
                  }
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                aria-label={t(lang, "delete")}
              >
                <Trash size={13} weight="duotone" />
              </button>
            </Tooltip>
          )}
          <Tooltip label="Vault security" up>
            <button
              onClick={() => onTool?.("security")}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-[var(--hover)] hover:text-main"
              aria-label="Open security center"
            >
              <ShieldCheck size={14} weight="duotone" />
            </button>
          </Tooltip>
          <span className="mx-0.5 h-3.5 w-px bg-[var(--border-soft)]" />
          <Tooltip label={`${t(lang, "close")} inspector`}>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-[var(--hover)] hover:text-main"
              aria-label="Close inspector"
            >
              <X size={14} weight="bold" />
            </button>
          </Tooltip>
        </div>
      </header>
      <LayoutGroup id={groupId}>
        <div className="inspector-tabs" role="tablist" aria-label="Item detail views">
          {(["details", "security"] as const).map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              aria-controls={`inspector-content-${groupId}`}
              tabIndex={tab === value ? 0 : -1}
              data-glass-option="true"
              onClick={() => setTab(value)}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === "Home" ? "details" : event.key === "End" ? "security" : value === "details" ? "security" : "details";
                setTab(next);
                const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
                tabs?.[next === "details" ? 0 : 1]?.focus();
              }}
            >
              {tab === value && <GlassSelection />}
              <span>{value === "details" ? t(lang, "details") : t(lang, "securityCenter")}</span>
            </button>
          ))}
        </div>
      </LayoutGroup>
      <div className="inspector-content overflow-x-hidden min-h-0 flex-1 flex flex-col max-w-full" id={`inspector-content-${groupId}`} role="tabpanel">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${item.id}-${tab}`}
            className="inspector-page overflow-x-hidden w-full min-w-0 max-w-full box-border flex-1 flex flex-col"
            initial={{ opacity: 0, x: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduceMotion ? 0 : -6 }}
            transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
          >
            {tab === "details" ? (
              <InspectorBody
                item={item}
                lang={lang}
                onNotify={onNotify}
                onTool={onTool}
                onInspectSecurity={() => setTab("security")}
                onRestorePassword={onRestorePassword}
              />
            ) : (
              <ItemSecurity item={item} onGenerate={() => onTool?.("generator")} onAuthenticator={() => onTool?.("authenticator")} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--border-soft)] px-3.5 py-2">
        <span className="flex items-center gap-1.5 text-[7.5px] text-faint">
          <LockSimple size={9} weight="duotone" style={{ color: "var(--success)" }} />
          {t(lang, "saved")}
        </span>
        <span className="font-mono text-[7px] text-faint">XCHACHA20 · ARGON2ID</span>
      </footer>
    </div>
  );
}

export { InspectorBody };
