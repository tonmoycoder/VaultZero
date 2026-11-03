import { isSafeVaultUrl } from "./url";
import {
  siApple,
  siDropbox,
  siFigma,
  siGithub,
  siGoogle,
  siNotion,
  siPaypal,
  siSpotify,
  siX,
} from "simple-icons";
import { APP_VERSION } from "./version";

export type Theme = "light" | "dark" | "lofi";
export type Language = "en" | "bn";
export type Category = "login" | "note" | "identity" | "payment";
export type Strength = "strong" | "fair" | "weak";
export type BrandKey =
  | "google"
  | "github"
  | "apple"
  | "dropbox"
  | "notion"
  | "figma"
  | "paypal"
  | "x"
  | "spotify"
  | "vault";

export type Brand = {
  name: string;
  short: string;
  hex: string;
  tint: string;
  path?: string;
};

export const brands: Record<BrandKey, Brand> = {
  google: {
    name: "Google",
    short: "G",
    hex: "#4285F4",
    tint: "rgba(66, 133, 244, 0.15)",
    path: siGoogle.path,
  },
  github: {
    name: "GitHub",
    short: "GH",
    hex: "#24292F",
    tint: "rgba(36, 41, 47, 0.13)",
    path: siGithub.path,
  },
  apple: {
    name: "Apple",
    short: "A",
    hex: "#111827",
    tint: "rgba(17, 24, 39, 0.1)",
    path: siApple.path,
  },
  dropbox: {
    name: "Dropbox",
    short: "D",
    hex: "#0061FF",
    tint: "rgba(0, 97, 255, 0.12)",
    path: siDropbox.path,
  },
  notion: {
    name: "Notion",
    short: "N",
    hex: "#111827",
    tint: "rgba(53, 45, 45, 0.1)",
    path: siNotion.path,
  },
  figma: {
    name: "Figma",
    short: "F",
    hex: "#F24E1E",
    tint: "rgba(242, 78, 30, 0.12)",
    path: siFigma.path,
  },
  paypal: {
    name: "PayPal",
    short: "P",
    hex: "#002991",
    tint: "rgba(0, 41, 145, 0.12)",
    path: siPaypal.path,
  },
  x: {
    name: "X",
    short: "X",
    hex: "#111111",
    tint: "rgba(15, 23, 42, 0.11)",
    path: siX.path,
  },
  spotify: {
    name: "Spotify",
    short: "S",
    hex: "#1ED760",
    tint: "rgba(30, 215, 96, 0.16)",
    path: siSpotify.path,
  },
  vault: {
    name: "VaultZero",
    short: "V0",
    hex: "#7C6BFF",
    tint: "rgba(124, 107, 255, 0.14)",
  },
};

export type PasswordHistoryEntry = {
  password: string;
  changedAt: string;
};

export type VaultItem = {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
  category: Category;
  brand: BrandKey;
  favorite: boolean;
  strength: Strength;
  score: number;
  modified: string;
  totp?: string;
  recoveryCodes?: string[];
  note?: string;
  tags?: string[];
  folder?: string;
  passwordHistory?: PasswordHistoryEntry[];
};

/**
 * Builds the text produced by the "Copy all" quick-copy action.
 *
 * SECURITY (V-30): this bundle deliberately **omits the TOTP setup secret**
 * and the **recovery codes**.
 *
 * The setup secret is the seed the authenticator app is built from. It never
 * rotates, so leaking it hands an attacker a permanent 2FA bypass for that
 * account — strictly worse than leaking the password, because changing the
 * password does not help. Pasting a "copy all" bundle into a support chat,
 * a password manager, or a spreadsheet is exactly the kind of routine action
 * that leaks secrets, and a TOTP seed must never ride along with it.
 *
 * The recovery codes have the same problem in reverse: they are the user's
 * fallback when the authenticator is lost, and a bundle containing them
 * defeats that fallback.
 *
 * Both are available through their own explicit, individually-confirmed
 * actions in the inspector.
 */
