import {
  ArrowsLeftRight,
  CheckCircle,
  Fingerprint,
  HandTap,
  House,
  LockKey,
  Plus,
  Sparkle,
  Star,
  ToggleLeft,
  Wrench,
  X,
} from "@phosphor-icons/react";
import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import CommandPalette from "./components/CommandPalette";
import InspectorHost from "./components/InspectorHost";
import GlassSelection from "./components/GlassSelection";
import AmbientScene from "./components/AmbientScene";
import LockScreen from "./components/LockScreen";
import TactileProvider, { hapticSuccess } from "./components/Tactile";
import Sidebar, { MobileQuickMenu, type ToolName } from "./components/Sidebar";
import { exportVaultToCsv } from "./lib/csv";
import { Avatar, Modal, Toggle, Tooltip } from "./components/ui";
import TextSizeControl, { DEFAULT_TEXT_STEP, TEXT_STEPS, getEffectiveScale, stepLabel } from "./components/TextSize";
import AutoLockControl from "./components/AutoLockControl";

import VaultHome from "./components/VaultHome";
import UpdateBanner from "./components/UpdateBanner";

// Lazy-loaded heavy tools & modals for sub-second startup (<1s)
const AddItemModal = lazy(() => import("./components/captureModals").then((m) => ({ default: m.AddItemModal })));
const OcrModal = lazy(() => import("./components/captureModals").then((m) => ({ default: m.OcrModal })));
const AuthenticatorModal = lazy(() => import("./components/toolModals").then((m) => ({ default: m.AuthenticatorModal })));
const EmergencyKitModal = lazy(() => import("./components/toolModals").then((m) => ({ default: m.EmergencyKitModal })));
const GeneratorModal = lazy(() => import("./components/toolModals").then((m) => ({ default: m.GeneratorModal })));
const SyncModal = lazy(() => import("./components/toolModals").then((m) => ({ default: m.SyncModal })));
const SecurityCenterModal = lazy(() => import("./components/SecurityCenter"));
const CsvImportModal = lazy(() => import("./components/CsvImportModal").then((m) => ({ default: m.CsvImportModal })));
const UserProfileModal = lazy(() => import("./components/UserProfileModal"));
const UpdateModal = lazy(() => import("./components/UpdateModal"));
// PERFORMANCE (V-63): the Web Audio engine is only needed in zen mode. It
// used to be parsed on every cold start even though 99% of sessions never
// open that panel.
const LofiPlayer = lazy(() => import("./components/LofiPlayer"));
import { APP_VERSION, compareSemver } from "./lib/version";
import { clearPreUpdateBackup, restorePreUpdateBackupIfNeeded } from "./lib/updater";
import { readTestSeed, testSeedEnabled } from "./lib/testSeed";
import {
  checkGitHubUpdate,
  clearActiveSession,
  getActiveSession,
  initialItems,
  invokeTauri,
  isTauri,
  vaultMutationQueue,
  CoalescingVaultWriter,
  t,
  type BrandKey,
  type Language,
  type Theme,
  type UnlockedSession,
  type VaultItem,
} from "./lib/vault";
import { cn } from "./utils/cn";
import { useMediaQuery } from "./lib/motion";
import { mergeVaultItems } from "./lib/p2pMerge";
import { createAutoLock, readAutoLockMinutes, writeAutoLockMinutes, type AutoLockController } from "./lib/autoLock";
import { clearClipboardWipe } from "./lib/clipboard";

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("vaultzero-theme");
  return stored === "dark" || stored === "lofi" || stored === "light" ? stored : "light";
}

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem("vaultzero-language") === "bn" ? "bn" : "en";
}

type FeelSettings = { press: boolean; haptics: boolean };

function readStoredFeel(): FeelSettings {
  if (typeof window === "undefined") return { press: true, haptics: true };
  try {
    const raw = window.localStorage.getItem("vaultzero-feel");
    if (!raw) return { press: true, haptics: true };
    const parsed = JSON.parse(raw) as Partial<FeelSettings>;
    return { press: parsed.press !== false, haptics: parsed.haptics !== false };
  } catch {
    return { press: true, haptics: true };
  }
}

function readStoredTextStep(): number {
  if (typeof window === "undefined") return DEFAULT_TEXT_STEP;
  const rawV2 = window.localStorage.getItem("vaultzero_font_scale_v2");
  if (rawV2 !== null) {
    const stored = Number(rawV2);
    if (Number.isInteger(stored) && stored >= 0 && stored < TEXT_STEPS.length) return stored;
  }
  window.localStorage.removeItem("vaultzero-text-step");
  return DEFAULT_TEXT_STEP;
}

