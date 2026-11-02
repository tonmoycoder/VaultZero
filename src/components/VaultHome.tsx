import {
  ArrowRight,
  ArrowSquareOut,
  CaretDown,
  CaretRight,
  Check,
  CheckCircle,
  DownloadSimple,
  FolderSimple,
  Globe,
  Headphones,
  LockSimple,
  MagnifyingGlass,
  Moon,
  PencilSimple,
  Plus,
  Scan,
  Sparkle,
  Star,
  Sun,
  Trash,
  User,
  X,
} from "@phosphor-icons/react";
import { IconShieldCheck } from "@tabler/icons-react";
import { useEffect, useId, useMemo, useRef, useState, memo } from "react";
import { useVirtualList } from "../lib/useVirtualList";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  brands,
  strengthMeta,
  t,
  type BrandKey,
  type Language,
  type Theme,
  type VaultItem,
} from "../lib/vault";
import { cn } from "../utils/cn";
import { sanitizeVaultUrl } from "../lib/url";
import { BrandMark, CopyButton, Logo, SectionLabel, Tooltip, useCountdown, TotpRing } from "./ui";
import LofiPlayer from "./LofiPlayer";
import TextSizeControl from "./TextSize";
import BrandFilters from "./BrandFilters";
import GlassSelection from "./GlassSelection";
import { useMotionSettings } from "./Tactile";
import { colorOsBouncySpring, softSpring } from "../lib/motion";

const themeOptions: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Liquid glass · Light", icon: Sun },
  { id: "dark", label: "Liquid glass · Dark", icon: Moon },
  { id: "lofi", label: "Cozy lofi zen", icon: Headphones },
];