export const buildFormattedQuickCopy = (item: VaultItem, currentTotpCode?: string): string => {
  // SECURITY: a `javascript:` or `data:` URL must never reach the
  // clipboard — the user would paste it into a browser and run it. The URL
  // is dropped rather than rewritten, so a legitimate `github.com` is
  // still copied exactly as stored.
  const safeUrl = isSafeVaultUrl(item.url) ? item.url : "";
  const lines: string[] = [
    `Account: ${item.title}`,
    safeUrl ? `Website: ${safeUrl}` : "",
    item.username ? `Username / Email: ${item.username}` : "",
    item.password ? `Password: ${item.password}` : "",
    // V-60: `item.totp` is the permanent 2FA SETUP SECRET. Only a freshly
    // computed, short-lived code may be copied; falling back to the secret
    // would hand an attacker a permanent 2FA bypass with one clipboard copy.
    currentTotpCode ? `2FA Code (TOTP): ${currentTotpCode}` : "",
    item.note || (item as any).notes ? `Notes: ${item.note || (item as any).notes}` : "",
    item.folder ? `Folder: ${item.folder}` : "",
  ].filter(Boolean);
  return lines.join("\n");
};

/**
 * V-51: the default state contains exactly ONE credential — a single,
 * deletable demo password. The demo entry used to also seed a second
 * password in `passwordHistory`, which meant a "clean" vault actually
 * shipped two demo passwords. History now starts empty and is populated
 * only by real password changes the user makes.
 */
export const initialItems: VaultItem[] = [
  {
    id: "demo-account",
    title: "VaultZero Demo Account",
    username: "demo@vaultzero.local",
    password: "V0-Secure$Demo2026",
    url: "vaultzero.me",
    category: "login",
    brand: "vault",
    favorite: true,
    strength: "strong",
    score: 4,
    modified: "Just now",
    recoveryCodes: ["VZ01-DEMO-9942", "VZ02-DEMO-8831", "VZ03-DEMO-7720", "VZ04-DEMO-6619"],
    tags: ["Demo", "Deletable"],
    folder: "Personal",
    note: "This is a single demo entry. You can edit, copy, inspect history, or delete it anytime. Deleting it leaves your vault 100% empty.",
    passwordHistory: [],
  },
];

export const categoryForNav: Record<string, Category | null> = {
  all: null,
  favorites: null,
  logins: "login",
  notes: "note",
  identities: "identity",
  payments: "payment",
};