function shouldStartLocked(): boolean {
  if (typeof window === "undefined") return true;
  /*
   * SECURITY: `?unlocked=true` is a test convenience that skips the lock
   * screen. It used to work in a production build as well, which meant
   * that appending the parameter to the URL was enough to open the vault
   * without the master password.
   *
   * The escape hatch is now available only in a development or test
   * build. A production bundle always starts locked.
   */
  if (testSeedEnabled()) {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("unlocked") === "true") return false;
  }
  return getActiveSession() === null;
}

/**
 * PERFORMANCE: cache of lowercased search haystacks, keyed by the item
 * object identity.
 *
 * Previously every keystroke rebuilt a template string for *every* item and
 * called `toLowerCase()` on it — O(n) allocations per keypress. With a
 * `WeakMap` the haystack is computed once per item and reused; entries are
 * collected automatically when the item is dropped, so the cache can never go
 * stale or leak.
 */
const searchHaystackCache = new WeakMap<VaultItem, string>();

function getSearchHaystack(item: VaultItem): string {
  const cached = searchHaystackCache.get(item);
  if (cached !== undefined) return cached;
  const haystack = `${item.title} ${item.username} ${item.url} ${item.category} ${(
    item.tags ?? []
  ).join(" ")}`.toLowerCase();
  searchHaystackCache.set(item, haystack);
  return haystack;
}

type ModalName = ToolName | "mobileMenu" | "profile" | "update";

function MobileNav({
  active,
  folder,
  lang,
  onNav,
  onTool,
}: {
  active: string;
  folder: string | null;
  lang: Language;
  onNav: (id: string) => void;
  onTool: (tool: ModalName) => void;
}) {
  const groupId = useId();
  const navButton = (label: string, icon: typeof House, selected: boolean, onClick: () => void) => {
    const NavIcon = icon;
    return (
      <button
        key={label}
        onClick={onClick}
        className="relative flex h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-[14px] transition-colors"
        style={{ color: selected ? "var(--accent)" : "var(--text-faint)" }}
        data-glass-option="true"
        aria-label={label}
        aria-current={selected ? "page" : undefined}
      >
        {selected && <GlassSelection id="mobile-active" />}
        <NavIcon size={18} weight={selected ? "fill" : "duotone"} />
        <span className="truncate text-[6.5px] font-semibold leading-none">{label}</span>
        {selected && <span className="absolute bottom-[3px] h-[2px] w-3 rounded-full bg-[var(--accent)]" />}
      </button>
    );
  };

  return (
    <LayoutGroup id={groupId}>
      <motion.nav
        layoutRoot
        className="glass-strong fixed bottom-[max(10px,env(safe-area-inset-bottom))] left-1/2 z-[60] flex w-[calc(100%-24px)] max-w-[430px] -translate-x-1/2 items-center gap-0.5 rounded-[21px] p-1.5 lg:hidden"
        style={{ boxShadow: "0 20px 50px rgba(8,10,30,.28), var(--inset-hi)" }}
        aria-label="Mobile navigation"
      >
        {navButton(t(lang, "allItems"), House, active === "all" && !folder, () => onNav("all"))}
        {navButton(t(lang, "favorites"), Star, active === "favorites", () => onNav("favorites"))}
        <button
          onClick={() => onTool("add")}
          className="primary-button mx-1 flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[15px]"
          aria-label={t(lang, "addNew")}
        >
          <Plus size={19} weight="bold" />
        </button>
        {navButton("Sync", ArrowsLeftRight, false, () => onTool("sync"))}
        {navButton("More", Wrench, false, () => onTool("mobileMenu"))}
      </motion.nav>
    </LayoutGroup>
  );
}