export function ThemeSwitcher({
  theme,
  onChange,
  compact = false,
}: {
  theme: Theme;
  onChange: (theme: Theme) => void;
  compact?: boolean;
}) {
  const id = useId();
  const [hovered, setHovered] = useState<Theme | null>(null);
  return (
    <LayoutGroup id={id}>
      <div
        className="theme-control flex shrink-0 items-center rounded-full border p-[3px]"
        style={{
          borderColor: "var(--border)",
          background: "var(--glass-soft)",
          boxShadow: "var(--inset-hi)",
        }}
        role="group"
        aria-label="Choose color theme"
        onPointerLeave={() => setHovered(null)}
      >
        {themeOptions.map((option) => {
          const ThemeIcon = option.icon;
          const active = theme === option.id;
          return (
            <Tooltip key={option.id} label={option.label}>
              <button
                onClick={() => onChange(option.id)}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") setHovered(option.id);
                }}
                onFocus={() => setHovered(option.id)}
                onBlur={() => setHovered(null)}
                data-glass-option="true"
                className={cn(
                  "relative flex items-center justify-center rounded-full",
                  compact ? "h-7 w-8" : "h-[29px] w-[36px]"
                )}
                style={{
                  color: active ? "var(--text-main)" : "var(--text-faint)",
                }}
                aria-pressed={active}
                aria-label={option.label}
              >
                {active && <GlassSelection id="theme-active" />}
                {hovered === option.id && !active && <GlassSelection id="theme-hover" hover />}
                <ThemeIcon size={compact ? 14 : 15} weight={active ? "fill" : "regular"} />
              </button>
            </Tooltip>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

function LanguageSwitcher({
  lang,
  onChange,
  compact,
}: {
  lang: Language;
  onChange: (lang: Language) => void;
  compact?: boolean;
}) {
  return (
    <Tooltip label={lang === "en" ? "ভাষা পরিবর্তন করুন" : "Switch to English"}>
      <button
        onClick={() => onChange(lang === "en" ? "bn" : "en")}
        className={cn(
          "secondary-button flex h-[29px] shrink-0 items-center gap-1.5 rounded-full font-semibold sm:h-[31px]",
          compact ? "px-2 text-[9px]" : "px-2.5 text-[9.5px]"
        )}
        aria-label="Switch language"
      >
        <Globe size={compact ? 12 : 13} weight="duotone" className="text-muted" />
        <span className={lang === "bn" ? "font-bangla" : ""}>{lang === "en" ? "EN" : "বাংলা"}</span>
        {!compact && (
          <>
            <span className="mx-0.5 h-2.5 w-px bg-[var(--border-ink)]" />
            <span className={cn("text-faint", lang === "en" && "font-bangla")}>
              {lang === "en" ? "বাংলা" : "EN"}
            </span>
          </>
        )}
      </button>
    </Tooltip>
  );
}

function SecurityHealth({
  items,
  lang,
  onOpen,
}: {
  items: VaultItem[];
  lang: Language;
  onOpen: () => void;
}) {
  const strongCount = items.filter((i) => i.strength === "strong").length;
  const fairCount = items.filter((i) => i.strength === "fair").length;
  const weakCount = items.filter((i) => i.strength === "weak").length;
  const health = items.length
    ? Math.round(((strongCount + fairCount * 0.65 + weakCount * 0.2) / Math.max(items.length, 1)) * 100)
    : 100;
  const sorted = [...items].sort((a, b) => a.score - b.score);

  return (
    <button
      onClick={onOpen}
      className="glass-soft group relative w-full shrink-0 overflow-hidden rounded-[16px] px-3 py-2.5 text-left transition-all hover:border-[var(--border)] sm:px-4 sm:py-3"
      aria-label="Open security center"
    >
      <div className="flex items-center gap-3">
        <span
          className="relative hidden h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border sm:flex"
          style={{
            color: "var(--success)",
            background: "var(--success-soft)",
            borderColor: "color-mix(in srgb, var(--success) 18%, transparent)",
          }}
        >
          <IconShieldCheck size={18} stroke={1.7} />
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full border border-[var(--glass-strong)] bg-[var(--success)]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.11em] text-faint">
              {t(lang, "vaultHealth")}
            </span>
            <span className="font-display text-[12px] font-semibold leading-none text-main">
              {health}%
            </span>
            <span
              className="rounded-full px-1.5 py-[2px] text-[7.5px] font-bold uppercase tracking-[0.06em]"
              style={{
                color: health >= 80 ? "var(--success)" : "var(--warning)",
                background: health >= 80 ? "var(--success-soft)" : "var(--warning-soft)",
              }}
            >
              {health >= 80 ? t(lang, "healthy") : t(lang, "toReview")}
            </span>
            <CaretRight size={10} className="ml-auto text-faint transition-transform group-hover:translate-x-0.5" />
          </div>
          <div className="flex items-center gap-[5px]">
            <div className="flex min-w-0 flex-1 gap-[3px]">
              {sorted.length > 0 ? (
                sorted.map((item) => (
                  <span
                    key={item.id}
                    className="h-[5px] min-w-0 flex-1 rounded-full"
                    style={{
                      background: strengthMeta[item.strength].color,
                      opacity: item.strength === "strong" ? 0.9 : 1,
                      boxShadow:
                        item.strength === "weak"
                          ? "0 0 7px color-mix(in srgb, var(--danger) 50%, transparent)"
                          : "none",
                    }}
                  />
                ))
              ) : (
                <span className="h-[5px] flex-1 rounded-full bg-[var(--success-soft)]" />
              )}
            </div>
            <span className="shrink-0 font-mono text-[7px] text-faint">{items.length} scanned</span>
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-3 border-l border-[var(--border-soft)] pl-3 md:flex">
          {[
            { count: strongCount, label: t(lang, "strong"), color: "var(--success)" },
            { count: fairCount, label: t(lang, "toReview"), color: "var(--warning)" },
            { count: weakCount, label: t(lang, "weak"), color: "var(--danger)" },
          ].map((metric) => (
            <div key={metric.label} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: metric.color }} />
              <span className="font-mono text-[9px] font-semibold tabular-nums text-main">
                {metric.count}
              </span>
              <span className="hidden text-[8px] leading-none text-faint lg:inline">{metric.label}</span>
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}

/**
 * A TOTP ring that re-renders on its own.
 *
 * PERFORMANCE: the ring used to call `useCountdown()` inside the card, so
 * every card that had two-factor enabled re-rendered **once per second**,
 * together with its title, username and strength row.
 *
 * The countdown state now lives inside this `memo`ised component, so the
 * second-by-second update only re-renders the small SVG and never the card.
 * The vault list itself stays completely still.
 */
const LocalTotpRing = memo(function LocalTotpRing({
  size = 22,
  stroke = 2,
}: {
  size?: number;
  stroke?: number;
}) {
  const { remaining, progress } = useCountdown();
  return <TotpRing size={size} remaining={remaining} progress={progress} stroke={stroke} />;
});

const ItemCard = memo(function ItemCard({
  item,
  featured,
  selected,
  checked,
  onSelect,
  onToggleCheck,
  onFavorite,
  onEdit,
  onDelete,
  onNotify,
  lang,
}: {
  item: VaultItem;
  featured?: boolean;
  selected: boolean;
  checked: boolean;
  onSelect: () => void;
  onToggleCheck: () => void;
  onFavorite: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onNotify: (message: string) => void;
  lang: Language;
}) {
  const brand = brands[item.brand];
  const strength = strengthMeta[item.strength];

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      transition={colorOsBouncySpring}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect();
        }
      }}
      onPointerMove={(e) => {
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        el.style.setProperty("--my", `${e.clientY - rect.top}px`);
      }}
      className={cn(
        "vault-card group relative flex cursor-pointer flex-col rounded-[16px] p-3.5 text-left transition-colors hover:z-20",
        featured && "sm:min-h-[146px]",
        selected && "selected",
        checked && "ring-2 ring-[var(--accent)]"
      )}
      style={{
        background: `linear-gradient(145deg, ${brand.tint} 0%, var(--glass-strong) 62%, var(--glass) 100%)`,
        minHeight: featured ? 146 : 152,
      }}
      aria-label={`${item.title}, ${item.category}`}
      aria-expanded={selected}
      data-item-id={item.id}
    >
      <span aria-hidden className="card-spotlight" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full opacity-[0.15] blur-2xl transition-opacity duration-300 group-hover:opacity-30"
        style={{ background: brand.hex }}
      />

      {/* Top Header: Multi-select Checkbox + Brand Info + Quick Action Buttons */}
      <div className="relative z-10 flex items-start justify-between gap-1.5">
        <div className="flex items-center gap-2">
          {/* Checkbox */}
          <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCheck();
            }}
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-all",
              checked
                ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-sm"
                : "border-[var(--border)] bg-[var(--glass-soft)] opacity-0 group-hover:opacity-100"
            )}
            title={checked ? "Deselect" : "Select"}
            aria-label={`Select ${item.title}`}
          >
            {checked && <Check size={10} weight="bold" />}
          </button>

          <BrandMark brand={item.brand} size={featured ? 37 : 34} url={item.url} title={item.title} />
          <div>
            <p className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.1em] text-faint">
              {lang === "bn"
                ? item.category === "payment"
                  ? "পেমেন্ট"
                  : item.category === "note"
                  ? "সিকিউর নোট"
                  : item.category === "identity"
                  ? "পরিচয়"
                  : "লগইন"
                : item.category === "payment"
                ? "Payment"
                : item.category === "note"
                ? "Secure note"
                : item.category === "identity"
                ? "Identity"
                : "Login"}
              {item.strength === "weak" && (
                <span className="h-1 w-1 rounded-full" style={{ background: "var(--danger)" }} />
              )}
            </p>
            <p className="mt-0.5 text-[8px] text-muted">{item.modified}</p>
          </div>
        </div>

        {/* Hover Quick Action Buttons (LastPass Style) */}
        <div className="flex items-center gap-0.5">
          {/* Launch Website */}
          <Tooltip label={t(lang, "launchWebsite")}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                // SECURITY: sanitise before opening. A `javascript:` or
                // `data:` URL stored in an imported entry must never be
                // handed to `window.open`.
                const url = sanitizeVaultUrl(item.url);
                if (url) window.open(url, "_blank", "noopener,noreferrer");
                else onNotify(
                  item.url
                    ? "That link uses an unsupported address and was blocked"
                    : "No website URL attached"
                );
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full text-faint transition-colors hover:bg-[var(--hover-strong)] hover:text-main"
              aria-label="Launch website"
            >
              <ArrowSquareOut size={13} weight="duotone" />
            </button>
          </Tooltip>

          {/* Copy Username */}
          <Tooltip label={lang === "bn" ? "ইউজারনেম কপি" : "Copy username"}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(item.username);
                onNotify(lang === "bn" ? "ইউজারনেম কপি হয়েছে" : "Username copied");
              }}
              className="reveal-on-hover flex h-6 w-6 items-center justify-center rounded-full text-faint hover:bg-[var(--hover-strong)] hover:text-main"
              aria-label="Copy username"
            >
              <User size={13} weight="duotone" />
            </button>
          </Tooltip>

          {/* Edit */}
          {onEdit && (
            <Tooltip label={t(lang, "edit")}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="reveal-on-hover flex h-6 w-6 items-center justify-center rounded-full text-faint hover:bg-[var(--hover-strong)] hover:text-main"
                aria-label="Edit item"
              >
                <PencilSimple size={13} weight="duotone" />
              </button>
            </Tooltip>
          )}

          {/* Delete */}
          {onDelete && (
            <Tooltip label={t(lang, "delete")}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="reveal-on-hover flex h-6 w-6 items-center justify-center rounded-full text-faint hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                aria-label="Delete item"
              >
                <Trash size={13} weight="duotone" />
              </button>
            </Tooltip>
          )}

          {/* Favorite */}
          <Tooltip label={item.favorite ? "Remove favorite" : "Add favorite"}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFavorite();
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-[var(--hover-strong)]"
              style={{ color: item.favorite ? "var(--warning)" : "var(--text-faint)" }}
              aria-label={item.favorite ? "Remove favorite" : "Add favorite"}
              aria-pressed={item.favorite}
            >
              <Star size={13} weight={item.favorite ? "fill" : "regular"} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/*
        Main Body.

        UX: the featured card laid its two halves out with `sm:flex
        sm:items-end`, so the title block and the 2FA panel were
        bottom-aligned. The 2FA panel is a tall block (a label row, a big
        six-digit code, and a footnote), so bottom-aligning pushed the title
        and the password row up against the panel and left the password
        row's strength label ("Strong") and its dot visually colliding with
        the panel's rounded corner.

        `sm:items-start` keeps both halves anchored to the top, which is
        where the eye starts, and the password row keeps its own space.
      */}
      <div className={cn("relative z-10 mt-auto pt-3", featured && "sm:flex sm:items-start sm:gap-4")}>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3
                className={cn(
                  "truncate font-display font-semibold tracking-[-0.015em] text-main",
                  featured ? "text-[16px]" : "text-[14px] sm:text-[14.5px]"
                )}
              >
                {item.title}
              </h3>
              <p className="mt-0.5 max-w-[220px] truncate text-[9.5px] text-muted">{item.username}</p>
            </div>
            {item.totp && !featured && (
              <span className="hidden items-center gap-1 sm:flex">
                <LocalTotpRing size={22} stroke={2} />
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <LockSimple size={10} weight="duotone" className="text-faint" />
              <span className="truncate font-mono text-[9px] tracking-[0.09em] text-muted">
                {featured ? "••••••••••••" : "••••••••••"}
              </span>
              <CopyButton value={item.password} label="Password" onCopied={onNotify} />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/*
                The strength dot is `inline-block` with a matching line
                height so it sits on the text baseline instead of floating
                above it. `gap-1` plus `leading-none` used to let the dot
                overlap the first letter of the label.
              */}
              <span className="flex items-center gap-1 leading-none">
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full align-middle"
                  style={{ background: strength.color }}
                  aria-hidden="true"
                />
                <span className="hidden whitespace-nowrap text-[8px] font-medium sm:inline" style={{ color: strength.color }}>
                  {t(lang, strength.labelKey)}
                </span>
              </span>
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--glass-soft)] text-faint transition-all group-hover:border-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white">
                <ArrowRight size={10} weight="bold" />
              </span>
            </div>
          </div>
        </div>

        {featured && (
          <div
            className="relative hidden w-[178px] shrink-0 overflow-hidden rounded-[12px] border p-2.5 sm:block"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 18%, var(--border-soft))",
              background: "linear-gradient(140deg, var(--accent-soft), var(--glass-soft))",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[7px] font-bold uppercase tracking-[0.12em] text-faint">Two-factor</span>
              <span
                className="flex items-center gap-1 text-[6.5px] font-bold uppercase tracking-[0.06em]"
                style={{ color: "var(--success)" }}
              >
                <span className="h-1 w-1 rounded-full bg-current" /> Active
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <LocalTotpRing size={27} stroke={2.2} />
              <span className="font-mono text-[14px] font-semibold tracking-[0.09em] text-main">
                {item.totp ?? "— — —"}
              </span>
            </div>
            <p className="mt-2 flex items-center gap-1 border-t border-[var(--border-soft)] pt-1.5 text-[7px] text-muted">
              <Sparkle size={8} weight="fill" style={{ color: "var(--accent)" }} /> Local-only · no server
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
});