export const translations = {
  en: {
    addNew: "Add new",
    allItems: "All items",
    favorites: "Favorites",
    logins: "Logins",
    secureNotes: "Secure notes",
    identities: "Identities",
    payments: "Payments",
    tools: "Tools",
    scanImport: "Scan & import",
    csvImport: "CSV Import",
    passwordGenerator: "Password generator",
    authenticator: "2FA authenticator",
    securityCenter: "Security center",
    p2pSync: "P2P sync",
    emergencyKit: "Emergency kit",
    folders: "Folders",
    newFolder: "New folder",
    offlineNote: "100% offline",
    offlineCopy: "Everything stays on this device",
    greeting: "Good morning, Vault Owner.",
    greetingBn: "শুভ সকাল, ভল্ট ওনার।",
    vaultSubtitle: "Your private corner, beautifully sealed.",
    searchPlaceholder: "Search your vault…",
    vaultHealth: "Vault health",
    healthy: "healthy",
    strong: "Strong",
    toReview: "To review",
    weak: "Weak",
    items: "items",
    item: "item",
    allBrands: "All",
    sortRecent: "Recently updated",
    sortAlphabetical: "Name (A–Z)",
    sortFolder: "Folder (A–Z)",
    sortStrength: "Password strength",
    sortBy: "Sort by",
    addFirstItem: "Add first item",
    emptyFolder: "This folder is empty",
    emptyFolderCopy: "A quiet, private place for your next secret. Add anything from a login to a handwritten note.",
    emptyVault: "Your vault is empty",
    emptyVaultCopy: "Zero secrets stored. Add your first login or import an emergency kit to begin.",
    workspace: "Workspace",
    favoritesTitle: "Favorites",
    details: "Item details",
    launchWebsite: "Launch website",
    username: "Username",
    password: "Password",
    strength: "Password strength",
    totp: "Two-factor code",
    recovery: "Recovery codes",
    copy: "Copy",
    copied: "Copied",
    reveal: "Reveal",
    hide: "Hide",
    close: "Close",
    saved: "Saved securely",
    noResults: "Nothing matches",
    noResultsCopy: "Try a different name, brand or username. Your search never leaves this device.",
    new: "New",
    offline: "Offline",
    expires: "expires in",
    viewAll: "View all",
    open: "Open",
    seconds: "sec",
    addItem: "Add to vault",
    synced: "Synced locally",
    scan: "Scan image",
    delete: "Delete",
    edit: "Edit",
    confirmDelete: "Are you sure you want to permanently delete this secret?",
    cancel: "Cancel",
    bulkSelected: "selected",
    deleteSelected: "Delete selected",
    moveToFolder: "Move to folder",
    toggleFavorite: "Toggle favorite",
    exportSelected: "Export selected",
    passwordHistory: "Password history",
    noPasswordHistory: "No prior passwords recorded",
    restorePassword: "Restore",
    restoredSuccess: "Previous password restored",
    setupTitle: "Create your VaultZero vault",
    setupSubtitle: "Set a master password. Everything is encrypted locally with Argon2id & XChaCha20.",
    unlockTitle: "Welcome back, Vault Owner.",
    unlockSubtitle: "Your secrets are sealed on this device. Enter your master password.",
    masterPassword: "Master password",
    confirmPassword: "Confirm master password",
    duressPasswordOptional: "Duress / decoy password (optional)",
    duressHint: "Opens an empty vault if entered under coercion.",
    generateKeyfile: "Generate keyfile (.vzkey)",
    attachKeyfile: "Attach keyfile (.vzkey)",
    keyfileAttached: "Keyfile attached",
    createVaultBtn: "Create local vault",
    unlockVaultBtn: "Unlock vault",
    duressActiveNotice: "Decoy vault active. Primary records hidden.",
    p2pHostTab: "Host / Show QR",
    p2pScanTab: "Scan QR / Camera",
    p2pWaiting: "Waiting for peer connection…",
    p2pReady: "Connected to peer",
    sendVault: "Send vault to peer",
    receiveMerge: "Receive & merge",
  },
  bn: {
    addNew: "নতুন যোগ করুন",
    allItems: "সব আইটেম",
    favorites: "প্রিয়",
    logins: "লগইন",
    secureNotes: "সিকিউর নোট",
    identities: "পরিচয়",
    payments: "পেমেন্ট",
    tools: "টুলস",
    scanImport: "স্ক্যান করে যোগ",
    csvImport: "সিএসভি ইম্পোর্ট",
    passwordGenerator: "পাসওয়ার্ড জেনারেটর",
    authenticator: "২এফএ অথেন্টিকেটর",
    securityCenter: "সিকিউরিটি সেন্টার",
    p2pSync: "পিটুপি সিঙ্ক",
    emergencyKit: "ইমার্জেন্সি কিট",
    folders: "ফোল্ডার",
    newFolder: "নতুন ফোল্ডার",
    offlineNote: "সম্পূর্ণ অফলাইন",
    offlineCopy: "সবকিছু এই ডিভাইসেই থাকে",
    greeting: "শুভ সকাল, ভল্ট ওনার।",
    greetingBn: "শুভ সকাল, ভল্ট ওনার।",
    vaultSubtitle: "আপনার ব্যক্তিগত ভাঁড়ার, নিরাপদে সিল করা।",
    searchPlaceholder: "ভল্টে খুঁজুন…",
    vaultHealth: "ভল্টের স্বাস্থ্য",
    healthy: "সুস্থ",
    strong: "শক্তিশালী",
    toReview: "পর্যালোচনা",
    weak: "দুর্বল",
    items: "আইটেম",
    item: "আইটেম",
    allBrands: "সব",
    sortRecent: "সাম্প্রতিক",
    sortAlphabetical: "নাম (অ–হ)",
    sortFolder: "ফোল্ডার অনুযায়ী",
    sortStrength: "পাসওয়ার্ডের শক্তি",
    sortBy: "সাজান",
    addFirstItem: "প্রথম আইটেম যোগ করুন",
    emptyFolder: "এই ফোল্ডারটি খালি",
    emptyFolderCopy: "আপনার পরবর্তী গোপন তথ্যের জন্য শান্ত, ব্যক্তিগত জায়গা। লগইন থেকে হাতে লেখা নোট—যেকোনো কিছু যোগ করুন।",
    emptyVault: "আপনার ভল্ট সম্পূর্ণ খালি",
    emptyVaultCopy: "কোনো গোপন তথ্য সংরক্ষিত নেই। শুরু করতে প্রথম লগইন যোগ করুন বা ব্যাকআপ আনুন।",
    workspace: "ওয়ার্কস্পেস",
    favoritesTitle: "প্রিয় আইটেম",
    details: "আইটেমের বিবরণ",
    launchWebsite: "ওয়েবসাইটে যান",
    username: "ইউজারনেম",
    password: "পাসওয়ার্ড",
    strength: "পাসওয়ার্ডের শক্তি",
    totp: "দুই-ধাপের কোড",
    recovery: "রিকভারি কোড",
    copy: "কপি",
    copied: "কপি হয়েছে",
    reveal: "দেখুন",
    hide: "লুকান",
    close: "বন্ধ",
    saved: "নিরাপদে সংরক্ষিত",
    noResults: "কিছু পাওয়া যায়নি",
    noResultsCopy: "অন্য নাম, ব্র্যান্ড বা ইউজারনেম দিয়ে চেষ্টা করুন। আপনার সার্চ কখনো ডিভাইস ছাড়ে না।",
    new: "নতুন",
    offline: "অফলাইন",
    expires: "শেষ হবে",
    viewAll: "সব দেখুন",
    open: "খুলুন",
    seconds: "সেকেন্ড",
    addItem: "ভল্টে যোগ করুন",
    synced: "লোকালি সিঙ্কড",
    scan: "ছবি স্ক্যান",
    delete: "মুছে ফেলুন",
    edit: "সম্পাদনা",
    confirmDelete: "আপনি কি নিশ্চিতভাবে এই গোপন তথ্যটি চিরতরে মুছে ফেলতে চান?",
    cancel: "বাতিল",
    bulkSelected: "টি নির্বাচিত",
    deleteSelected: "নির্বাচিতগুলো মুছুন",
    moveToFolder: "ফোল্ডারে সরান",
    toggleFavorite: "প্রিয় তালিকায় যুক্ত/বাদ",
    exportSelected: "এক্সপোর্ট করুন",
    passwordHistory: "পাসওয়ার্ড ইতিহাস",
    noPasswordHistory: "পূর্ববর্তী কোনো পাসওয়ার্ড নেই",
    restorePassword: "পুনরুদ্ধার",
    restoredSuccess: "পূর্বের পাসওয়ার্ড পুনরুদ্ধার করা হয়েছে",
    setupTitle: "নতুন VaultZero ভল্ট তৈরি করুন",
    setupSubtitle: "একটি মাস্টার পাসওয়ার্ড দিন। আপনার ডিভাইসেই সবকিছু আর্গন২আইডি ও এক্সচাচ্চা২০ দিয়ে এনক্রিপ্ট হবে।",
    unlockTitle: "স্বাগতম, ভল্ট ওনার।",
    unlockSubtitle: "আপনার সব গোপন তথ্য এই ডিভাইসে সুরক্ষিত। মাস্টার পাসওয়ার্ড দিন।",
    masterPassword: "মাস্টার পাসওয়ার্ড",
    confirmPassword: "মাস্টার পাসওয়ার্ড নিশ্চিত করুন",
    duressPasswordOptional: "ডিকয় / ডুরেজ পাসওয়ার্ড (ঐচ্ছিক)",
    duressHint: "বিপদের সময় এটি দিলে সম্পূর্ণ খালি একটি নকল ভল্ট খুলবে।",
    generateKeyfile: "🔑 নতুন কি-ফাইল তৈরি করুন (.vzkey)",
    attachKeyfile: "📎 কি-ফাইল যুক্ত করুন (.vzkey)",
    keyfileAttached: "কি-ফাইল যুক্ত হয়েছে",
    createVaultBtn: "নতুন ভল্ট তৈরি করুন",
    unlockVaultBtn: "ভল্ট খুলুন",
    duressActiveNotice: "ডিকয় ভল্ট সক্রিয়। আসল ডেটা সম্পূর্ণ গোপন।",
    p2pHostTab: "হোস্ট / QR কোড দেখান",
    p2pScanTab: "QR স্ক্যান / ক্যামেরা",
    p2pWaiting: "অন্য ডিভাইসের জন্য অপেক্ষা করা হচ্ছে…",
    p2pReady: "ডিভাইস সংযুক্ত হয়েছে",
    sendVault: "ভল্ট পাঠান",
    receiveMerge: "ভল্ট গ্রহণ ও মার্জ",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["en"];

export const t = (lang: Language, key: TranslationKey): string => {
  return translations[lang]?.[key] || translations["en"]?.[key] || String(key);
};

export const strengthMeta: Record<Strength, { color: string; labelKey: TranslationKey; bars: number }> = {
  strong: { color: "var(--success)", labelKey: "strong", bars: 4 },
  fair: { color: "var(--warning)", labelKey: "toReview", bars: 2 },
  weak: { color: "var(--danger)", labelKey: "weak", bars: 1 },
};

export const categoryMeta: Record<Category, { label: string; className: string }> = {
  login: { label: "Login", className: "bg-blue-500/10 text-blue-500" },
  note: { label: "Secure note", className: "bg-amber-500/10 text-amber-500" },
  identity: { label: "Identity", className: "bg-violet-500/10 text-violet-500" },
  payment: { label: "Payment", className: "bg-emerald-500/10 text-emerald-500" },
};

export const isTauri = (): boolean => {
  return typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
};

export async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<T>(cmd, args);
  } catch (err) {
    console.warn(`[Tauri] Invoke ${cmd} failed:`, err);
    return null;
  }
}