export default function App() {
  const activeSession = useMemo(() => {
    // V-63: a failed update must never cost the user their vault. If the
    // encrypted container is missing but the pre-update snapshot survives,
    // put it back *before* the app decides whether a vault exists.
    restorePreUpdateBackupIfNeeded();
    return getActiveSession();
  }, []);
  const [session, setSession] = useState<UnlockedSession | null>(activeSession);
  /*
   * The end-to-end suite seeds the vault through `lib/testSeed.ts`.
   *
   * The application deliberately keeps the vault out of `sessionStorage`,
   * so the browser tests can no longer put items there and expect them
   * back. The seed is read once, only in a development or test build, and
   * it never reaches storage.
   */
  const [items, setItems] = useState<VaultItem[]>(() => {
    if (activeSession) return activeSession.items;
    const seeded = readTestSeed();
    return seeded.length > 0 ? seeded : initialItems;
  });
  const [locked, setLocked] = useState<boolean>(shouldStartLocked);
  const [theme, setTheme] = useState<Theme>(readStoredTheme);
  const [language, setLanguage] = useState<Language>(readStoredLanguage);
  const [active, setActive] = useState("all");
  const [folder, setFolder] = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState<BrandKey | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (activeSession && activeSession.items.length > 0) return activeSession.items[0].id;
    const seeded = readTestSeed();
    if (seeded.length > 0) return seeded[0].id;
    return initialItems[0]?.id ?? null;
  });
  const [detailOpen, setDetailOpen] = useState(() => window.matchMedia("(min-width: 1280px)").matches);
  const [editingItem, setEditingItem] = useState<VaultItem | undefined>();
  const [draft, setDraft] = useState<Partial<VaultItem> | undefined>();
  const [textStep, setTextStep] = useState<number>(readStoredTextStep);
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(readAutoLockMinutes);
  const [modal, setModal] = useState<ModalName | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [feel, setFeel] = useState<FeelSettings>(readStoredFeel);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const dockedInspector = useMediaQuery("(min-width: 1280px)");

  const lang = language;
  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    // PERFORMANCE (V-63): the release check is network-bound and must not
    // compete with first paint. It runs when the main thread is idle (or
    // after a short fallback delay), while the shared cache in `updater.ts`
    // still deduplicates it against the banner's own check.
    const runCheck = () => {
      checkGitHubUpdate(APP_VERSION).then((res) => {
        if (res?.hasUpdate && res.latestVersion && compareSemver(res.latestVersion, APP_VERSION) > 0) {
          notify(`Update available: ${res.latestVersion}`);
        }
      });
    };
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    const cancelIdle = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
    if (typeof idle === "function") {
      const id = idle(runCheck, { timeout: 2000 });
      return () => { if (typeof cancelIdle === "function") cancelIdle(id); };
    }
    const timer = window.setTimeout(runCheck, 800);
    return () => window.clearTimeout(timer);
  }, [notify]);

  useEffect(() => {
    if (isTauri()) {
      invokeTauri("set_screen_protection", { enabled: true });
    }
  }, []);

  /*
   * V-63: the pre-update snapshot is NOT deleted at startup any more.
   * Deleting it on the very first launch of the *new* build meant that a
   * partially failed update (the new build starts, but its vault cannot be
   * read) destroyed the only recoverable copy before the user could act.
   * It is cleared only after a successful unlock proves the vault is sound.
   */

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("vaultzero-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("vaultzero-language", language);
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem("vaultzero-feel", JSON.stringify(feel));
  }, [feel]);

  useEffect(() => {
    const effective = getEffectiveScale(textStep);
    document.documentElement.style.setProperty("--font-scale", String(effective));
    document.documentElement.dataset.textStep = String(textStep);
    window.localStorage.setItem("vaultzero_font_scale_v2", String(textStep));
  }, [textStep]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  // PERFORMANCE (V-36): mutations are coalesced. Each write re-encrypts and
  // rewrites the whole vault, so a burst of edits used to pay that cost once
  // per mutation. The writer keeps only the newest state and flushes it once
  // the burst settles.
  const vaultWriter = useMemo(() => new CoalescingVaultWriter(400), []);

  const lockVault = useCallback(async () => {
    hapticSuccess();
    // PERFORMANCE / DATA-INTEGRITY (V-36): flush any coalesced write before
    // the session ends, otherwise the last edit would be lost.
    //
    // The flush MUST be awaited before the epoch is bumped. It used to be
    // fired and forgotten, which raced the bump: the writer scheduled its
    // task against the *old* epoch, the bump immediately invalidated it, and
    // the final write was rejected with `LOCKED` — silently losing the
    // user's last edit exactly when they hit "Lock".
    //
    // `flush(true)` uses the queue's final-write path, which is serialised
    // against other mutations but is not invalidated by the lock itself.
    await vaultWriter.flush(true).catch(() => undefined);
    vaultMutationQueue.bumpEpoch();
    clearActiveSession();
    setSession(null);
    setLocked(true);
    setModal(null);
    setCommandOpen(false);
    setDetailOpen(false);
    // SECURITY (V-06): a copied secret must not survive a lock. Scrub the
    // clipboard so the next person to use the machine cannot simply paste
    // the password that was copied a moment ago.
    clearClipboardWipe().catch(() => {
      // Clipboard access may be denied; nothing else to do here.
    });
  }, []);

  // SECURITY (V-06): idle / blur / visibility auto-lock.
  //
  // A password manager that stays unlocked indefinitely is vulnerable to the
  // walk-away attack. This locks the vault after a period of inactivity,
  // when the window is hidden (screen locked / app switched away), or after
  // the window has been blurred for a grace period.
  const autoLockRef = useRef<AutoLockController | null>(null);
  // The language is read through a ref so that switching the UI language does
  // not tear down and recreate the auto-lock controller (which would reset
  // the idle timer).
  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => {
    if (locked) {
      autoLockRef.current?.stop();
      autoLockRef.current = null;
      return;
    }

    const controller = createAutoLock({
      onBeforeLock: () => {
        // Best-effort clipboard scrub before the session is torn down.
        void clearClipboardWipe().catch(() => {});
      },
      onLock: (reason) => {
        if (reason !== "manual") {
          notify(
            langRef.current === "bn"
              ? "নিষ্ক্রিয়তার কারণে ভল্ট স্বয়ংক্রিয়ভাবে লক হয়েছে।"
              : "Vault auto-locked due to inactivity.",
          );
        }
        void lockVault();
      },
    });

    autoLockRef.current = controller;
    controller.start();

    return () => {
      controller.stop();
      autoLockRef.current = null;
    };
  }, [locked, lockVault, notify]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (locked) return;
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
        return;
      }
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setModal("ocr");
        return;
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === "y") {
        event.preventDefault();
        setModal("sync");
        return;
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        setTheme((current) => (current === "lofi" ? "light" : "lofi"));
        return;
      }
      if (mod && !event.shiftKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        void lockVault();
        return;
      }
      if (mod && !event.shiftKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setEditingItem(undefined);
        setDraft(undefined);
        setModal("add");
        return;
      }
      if (!typing && !modal && !commandOpen && event.key.toLowerCase() === "n" && !mod) {
        event.preventDefault();
        setEditingItem(undefined);
        setDraft(undefined);
        setModal("add");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal, commandOpen, locked, lockVault]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (folder) {
      result = result.filter((item) => item.folder === folder);
    } else if (active === "favorites") {
      result = result.filter((item) => item.favorite);
    } else if (active === "logins") {
      result = result.filter((item) => item.category === "login");
    } else if (active === "notes") {
      result = result.filter((item) => item.category === "note");
    } else if (active === "identities") {
      result = result.filter((item) => item.category === "identity");
    } else if (active === "payments") {
      result = result.filter((item) => item.category === "payment");
    }
    if (brandFilter !== "all") result = result.filter((item) => item.brand === brandFilter);
    if (query.trim()) {
      const needle = query.toLowerCase();
      // PERFORMANCE: reuse a precomputed lowercase haystack per item instead
      // of rebuilding the template string and calling toLowerCase() on every
      // entry for every keystroke. The haystack cache is invalidated whenever
      // the item list changes.
      result = result.filter((item) => {
        const haystack = getSearchHaystack(item);
        return haystack.includes(needle);
      });
    }
    return result;
  }, [items, folder, active, brandFilter, query]);

  const handleNav = (id: string) => {
    setActive(id);
    setFolder(null);
    setBrandFilter("all");
  };

  const handleFolder = (name: string | null) => {
    setFolder((current) => (current === name ? null : name));
    setActive("all");
    setBrandFilter("all");
  };

  const handleSelect = (item: VaultItem) => {
    setSelectedId(item.id);
    setDetailOpen(true);
  };

  const closeInspector = useCallback(() => {
    setDetailOpen(false);
  }, []);

  const handleNavSafe = (id: string) => {
    handleNav(id);
    closeInspector();
  };

  const mutateVault = useCallback(
    (transform: (current: VaultItem[]) => VaultItem[]) => {
      setItems((current) => {
        const updated = transform(current);
        if (session) {
          vaultWriter.schedule(updated, session);
        }
        return updated;
      });
    },
    [session, vaultWriter]
  );

  /** V-52: merge a validated peer snapshot into the live, persisted vault. */
  const handleP2PMerge = useCallback(
    (remote: VaultItem[]) => {
      mutateVault((current) => mergeVaultItems(current, remote));
    },
    [mutateVault]
  );

  const handleFavorite = (item: VaultItem) => {
    mutateVault((current) =>
      current.map((candidate) =>
        candidate.id === item.id ? { ...candidate, favorite: !candidate.favorite } : candidate
      )
    );
    notify(item.favorite ? `${item.title} removed from favorites` : `${item.title} added to favorites`);
  };

  const handleCreate = (item: VaultItem) => {
    hapticSuccess();
    mutateVault((current) => {
      const exists = current.some((entry) => entry.id === item.id);
      return exists
        ? current.map((entry) => (entry.id === item.id ? item : entry))
        : [item, ...current];
    });
    setSelectedId(item.id);
    setActive("all");
    setFolder(null);
    setBrandFilter("all");
    setQuery("");
    setDetailOpen(true);
  };

  const handleDelete = useCallback(
    (item: VaultItem) => {
      hapticSuccess();
      mutateVault((prev) => prev.filter((i) => i.id !== item.id));
      if (selectedId === item.id) {
        setSelectedId(null);
        setDetailOpen(false);
      }
      notify(lang === "bn" ? "আইটেমটি ভল্ট থেকে মুছে ফেলা হয়েছে" : "Secret deleted from your vault");
    },
    [mutateVault, selectedId, lang, notify]
  );

  const handleBulkDelete = useCallback(
    (ids: string[]) => {
      hapticSuccess();
      const idSet = new Set(ids);
      mutateVault((prev) => prev.filter((i) => !idSet.has(i.id)));
      if (selectedId && idSet.has(selectedId)) {
        setSelectedId(null);
        setDetailOpen(false);
      }
      notify(lang === "bn" ? `${ids.length}টি আইটেম মুছে ফেলা হয়েছে` : `${ids.length} secrets deleted`);
    },
    [mutateVault, selectedId, lang, notify]
  );

  const handleBulkFavorite = useCallback(
    (ids: string[]) => {
      hapticSuccess();
      const idSet = new Set(ids);
      mutateVault((prev) =>
        prev.map((item) =>
          idSet.has(item.id) ? { ...item, favorite: !item.favorite } : item
        )
      );
      notify(lang === "bn" ? "প্রিয় তালিকা আপডেট হয়েছে" : "Favorites updated for selected items");
    },
    [mutateVault, lang, notify]
  );

  const handleBulkMove = useCallback(
    (ids: string[], newFolder: string) => {
      hapticSuccess();
      const idSet = new Set(ids);
      mutateVault((prev) =>
        prev.map((item) =>
          idSet.has(item.id) ? { ...item, folder: newFolder } : item
        )
      );
      notify(lang === "bn" ? `ফোল্ডার '${newFolder}'-এ স্থানান্তরিত হয়েছে` : `Moved to folder '${newFolder}'`);
    },
    [mutateVault, lang, notify]
  );

  const handleExport = useCallback(
    (ids: string[]) => {
      hapticSuccess();
      const idSet = new Set(ids);
      const toExport = items.filter((i) => idSet.has(i.id));
      const csvData = exportVaultToCsv(toExport);
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vaultzero-export-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      notify(lang === "bn" ? "নিরাপদ CSV এক্সপোর্ট সম্পন্ন হয়েছে" : "Selected secrets exported to CSV");
    },
    [items, lang, notify]
  );

  const handleRestorePassword = useCallback(
    (item: VaultItem, restoredPassword: string) => {
      hapticSuccess();
      mutateVault((prev) =>
        prev.map((candidate) => {
          if (candidate.id !== item.id) return candidate;
          const history = [...(candidate.passwordHistory || [])];
          if (candidate.password && candidate.password !== restoredPassword) {
            history.unshift({
              password: candidate.password,
              changedAt: "Just now",
            });
          }
          return {
            ...candidate,
            password: restoredPassword,
            passwordHistory: history,
          };
        })
      );
      notify(t(lang, "restoredSuccess"));
    },
    [mutateVault, lang, notify]
  );

  const handleCsvImport = useCallback(
    (importedItems: VaultItem[]) => {
      hapticSuccess();
      mutateVault((prev) => [...importedItems, ...prev]);
    },
    [mutateVault]
  );

  const openTool = (tool: ToolName) => {
    if (tool === "add") {
      setEditingItem(undefined);
      setDraft(undefined);
    }
    setModal(tool);
  };

  const openModalTool = (tool: ModalName) => {
    if (tool === "add") {
      setEditingItem(undefined);
      setDraft(undefined);
    }
    setModal(tool);
  };

  const changeTextStep = (index: number) => {
    setTextStep(index);
    notify(`Text size: ${stepLabel(index)} (${Math.round(TEXT_STEPS[index] * 100)}%)`);
  };

  const changeAutoLockMinutes = (minutes: number) => {
    setAutoLockMinutes(minutes);
    writeAutoLockMinutes(minutes);
    // Apply immediately to the running controller.
    autoLockRef.current?.setTimeoutMinutes?.(minutes);
    notify(
      minutes === 0
        ? lang === "bn"
          ? "স্বয়ংক্রিয় লক বন্ধ করা হয়েছে।"
          : "Auto-lock disabled."
        : lang === "bn"
          ? `স্বয়ংক্রিয় লক: ${minutes} মিনিট`
          : `Auto-lock: ${minutes} min`,
    );
  };

  const openSeedItem = (item: VaultItem) => {
    setModal(null);
    setSelectedId(item.id);
    setDetailOpen(true);
  };

  const handleEdit = (item: VaultItem) => {
    setDraft(undefined);
    setEditingItem(item);
    setModal("add");
  };

  const handleScanDraft = (scanned: Partial<VaultItem>) => {
    setEditingItem(undefined);
    setDraft(scanned);
    setModal("add");
  };

  const changeTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    notify(
      nextTheme === "lofi"
        ? "Cozy lofi zen mode on"
        : `${nextTheme === "dark" ? "Liquid glass dark" : "Liquid glass light"} theme on`
    );
  };

  const updateFeel = (patch: Partial<FeelSettings>) => {
    setFeel((current) => ({ ...current, ...patch }));
  };

  return (
    <TactileProvider press={feel.press} haptics={feel.haptics}>
      <div className="app-canvas" data-theme={theme}>
        <AmbientScene theme={theme} />
        <span
          className="ambient-blob"
          aria-hidden="true"
          style={{ width: 340, height: 340, left: "23%", top: "8%", background: "var(--orb-2)" }}
        />
        <span
          className="ambient-blob"
          aria-hidden="true"
          style={{
            width: 280,
            height: 280,
            right: "13%",
            bottom: "2%",
            background: "var(--orb-4)",
            animationDelay: "-5s",
          }}
        />
        <span
          className="ambient-blob hidden lg:block"
          aria-hidden="true"
          style={{
            width: 240,
            height: 240,
            left: "47%",
            bottom: "24%",
            background: "var(--orb-3)",
            opacity: 0.22,
            animationDelay: "-10s",
          }}
        />

        <div
          className="vault-shell relative z-10 mx-auto flex h-[100dvh] w-full max-w-[1780px] gap-0 p-0 lg:p-4"
          inert={locked || modal !== null || commandOpen || (detailOpen && !dockedInspector)}
        >
          <Sidebar
            lang={lang}
            active={active}
            folder={folder}
            items={items}
            onNav={handleNav}
            onFolder={handleFolder}
            onTool={openTool}
            onAdd={() => openTool("add")}
            onLock={lockVault}
            onOpenMobileMenu={() => setModal("mobileMenu")}
            onOpenProfile={() => setModal("profile")}
            onOpenUpdate={() => setModal("update")}
          />

          <main
            className={cn(
              "thin-scrollbar min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-[90px] pt-3 sm:px-4 lg:overflow-hidden lg:px-0 lg:pb-0 lg:pt-0",
              !detailOpen && "xl:pr-0"
            )}
          >
            <VaultHome
              lang={lang}
              theme={theme}
              active={active}
              folder={folder}
              items={filteredItems}
              allItems={items}
              query={query}
              brandFilter={brandFilter}
              selectedId={detailOpen ? selectedId : null}
              onTheme={changeTheme}
              onLanguage={setLanguage}
              onQuery={setQuery}
              onBrandFilter={setBrandFilter}
              onSelect={handleSelect}
              onTool={openTool}
              onAdd={() => openTool("add")}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onBulkDelete={handleBulkDelete}
              onBulkFavorite={handleBulkFavorite}
              onBulkMove={handleBulkMove}
              onExport={handleExport}
              onNotify={notify}
              onFavorite={handleFavorite}
              textStep={textStep}
              onTextStep={changeTextStep}
              onOpenProfile={() => setModal("profile")}
            />
          </main>

          <InspectorHost
            item={selectedItem}
            open={detailOpen && !locked && selectedItem !== null}
            suspended={modal !== null || commandOpen}
            lang={lang}
            onClose={closeInspector}
            onNotify={notify}
            onTool={openTool}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onFavorite={handleFavorite}
            onRestorePassword={handleRestorePassword}
          />
        </div>

        <MobileNav
          active={active}
          folder={folder}
          lang={lang}
          onNav={handleNavSafe}
          onTool={openModalTool}
        />

        <AnimatePresence>
          {commandOpen && !locked && (
            <CommandPalette
              key="command-palette"
              items={items}
              lang={lang}
              theme={theme}
              onClose={() => setCommandOpen(false)}
              onSelectItem={(item) => {
                handleSelect(item);
                setCommandOpen(false);
              }}
              onTool={openTool}
              onTheme={changeTheme}
              onLanguage={setLanguage}
              feel={feel}
              onToggleFeel={updateFeel}
              onLock={lockVault}
            />
          )}
        </AnimatePresence>

        <Suspense fallback={null}>
          <AnimatePresence mode="wait">
            {modal === "add" && (
              <AddItemModal
              key="add"
              initialItem={editingItem}
              draft={draft}
              onClose={() => setModal(null)}
              onCreate={handleCreate}
              onNotify={notify}
            />
          )}
          {modal === "generator" && (
            <GeneratorModal key="generator" onClose={() => setModal(null)} onNotify={notify} />
          )}
          {modal === "authenticator" && (
            <AuthenticatorModal
              key="authenticator"
              items={items}
              onClose={() => setModal(null)}
              onNotify={notify}
              onOpenSync={() => setModal("sync")}
            />
          )}
          {modal === "security" && (
            <SecurityCenterModal
              key="security"
              items={items}
              onClose={() => setModal(null)}
              onNotify={notify}
              onReview={openSeedItem}
              onOpenAuthenticator={() => setModal("authenticator")}
            />
          )}
          {modal === "sync" && (
            <SyncModal
              key="sync"
              onClose={() => setModal(null)}
              onNotify={notify}
              items={items}
              onMerge={handleP2PMerge}
            />
          )}
          {modal === "emergency" && (
            <EmergencyKitModal key="emergency" onClose={() => setModal(null)} onNotify={notify} />
          )}
          {modal === "csvImport" && (
            <CsvImportModal
              key="csvImport"
              onClose={() => setModal(null)}
              onImport={handleCsvImport}
              onNotify={notify}
              lang={lang}
            />
          )}
          {modal === "ocr" && (
            <OcrModal
              key="ocr"
              onClose={() => setModal(null)}
              onCreate={handleCreate}
              onDraft={handleScanDraft}
              onNotify={notify}
              lang={lang}
            />
          )}
          {modal === "mobileMenu" && (
            <Modal
              key="mobile-menu"
              onClose={() => setModal(null)}
              pullDown
              title="Quick access"
              subtitle="Your vault, tools and local privacy — in one place."
              icon={<Sparkle size={20} weight="duotone" />}
              width="max-w-[440px]"
            >
              <div className="glass-soft mb-3 flex items-center gap-3 rounded-[15px] border border-[var(--border-soft)] p-3">
                {(() => {
                  const username = (typeof window !== "undefined" && localStorage.getItem("vaultzero_username")) || (lang === "bn" ? "ভল্ট ওনার" : "Vault Owner");
                  return (
                    <>
                      <Avatar name={username} size={38} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-main">{username}</p>
                        <p className="mt-0.5 text-[8px] text-faint">{items.length} items · local vault</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModal("profile")}
                        className="rounded-lg bg-[var(--glass-input)] px-2 py-1 text-[8.5px] font-medium text-accent hover:bg-[var(--hover)]"
                      >
                        Edit
                      </button>
                    </>
                  );
                })()}
                <div
                  className="flex items-center gap-1 rounded-full border px-2 py-1 text-[7px] font-semibold text-[var(--success)]"
                  style={{
                    borderColor: "color-mix(in srgb, var(--success) 20%, transparent)",
                    background: "var(--success-soft)",
                  }}
                >
                  <span className="h-1 w-1 rounded-full bg-current" /> OFFLINE
                </div>
              </div>
              <MobileQuickMenu
                lang={lang}
                items={items}
                onTool={(tool) => setModal(tool)}
                onNav={(id) => {
                  handleNav(id);
                  setModal(null);
                }}
              />

              <div className="mt-3 rounded-[16px] border border-[var(--border-soft)] bg-[var(--glass-soft)] p-3">
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <p className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.13em] text-faint">
                    Text size
                  </p>
                  <TextSizeControl index={textStep} onChange={changeTextStep} />
                </div>
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <p className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.13em] text-faint">
                    <LockKey size={12} weight="duotone" style={{ color: "var(--accent)" }} /> Auto-lock
                  </p>
                  <AutoLockControl
                    minutes={autoLockMinutes}
                    onChange={changeAutoLockMinutes}
                    lang={lang}
                  />
                </div>
                {theme === "lofi" && (
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.13em] text-faint">
                      Soundscape
                    </p>
                    <Suspense fallback={null}><LofiPlayer active onNotify={notify} /></Suspense>
                  </div>
                )}
                <div className="mb-2.5 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.13em] text-faint">
                    <HandTap size={12} weight="duotone" style={{ color: "var(--accent)" }} /> Feel &
                    feedback
                  </p>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[6.5px] font-bold uppercase tracking-[0.08em] text-[var(--success)]"
                    style={{ background: "var(--success-soft)" }}
                  >
                    Material expressive
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3 rounded-[11px] px-1 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-[var(--accent-soft)] text-accent">
                        <ToggleLeft size={13} weight="duotone" />
                      </span>
                      <div>
                        <p className="text-[9.5px] font-semibold text-main">Springy press physics</p>
                        <p className="text-[7px] text-faint">Ripples & compress on every tap</p>
                      </div>
                    </div>
                    <Toggle
                      checked={feel.press}
                      onChange={(value) => updateFeel({ press: value })}
                      label="Springy press physics"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-[11px] px-1 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-[var(--accent-soft)] text-accent">
                        <Fingerprint size={13} weight="duotone" />
                      </span>
                      <div>
                        <p className="text-[9.5px] font-semibold text-main">Haptic feedback</p>
                        <p className="text-[7px] text-faint">Gentle taps on supported devices</p>
                      </div>
                    </div>
                    <Toggle
                      checked={feel.haptics}
                      onChange={(value) => updateFeel({ haptics: value })}
                      label="Haptic feedback"
                    />
                  </div>
                </div>
                <div className="mt-3 flex gap-2.5 border-t border-[var(--border-soft)] pt-3">
                  <Tooltip label="Panic lock · Ctrl L" className="flex-1">
                    <button
                      onClick={lockVault}
                      className="secondary-button flex h-[40px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-[13px] px-4.5 py-2.5 text-[10.5px] font-semibold text-danger"
                    >
                      <LockKey size={14} weight="duotone" /> Lock vault
                    </button>
                  </Tooltip>
                  <Tooltip label="Offline OCR · Ctrl Shift S" className="flex-1">
                    <button
                      onClick={() => setModal("ocr")}
                      className="secondary-button flex h-[40px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-[13px] px-4.5 py-2.5 text-[10.5px] font-semibold text-accent"
                    >
                      <Sparkle size={14} weight="duotone" /> Snip
                    </button>
                  </Tooltip>
                </div>
              </div>
            </Modal>
          )}
          {modal === "profile" && (
            <UserProfileModal
              key="profile"
              onClose={() => setModal(null)}
              onNotify={notify}
              onCheckUpdates={() => setModal("update")}
              lang={lang}
            />
          )}
          {modal === "update" && (
            <UpdateModal
              key="update"
              onClose={() => setModal(null)}
              onNotify={notify}
              lang={lang}
            />
          )}
        </AnimatePresence>
        </Suspense>

        {locked && (
          <LockScreen
            lang={lang}
            onUnlocked={(newSession) => {
              // Only now is the vault proven readable. The snapshot has
              // served its purpose and can be dropped (V-39 / V-63).
              clearPreUpdateBackup();
              setSession(newSession);
              setItems(newSession.items);
              setLocked(false);
              if (newSession.items.length > 0) {
                setSelectedId(newSession.items[0].id);
              } else {
                setSelectedId(null);
              }
              if (newSession.isDuress) {
                notify(t(lang, "duressActiveNotice"));
              } else {
                notify(
                  lang === "bn"
                    ? "ভল্ট সফলভাবে খোলা হয়েছে · Argon2id & XChaCha20"
                    : "Vault unlocked locally · Argon2id & XChaCha20"
                );
              }
            }}
            onEmergency={() => {
              setLocked(false);
              setModal("emergency");
            }}
          />
        )}

        <AnimatePresence>
          {toast && (
            <motion.div
              key="notification"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, transition: { duration: 0.18 } }}
              className="glass-strong fixed bottom-[94px] left-1/2 z-[200] flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-2.5 rounded-full py-2 pl-3 pr-2.5 lg:bottom-6"
              style={{ boxShadow: "0 18px 48px rgba(8,10,30,.3), var(--inset-hi)" }}
              role="status"
              aria-live="polite"
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--success)]"
                style={{ background: "var(--success-soft)" }}
              >
                <CheckCircle size={14} weight="fill" />
              </span>
              <span className="truncate text-[9.5px] font-medium text-main">{toast}</span>
              <button
                onClick={() => setToast(null)}
                className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-faint hover:text-main"
                aria-label="Dismiss notification"
              >
                <X size={10} weight="bold" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <UpdateBanner lang={language} onNotify={notify} />
      </div>
    </TactileProvider>
  );
}