function EmptyVault({
  lang,
  folder,
  query,
  onAdd,
}: {
  lang: Language;
  folder: string | null;
  query: string;
  onAdd: () => void;
}) {
  return (
    <div className="glass-soft animate-rise relative flex min-h-[330px] flex-col items-center justify-center overflow-hidden rounded-[22px] border-dashed px-6 py-10 text-center">
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--orb-2)" }}
      />
      <div className="relative mb-5 h-[102px] w-[120px]">
        <span
          className="absolute bottom-2 left-1/2 h-[80px] w-[98px] -translate-x-1/2 rounded-[22px] border"
          style={{
            borderColor: "var(--border)",
            background: "linear-gradient(145deg, rgba(255,255,255,.36), rgba(255,255,255,.12))",
            boxShadow: "0 18px 30px rgba(40,30,70,.08)",
            transform: "translateX(-50%) rotate(-7deg)",
          }}
        />
        <span
          className="absolute bottom-1 left-1/2 flex h-[84px] w-[96px] -translate-x-1/2 items-center justify-center rounded-[22px] border"
          style={{
            borderColor: "var(--border)",
            background: "linear-gradient(145deg, var(--glass-strong), var(--glass))",
            boxShadow: "0 18px 30px rgba(40,30,70,.12), var(--inset-hi)",
            transform: "translateX(-48%) rotate(3deg)",
          }}
        >
          <FolderSimple size={44} weight="duotone" style={{ color: "var(--accent)" }} />
        </span>
        <span
          className="absolute right-0 top-0 flex h-[42px] w-[42px] items-center justify-center rounded-[13px] border border-white/40 text-white"
          style={{
            background: "linear-gradient(145deg, var(--accent), var(--accent-deep))",
            boxShadow: "0 12px 24px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.4)",
            transform: "rotate(8deg)",
          }}
        >
          <LockSimple size={20} weight="duotone" />
        </span>
        <Sparkle size={18} weight="fill" className="absolute -left-2 top-8 text-[var(--accent)] opacity-70" />
        <Sparkle size={11} weight="fill" className="absolute -right-1 bottom-5 text-[var(--warning)] opacity-80" />
      </div>
      <h3 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-main">
        {query ? t(lang, "noResults") : folder ? t(lang, "emptyFolder") : t(lang, "emptyVault")}
      </h3>
      <p className="mt-1.5 max-w-[320px] text-balance text-[10.5px] leading-relaxed text-muted">
        {query
          ? t(lang, "noResultsCopy")
          : folder
          ? t(lang, "emptyFolderCopy")
          : t(lang, "emptyVaultCopy")}
      </p>
      <button
        onClick={onAdd}
        className="primary-button mt-5 inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[10.5px] font-semibold"
      >
        <Plus size={13} weight="bold" />
        {folder && !query ? t(lang, "addFirstItem") : t(lang, "addItem")}
      </button>
    </div>
  );
}