export function copyWithAutoClear(text: string, onNotify?: (msg: string) => void, seconds = 12) {
  navigator.clipboard.writeText(text);
  if (onNotify) onNotify(`Copied · auto-clears in ${seconds}s`);
  setTimeout(async () => {
    try {
      const current = await navigator.clipboard.readText();
      if (current === text) {
        await navigator.clipboard.writeText("");
      }
    } catch {
      // ignore
    }
  }, seconds * 1000);
}

/**
 * Checks GitHub for a newer release.
 *
 * This used to be a third, independent update check. The banner, the modal
 * and this function each fetched the release list on their own, so the app
 * made three identical requests to the GitHub API on every start and the
 * three could disagree — the banner could show an update the modal
 * reported as up to date.
 *
 * The check now lives in `lib/updater.ts`, which owns the whole update
 * contract: the trusted-host allowlist, the checksum verification and the
 * artifact selection. This wrapper keeps the old call shape for the
 * existing callers and simply forwards to the shared implementation.
 *
 * The release page is never returned as a download URL. It is a web page
 * that links to several files, so it cannot be checksum-verified.
 */
export async function checkGitHubUpdate(
  currentVersion = APP_VERSION
): Promise<{ hasUpdate: boolean; latestVersion?: string; downloadUrl?: string } | null> {
  const { checkReleaseStatus, compareSemver, selectDownloadableAsset } = await import("./updater");
  const result = await checkReleaseStatus();
  if (result.status !== "update_available") {
    return result.status === "up_to_date" ? { hasUpdate: false } : null;
  }

  // The shared check compares against the running build. A caller that asks
  // about a different version gets the answer for that version, so the
  // comparison stays correct instead of being ignored.
  const remoteVersion = result.remoteVersion ?? "";
  if (!remoteVersion || compareSemver(remoteVersion, currentVersion) <= 0) {
    return { hasUpdate: false };
  }

  const asset = selectDownloadableAsset(result.updateInfo);
  return {
    hasUpdate: true,
    latestVersion: remoteVersion,
    downloadUrl: asset?.browser_download_url,
  };
}

export * from "./storage";
