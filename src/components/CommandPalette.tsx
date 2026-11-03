import {
  ArrowRight,
  ArrowsLeftRight,
  CaretRight,
  Command,
  FileText,
  Fingerprint,
  FirstAidKit,
  Globe,
  HandTap,
  Headphones,
  LockKey,
  MagnifyingGlass,
  Moon,
  Password,
  Plus,
  Scan,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useIsPresent } from "framer-motion";
import { brands, type Language, type Theme, type VaultItem } from "../lib/vault";
import type { ToolName } from "./Sidebar";
import { BrandMark, Kbd } from "./ui";
import { surfaceEntranceSpring, surfaceSpeedLabel, useDialogFocus } from "../lib/motion";
import { useMotionSettings } from "./Tactile";

type PaletteAction = {
  id: string;
  label: string;
  hint: string;
  group: "Actions" | "Appearance";
  icon: Icon;
  run: () => void;
};

export default function CommandPalette({
  items,
  lang,
  theme,
  onClose,
  onSelectItem,
  onTool,
  onTheme,
  onLanguage,
  feel,
  onToggleFeel,
  onLock,
}: {
  items: VaultItem[];
  lang: Language;
  theme: Theme;
  onClose: () => void;
  onSelectItem: (item: VaultItem) => void;
  onTool: (tool: ToolName) => void;
  onTheme: (theme: Theme) => void;
  onLanguage: (lang: Language) => void;
  feel: { press: boolean; haptics: boolean };
  onToggleFeel: (patch: { press: boolean; haptics: boolean }) => void;
  onLock: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isPresent = useIsPresent();
  const { reduceMotion } = useMotionSettings();
  useDialogFocus(dialogRef, onClose, isPresent);

  const actions = useMemo<PaletteAction[]>(
    () => [
      { id: "add", label: "Add a new vault item", hint: "Login · note · identity · payment", group: "Actions", icon: Plus, run: () => onTool("add") },
      { id: "generator", label: "Generate a strong password", hint: "On-device · never recorded", group: "Actions", icon: Password, run: () => onTool("generator") },
      { id: "authenticator", label: "Open authenticator", hint: "TOTP codes · 30s rotation", group: "Actions", icon: Fingerprint, run: () => onTool("authenticator") },
      { id: "ocr", label: "Snip & extract an image", hint: "On-device OCR", group: "Actions", icon: Scan, run: () => onTool("ocr") },
      { id: "csvImport", label: "Import passwords from CSV", hint: "Chrome · Bitwarden · LastPass · 100% offline", group: "Actions", icon: FileText, run: () => onTool("csvImport") },
      { id: "sync", label: "Pair a nearby device", hint: "Zero-server P2P sync", group: "Actions", icon: ArrowsLeftRight, run: () => onTool("sync") },
      { id: "security", label: "Run a security audit", hint: "Vault health and weak passwords", group: "Actions", icon: ShieldCheck, run: () => onTool("security") },
      { id: "emergency", label: "Create emergency kit", hint: "Printable recovery document", group: "Actions", icon: FirstAidKit, run: () => onTool("emergency") },
      { id: "lock", label: "Panic lock the vault", hint: "⌘ / Ctrl L · purges memory keys", group: "Actions", icon: LockKey, run: onLock },
      { id: "light", label: "Liquid glass · Light", hint: "Peach, lavender & sky", group: "Appearance", icon: Sun, run: () => onTheme("light") },
      { id: "dark", label: "Liquid glass · Dark", hint: "Obsidian & indigo", group: "Appearance", icon: Moon, run: () => onTheme("dark") },
      { id: "lofi", label: "Cozy lofi zen", hint: "Sunset amber & violet · Ctrl Shift D", group: "Appearance", icon: Headphones, run: () => onTheme("lofi") },
      { id: "press", label: `Springy press physics · ${feel.press ? "On" : "Off"}`, hint: "Tactile ripple & compress on every tap", group: "Appearance", icon: HandTap, run: () => onToggleFeel({ ...feel, press: !feel.press }) },
      { id: "haptics", label: `Haptic feedback · ${feel.haptics ? "On" : "Off"}`, hint: "Gentle vibration on supported devices", group: "Appearance", icon: SlidersHorizontal, run: () => onToggleFeel({ ...feel, haptics: !feel.haptics }) },
      { id: "language", label: lang === "en" ? "বাংলায় দেখুন" : "Switch to English", hint: "Language · Hind Siliguri", group: "Appearance", icon: Globe, run: () => onLanguage(lang === "en" ? "bn" : "en") },
    ],
    [feel, lang, onLanguage, onLock, onTheme, onToggleFeel, onTool],
  );

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items.filter((item) => item.favorite).slice(0, 4);
    const needle = query.toLowerCase();
    return items.filter((item) =>
      [item.title, item.username, item.category, brands[item.brand].name, item.url, ...(item.tags ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    ).slice(0, 6);
  }, [items, query]);

  const filteredActions = useMemo(() => {
    if (!query.trim()) return actions.slice(0, 5);
    const needle = query.toLowerCase();
    return actions.filter((action) => `${action.label} ${action.hint} ${action.group}`.toLowerCase().includes(needle)).slice(0, 5);
  }, [actions, query]);

  const entries = useMemo(
    () => [
      ...filteredItems.map((item) => ({ type: "item" as const, id: item.id })),
      ...filteredActions.map((action) => ({ type: "action" as const, id: action.id })),
    ],
    [filteredItems, filteredActions],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const activate = (index: number) => {
    const entry = entries[index];
    if (!entry) return;
    if (entry.type === "item") {
      const item = filteredItems.find((candidate) => candidate.id === entry.id);
      if (item) {
        onSelectItem(item);
        onClose();
      }
    } else {
      filteredActions.find((candidate) => candidate.id === entry.id)?.run();
      onClose();
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isPresent) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => (entries.length ? (current + 1) % entries.length : 0));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => (entries.length ? (current - 1 + entries.length) % entries.length : 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        activate(activeIndex);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return createPortal(
    <motion.div
      ref={dialogRef}
      tabIndex={-1}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
      className="fixed inset-0 z-[120] flex items-start justify-center bg-[#070914]/40 px-3 pt-[8vh] backdrop-blur-[12px] sm:px-4 sm:pt-[12vh]"
      style={{ pointerEvents: isPresent ? "auto" : "none" }}
      onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="VaultZero command palette"
    >
      <motion.div
        data-elastic="palette"
        data-surface-speed={surfaceSpeedLabel()}
        initial={{ y: reduceMotion ? 0 : -12, scale: reduceMotion ? 1 : 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: reduceMotion ? 0 : -8, scale: reduceMotion ? 1 : 0.98, transition: reduceMotion ? { duration: 0 } : surfaceEntranceSpring(false, "close") }}
        /*
         * UX / "Living Flow" (V-58): the palette inherits the opening
         * gesture's speed. Keyboard-opened palettes settle gently, a quick
         * tap/command arrives with more momentum and a visible overshoot.
         */
        transition={reduceMotion ? { duration: 0 } : surfaceEntranceSpring(false, "open")}
        className="glass-strong modal-surface flex max-h-[76dvh] w-full max-w-[600px] flex-col overflow-hidden rounded-[24px]"
        style={{ boxShadow: "0 44px 110px rgba(5,8,25,.42), var(--inset-hi)" }}
      >
        <div className="flex h-[54px] shrink-0 items-center gap-2.5 border-b border-[var(--border-soft)] px-4">
          <MagnifyingGlass size={17} weight="duotone" className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            data-autofocus="true"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search vault, tools, themes…"
            className="min-w-0 flex-1 bg-transparent text-[12px] font-medium text-main outline-none placeholder:text-faint"
            aria-label="Command palette search"
          />
          {query ? (
            <button onClick={() => setQuery("")} className="text-faint hover:text-main" aria-label="Clear command search"><X size={13} /></button>
          ) : (
            <span className="flex items-center gap-1"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
          )}
        </div>

        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
          {filteredItems.length > 0 && (
            <div className="mb-1">
              <div className="flex items-center justify-between px-2 pb-1 pt-1.5">
                <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-faint">{query ? "Vault items" : "Favorites · quick access"}</p>
                <span className="font-mono text-[7px] text-faint">{filteredItems.length}</span>
              </div>
              {filteredItems.map((item) => {
                const index = entries.findIndex((entry) => entry.type === "item" && entry.id === item.id);
                const active = activeIndex === index;
                return (
                  <button
                    key={item.id}
                    onMouseEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                    onClick={() => activate(index)}
                    className="flex w-full items-center gap-2.5 rounded-[11px] px-2 py-2 text-left transition-colors"
                    style={{ background: active ? "var(--hover-strong)" : "transparent" }}
                  >
                    <BrandMark brand={item.brand} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10.5px] font-semibold text-main">{item.title}</p>
                      <p className="truncate text-[8px] text-faint">{item.username} · {brands[item.brand].name}</p>
                    </div>
                    <span className="rounded-full border border-[var(--border-soft)] px-1.5 py-0.5 text-[6.5px] uppercase tracking-[0.06em] text-faint">{item.category}</span>
                    <CaretRight size={10} className={active ? "text-accent" : "text-faint"} />
                  </button>
                );
              })}
            </div>
          )}

          {filteredActions.length > 0 && (
            <div>
              <p className="px-2 pb-1 pt-2 text-[8px] font-bold uppercase tracking-[0.13em] text-faint">{query ? "Matching commands" : "Commands"}</p>
              {filteredActions.map((action) => {
                const index = entries.findIndex((entry) => entry.type === "action" && entry.id === action.id);
                const active = activeIndex === index;
                const ActionIcon = action.icon;
                return (
                  <button
                    key={action.id}
                    onMouseEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                    onClick={() => activate(index)}
                    className="flex w-full items-center gap-2.5 rounded-[11px] px-2 py-2 text-left transition-colors"
                    style={{ background: active ? "var(--hover-strong)" : "transparent" }}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border"
                      style={{ borderColor: "var(--border-soft)", background: active ? "var(--accent-soft)" : "var(--glass-soft)", color: active ? "var(--accent)" : "var(--text-muted)" }}
                    >
                      <ActionIcon size={14} weight="duotone" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10.5px] font-semibold text-main">{action.label}</p>
                      <p className="truncate text-[8px] text-faint">{action.hint}</p>
                    </div>
                    <span className="hidden text-[7px] text-faint sm:inline">{action.group}</span>
                    <ArrowRight size={10} className={active ? "text-accent" : "text-faint"} />
                  </button>
                );
              })}
            </div>
          )}

          {entries.length === 0 && (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-[15px] border border-[var(--border-soft)] bg-[var(--glass-soft)] text-faint"><MagnifyingGlass size={22} weight="duotone" /></span>
              <p className="mt-3 font-display text-[15px] font-semibold text-main">Nothing matches</p>
              <p className="mt-1 max-w-[260px] text-[9px] leading-relaxed text-faint">Try a website, username, tool or theme name. Search stays entirely on this device.</p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--border-soft)] px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-[7.5px] text-faint"><Command size={10} weight="duotone" /> Command menu · {theme === "lofi" ? "Zen" : theme}</span>
          <div className="flex items-center gap-2 text-[7px] text-faint">
            <span className="flex items-center gap-0.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
            <span className="flex items-center gap-0.5"><Kbd>↵</Kbd> open</span>
            <span className="flex items-center gap-0.5"><Kbd>esc</Kbd> close</span>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