// Floating Bulk Actions Toolbar (Apple Glass style)
function FloatingBulkBar({
  count,
  lang,
  onDelete,
  onFavorite,
  onMove,
  onExport,
  onClear,
}: {
  count: number;
  lang: Language;
  onDelete: () => void;
  onFavorite: () => void;
  onMove?: () => void;
  onExport: () => void;
  onClear: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="glass-strong fixed bottom-8 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 shadow-2xl"
      style={{
        background: "color-mix(in srgb, var(--glass-solid) 92%, transparent)",
        boxShadow: "0 20px 45px rgba(0,0,0,0.28), var(--inset-hi)",
      }}
    >
      <span className="flex items-center gap-1.5 font-display text-[11px] font-semibold text-main">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-[9px] text-white">
          {count}
        </span>
        {t(lang, "bulkSelected")}
      </span>
      <div className="mx-1 h-4 w-px bg-[var(--border)]" />
      <button
        type="button"
        onClick={onFavorite}
        className="secondary-button flex h-7 items-center gap-1 rounded-full px-2.5 text-[9.5px] font-medium"
      >
        <Star size={12} weight="fill" className="text-warning" />
        {t(lang, "toggleFavorite")}
      </button>
      {onMove && (
        <button
          type="button"
          onClick={onMove}
          className="secondary-button flex h-7 items-center gap-1 rounded-full px-2.5 text-[9.5px] font-medium"
        >
          <FolderSimple size={12} weight="duotone" />
          {t(lang, "moveToFolder")}
        </button>
      )}
      <button
        type="button"
        onClick={onExport}
        className="secondary-button flex h-7 items-center gap-1 rounded-full px-2.5 text-[9.5px] font-medium"
      >
        <DownloadSimple size={12} weight="bold" />
        {t(lang, "exportSelected")}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex h-7 items-center gap-1 rounded-full bg-[var(--danger-soft)] px-2.5 text-[9.5px] font-semibold text-[var(--danger)] transition-all hover:opacity-90"
      >
        <Trash size={12} weight="duotone" />
        {t(lang, "deleteSelected")}
      </button>
      <button
        type="button"
        onClick={onClear}
        className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-faint hover:text-main"
        title="Deselect all"
        aria-label="Deselect all"
      >
        <X size={12} />
      </button>
    </motion.div>
  );
}

export type SortMode = "recent" | "name" | "folder" | "strength";

export default function VaultHome({
  lang,
  theme,
  active,
  folder,
  items,
  allItems,
  query,
  brandFilter,
  selectedId,
  onTheme,
  onLanguage,
  onQuery,
  onBrandFilter,
  onSelect,
  onTool,
  onAdd,
  onEdit,
  onDelete,
  onBulkDelete,
  onBulkFavorite,
  onBulkMove,
  onExport,
  onNotify,
  onFavorite,
  textStep,
  onTextStep,
  onOpenProfile,
}: {
  lang: Language;
  theme: Theme;
  active: string;
  folder: string | null;
  items: VaultItem[];
  allItems: VaultItem[];
  query: string;
  brandFilter: BrandKey | "all";
  selectedId: string | null;
  onTheme: (theme: Theme) => void;
  onLanguage: (lang: Language) => void;
  onQuery: (value: string) => void;
  onBrandFilter: (brand: BrandKey | "all") => void;
  onSelect: (item: VaultItem) => void;
  onTool: (tool: "generator" | "authenticator" | "security" | "sync" | "emergency" | "ocr" | "add") => void;
  onAdd: () => void;
  onEdit?: (item: VaultItem) => void;
  onDelete?: (item: VaultItem) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkFavorite?: (ids: string[]) => void;
  onBulkMove?: (ids: string[], folder: string) => void;
  onExport?: (ids: string[]) => void;
  onNotify: (message: string) => void;
  onFavorite: (item: VaultItem) => void;
  textStep: number;
  onTextStep: (index: number) => void;
  onOpenProfile?: () => void;
}) {
  const [userName, setUserName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("vaultzero_username") || "";
    }
    return "";
  });

  useEffect(() => {
    const handleProfileUpdate = () => {
      if (typeof window !== "undefined") {
        setUserName(localStorage.getItem("vaultzero_username") || "");
      }
    };
    window.addEventListener("vaultzero_profile_updated", handleProfileUpdate);
    return () => window.removeEventListener("vaultzero_profile_updated", handleProfileUpdate);
  }, []);

  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  const { reduceMotion } = useMotionSettings();

  const handleToggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (checkedIds.size === items.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(items.map((i) => i.id)));
    }
  };

  const toggleCollapseFolder = (f: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };

  const sortedItems = useMemo(() => {
    const list = [...items];
    if (sortMode === "name") {
      return list.sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sortMode === "strength") {
      return list.sort((a, b) => b.score - a.score);
    }
    if (sortMode === "folder") {
      return list.sort((a, b) => (a.folder || "Unfiled").localeCompare(b.folder || "Unfiled"));
    }
    return list;
  }, [items, sortMode]);

  // PERFORMANCE (V-37): windowing for very large vaults.
  //
  // Below the threshold the bento grid is kept — it is the nicer experience
  // and the cost is negligible for a realistic vault. Above it, only the
  // rows near the viewport are rendered.
  const VIRTUALIZE_THRESHOLD = 150;
  const VIRTUAL_ROW_ESTIMATE = 132; // px, the average card height
  const virtualizationActive = sortedItems.length > VIRTUALIZE_THRESHOLD;

  const { ref: virtualListRef, window: virtualWindow } = useVirtualList(
    sortedItems.length,
    VIRTUAL_ROW_ESTIMATE
  );

  const visibleItems = useMemo(() => {
    if (!virtualizationActive) return sortedItems;
    return sortedItems.slice(virtualWindow.startIndex, virtualWindow.endIndex);
  }, [sortedItems, virtualizationActive, virtualWindow.startIndex, virtualWindow.endIndex]);


  // Grouped by folder if sortMode is "folder"
  const folderGroups = useMemo(() => {
    if (sortMode !== "folder") return null;
    const groups: Record<string, VaultItem[]> = {};
    for (const item of sortedItems) {
      const f = item.folder || "Unfiled";
      if (!groups[f]) groups[f] = [];
      groups[f].push(item);
    }
    return groups;
  }, [sortedItems, sortMode]);

  const titleMap: Record<string, Parameters<typeof t>[1]> = {
    all: "allItems",
    favorites: "favoritesTitle",
    logins: "logins",
    notes: "secureNotes",
    identities: "identities",
    payments: "payments",
  };
  const heading = folder ? folder : t(lang, titleMap[active] ?? "allItems");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.activeElement === searchRef.current) {
        onQuery("");
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onQuery]);

  return (
    <div className="relative flex min-h-0 flex-col overflow-x-hidden lg:h-full px-3 sm:px-4">
      {/* Mobile-only brand header */}
      <div className="mb-3 flex items-center justify-between gap-2 lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <Logo size={31} />
          <div className="min-w-0">
            <p className="truncate font-display text-[14px] font-semibold leading-none tracking-[-0.03em] text-main">
              VaultZero
            </p>
            <p className="mt-1 flex items-center gap-1 whitespace-nowrap text-[6.5px] font-bold uppercase tracking-[0.1em] text-faint">
              <LockSimple size={7} weight="fill" /> {t(lang, "offlineNote")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeSwitcher theme={theme} onChange={onTheme} compact />
          <LanguageSwitcher lang={lang} onChange={onLanguage} compact />
        </div>
      </div>
      <div className="mb-3 flex items-center justify-between gap-2 lg:hidden">
        <TextSizeControl index={textStep} onChange={onTextStep} compact />
        <LofiPlayer active={theme === "lofi"} onNotify={onNotify} compact />
      </div>

      {/* Greeting + desktop controls */}
      <div className="flex items-start justify-between gap-4 pb-4 pt-0.5">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-1.5">
            <span
              className="h-1 w-1 rounded-full"
              style={{ background: "var(--success)", boxShadow: "0 0 5px var(--success)" }}
            />
            <SectionLabel className="tracking-[0.16em]">
              {t(lang, "workspace")} · ZERO-KNOWLEDGE
            </SectionLabel>
          </div>
          <div className="flex items-center gap-2">
            <h1
              className={cn(
                "font-display text-[25px] font-semibold tracking-[-0.035em] text-main sm:text-[29px]",
                lang === "bn" && "font-bangla text-[23px] sm:text-[27px]"
              )}
            >
              {(() => {
                const name = userName.trim() || (lang === "bn" ? "ভল্ট ওনার" : "Vault Owner");
                return lang === "bn" ? `শুভ সকাল, ${name}।` : `Good morning, ${name}.`;
              })()}
            </h1>
            {onOpenProfile && (
              <button
                type="button"
                onClick={onOpenProfile}
                className="mt-1 flex h-6 w-6 items-center justify-center rounded-full text-muted transition-colors hover:bg-[var(--hover)] hover:text-accent"
                title={lang === "bn" ? "প্রোফাইল এডিট করুন" : "Edit Profile"}
                aria-label="Edit Profile"
              >
                <User size={14} weight="duotone" />
              </button>
            )}
          </div>
          <p className={cn("mt-1 text-[10.5px] text-muted sm:text-[11px]", lang === "bn" && "font-bangla")}>
            {theme === "lofi" && lang === "en"
              ? "A quieter space for your digital life."
              : t(lang, "vaultSubtitle")}
          </p>
        </div>
        <div className="hidden shrink-0 flex-wrap items-center justify-end gap-1.5 pt-1 lg:flex">
          <LofiPlayer active={theme === "lofi"} onNotify={onNotify} compact />
          <TextSizeControl index={textStep} onChange={onTextStep} />
          <ThemeSwitcher theme={theme} onChange={onTheme} />
          <LanguageSwitcher lang={lang} onChange={onLanguage} />
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <div className="input-shell flex h-[40px] min-w-0 flex-1 items-center gap-2.5 rounded-[13px] px-3">
          <MagnifyingGlass size={16} weight="duotone" className="shrink-0 text-muted" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={t(lang, "searchPlaceholder")}
            className={cn(
              "min-w-0 flex-1 bg-transparent text-[11.5px] font-medium text-main outline-none placeholder:text-faint",
              lang === "bn" && "font-bangla"
            )}
            aria-label={t(lang, "searchPlaceholder")}
          />
          {query && (
            <button
              onClick={() => onQuery("")}
              className="text-faint hover:text-main"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
          <span className="hidden items-center gap-0.5 sm:flex">
            <span className="kbd">⌘</span>
            <span className="kbd">K</span>
          </span>
        </div>
        <Tooltip label={t(lang, "scanImport")}>
          <button
            onClick={() => onTool("ocr")}
            className="secondary-button flex h-[40px] shrink-0 items-center gap-1.5 rounded-[13px] px-3 text-[10px] font-semibold lg:hidden"
            aria-label={t(lang, "scanImport")}
          >
            <Scan size={15} weight="duotone" />
          </button>
        </Tooltip>
      </div>

      {/* Security Health banner */}
      <div className="mb-3 shrink-0">
        <SecurityHealth items={allItems} lang={lang} onOpen={() => onTool("security")} />
      </div>

      {/* Brand Filters */}
      <BrandFilters items={allItems} active={brandFilter} onChange={onBrandFilter} lang={lang} />

      {/* Grid heading, select all, and sorting controls */}
      <div className="mb-2 flex shrink-0 items-center justify-between px-0.5">
        <div className="flex items-center gap-2.5">
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAll}
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-md border transition-all",
                checkedIds.size === items.length
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border)] bg-[var(--glass-soft)]"
              )}
              title={checkedIds.size === items.length ? "Deselect all" : "Select all"}
              aria-label="Select all items"
            >
              {checkedIds.size === items.length && <Check size={10} weight="bold" />}
            </button>
          )}
          <h2 className="font-display text-[13px] font-semibold tracking-[-0.01em] text-main">
            {heading}
          </h2>
          <span
            className="flex h-[17px] min-w-[20px] items-center justify-center rounded-full px-1.5 font-mono text-[8px] text-muted"
            style={{ background: "var(--glass-soft)", border: "1px solid var(--border-soft)" }}
          >
            {sortedItems.length}
          </span>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 text-[8px] text-faint">
          <div className="flex items-center gap-1 rounded-full border border-[var(--border-soft)] bg-[var(--glass-soft)] p-0.5">
            {(
              [
                { id: "recent", label: t(lang, "sortRecent") },
                { id: "name", label: t(lang, "sortAlphabetical") },
                { id: "folder", label: t(lang, "sortFolder") },
                { id: "strength", label: t(lang, "sortStrength") },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSortMode(s.id)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[7.5px] font-semibold transition-all",
                  sortMode === s.id
                    ? "bg-[var(--accent)] text-white shadow-xs"
                    : "text-muted hover:text-main"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <span className="hidden items-center gap-1 sm:flex">
            <LockSimple size={9} weight="duotone" />
            {t(lang, "offline")}
          </span>
        </div>
      </div>

      {/* Items Container */}
      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-visible pt-1.5 pb-16">
        {sortedItems.length === 0 ? (
          <EmptyVault lang={lang} folder={folder} query={query} onAdd={onAdd} />
        ) : folderGroups ? (
          // Grouped by Folder with collapsible headers
          <div className="space-y-5">
            {Object.entries(folderGroups).map(([folderName, folderItems]) => {
              const isCollapsed = collapsedFolders.has(folderName);
              return (
                <div key={folderName} className="space-y-2">
                  <button
                    type="button"
                    onClick={() => toggleCollapseFolder(folderName)}
                    className="flex w-full items-center gap-2 rounded-xl bg-[var(--glass-soft)] px-3 py-1.5 text-left transition-colors hover:bg-[var(--hover)]"
                  >
                    <FolderSimple size={14} weight="duotone" className="text-accent" />
                    <span className="font-display text-[12px] font-semibold text-main">
                      {folderName}
                    </span>
                    <span className="rounded-full bg-[var(--border-soft)] px-1.5 py-0.5 font-mono text-[7px] text-muted">
                      {folderItems.length}
                    </span>
                    <span className="ml-auto text-faint">
                      {isCollapsed ? <CaretRight size={12} /> : <CaretDown size={12} />}
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="vault-bento grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3 pt-2 pb-3 overflow-visible">
                      {folderItems.map((item) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          selected={selectedId === item.id}
                          checked={checkedIds.has(item.id)}
                          onSelect={() => onSelect(item)}
                          onToggleCheck={() => handleToggleCheck(item.id)}
                          onFavorite={() => onFavorite(item)}
                          onEdit={onEdit ? () => onEdit(item) : undefined}
                          onDelete={onDelete ? () => onDelete(item) : undefined}
                          onNotify={onNotify}
                          lang={lang}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // Standard Grid
          //
          // PERFORMANCE (V-37): the grid used to render one `ItemCard` per
          // entry with no upper bound, so a 10,000-entry vault created
          // 10,000 card subtrees and every keystroke in the search box
          // re-rendered all of them.
          //
          // Above {@link VIRTUALIZE_THRESHOLD} entries the grid is replaced
          // by a windowed single-column list that renders only the rows near
          // the viewport. Below the threshold the rich bento grid is kept,
          // because its multi-column layout is the nicer experience for the
          // vault sizes most people actually have.
          <div
            ref={virtualizationActive ? virtualListRef : undefined}
            className={cn(
              "pt-2 pb-3",
              virtualizationActive
                ? "thin-scrollbar overflow-y-auto"
                : "vault-bento grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3 overflow-visible"
            )}
            style={virtualizationActive ? { maxHeight: "70vh" } : undefined}
          >
            {virtualizationActive && virtualWindow.paddingTop > 0 && (
              <div style={{ height: virtualWindow.paddingTop }} aria-hidden="true" />
            )}
            <AnimatePresence initial={false} mode="popLayout">
              {visibleItems.map((item, index) => {
                const featured =
                  !virtualizationActive &&
                  active === "all" &&
                  !folder &&
                  !query &&
                  brandFilter === "all" &&
                  sortMode === "recent" &&
                  index === 0;
                return (
                  <motion.div
                    layout="position"
                    key={item.id}
                    className={cn("vault-card-slot", featured && "sm:col-span-2")}
                    initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.97 }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { ...softSpring, opacity: { duration: 0.18 } }
                    }
                  >
                    <ItemCard
                      item={item}
                      featured={featured}
                      selected={selectedId === item.id}
                      checked={checkedIds.has(item.id)}
                      onSelect={() => onSelect(item)}
                      onToggleCheck={() => handleToggleCheck(item.id)}
                      onFavorite={() => onFavorite(item)}
                      onEdit={onEdit ? () => onEdit(item) : undefined}
                      onDelete={onDelete ? () => onDelete(item) : undefined}
                      onNotify={onNotify}
                      lang={lang}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {virtualizationActive && virtualWindow.paddingBottom > 0 && (
              <div style={{ height: virtualWindow.paddingBottom }} aria-hidden="true" />
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-center gap-1.5 pb-2 text-[8px] text-faint">
          <CheckCircle size={11} weight="duotone" style={{ color: "var(--success)" }} />
          Zero-knowledge, end-to-end encrypted · nothing leaves this device
        </div>
      </div>

      {/* Floating Bulk Actions Bar */}
      <AnimatePresence>
        {checkedIds.size > 0 && (
          <FloatingBulkBar
            count={checkedIds.size}
            lang={lang}
            onDelete={() => {
              if (onBulkDelete) onBulkDelete(Array.from(checkedIds));
              setCheckedIds(new Set());
            }}
            onFavorite={() => {
              if (onBulkFavorite) onBulkFavorite(Array.from(checkedIds));
            }}
            onMove={() => {
              const target = window.prompt("Enter folder name:", "Work");
              if (target && onBulkMove) {
                onBulkMove(Array.from(checkedIds), target.trim());
                setCheckedIds(new Set());
              }
            }}
            onExport={() => {
              if (onExport) onExport(Array.from(checkedIds));
            }}
            onClear={() => setCheckedIds(new Set())}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
