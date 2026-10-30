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
};

export const initialItems: VaultItem[] = [
  {
    id: "google",
    title: "Google",
    username: "ayaan@vaultzero.me",
    password: "Nova$unrise_88!",
    url: "accounts.google.com",
    category: "login",
    brand: "google",
    favorite: true,
    strength: "strong",
    score: 4,
    modified: "2 min ago",
    totp: "482 197",
    recoveryCodes: ["GX7Q-4H2M-91LA", "P3NV-8K6D-27ZC", "LQ9A-5R1T-64BX", "MW2E-7Y8U-03KF"],
    tags: ["Work", "2FA"],
    folder: "Personal",
    note: "Primary account for calendars, mail and the VaultZero family group.",
  },
  {
    id: "github",
    title: "GitHub",
    username: "ayaan-dev",
    password: "Gh#Secure!2026",
    url: "github.com",
    category: "login",
    brand: "github",
    favorite: true,
    strength: "strong",
    score: 4,
    modified: "18 min ago",
    totp: "731 408",
    recoveryCodes: ["7BDF-2K9A-1140", "92KD-M4L0-73PQ", "X0TZ-66NC-3021", "1PQA-9L8V-4472"],
    tags: ["Work", "2FA"],
    folder: "Work",
  },
  {
    id: "apple",
    title: "Apple ID",
    username: "ayaan@icloud.com",
    password: "Liquid.Glass#188",
    url: "appleid.apple.com",
    category: "login",
    brand: "apple",
    favorite: false,
    strength: "strong",
    score: 4,
    modified: "2 hours ago",
    totp: "294 613",
    tags: ["Personal", "Devices"],
    folder: "Personal",
  },
  {
    id: "figma",
    title: "Figma",
    username: "ayaan@studio.co",
    password: "F1gma-Glass!25",
    url: "figma.com",
    category: "login",
    brand: "figma",
    favorite: true,
    strength: "strong",
    score: 4,
    modified: "Yesterday",
    totp: "889 340",
    tags: ["Studio"],
    folder: "Work",
  },
  {
    id: "notion",
    title: "Studio workspace key",
    username: "ayaan@vaultzero.me",
    password: "N0tion•Notes_42",
    url: "notion.so",
    category: "note",
    brand: "notion",
    favorite: false,
    strength: "fair",
    score: 2,
    modified: "2 days ago",
    note: "Recovery key for the studio Notion workspace. Stored only on this device.",
    tags: ["Studio", "Recovery"],
    folder: "Work",
  },
  {
    id: "dropbox",
    title: "Dropbox",
    username: "ayaan.work@gmail.com",
    password: "summer2024",
    url: "dropbox.com",
    category: "login",
    brand: "dropbox",
    favorite: false,
    strength: "weak",
    score: 1,
    modified: "3 days ago",
    tags: ["Reused", "Personal"],
    folder: "Personal",
  },
  {
    id: "paypal",
    title: "PayPal",
    username: "ayaan@vaultzero.me",
    password: "Pay•Secure#2026",
    url: "paypal.com",
    category: "payment",
    brand: "paypal",
    favorite: false,
    strength: "strong",
    score: 4,
    modified: "4 days ago",
    totp: "150 972",
    tags: ["Finance"],
    folder: "Finance",
  },
  {
    id: "x",
    title: "X / Twitter",
    username: "@ayaanbuilds",
    password: "Blu3Bird!Media",
    url: "x.com",
    category: "login",
    brand: "x",
    favorite: false,
    strength: "fair",
    score: 3,
    modified: "1 week ago",
    tags: ["Social"],
    folder: "Personal",
  },
  {
    id: "spotify",
    title: "Spotify",
    username: "ayaan.music",
    password: "Playlist&Chai7",
    url: "spotify.com",
    category: "login",
    brand: "spotify",
    favorite: false,
    strength: "strong",
    score: 4,
    modified: "1 week ago",
    tags: ["Personal"],
    folder: "Personal",
  },
  {
    id: "identity",
    title: "Personal identity",
    username: "Ayaan Rahman",
    password: "Born 14 Jun 1996",
    url: "",
    category: "identity",
    brand: "vault",
    favorite: false,
    strength: "fair",
    score: 3,
    modified: "2 weeks ago",
    note: "Passport • M1234567 · National ID • 1996140612 · Issued in Dhaka.",
    tags: ["Personal", "ID"],
    folder: "Personal",
  },
  {
    id: "seed-codes",
    title: "MacBook recovery codes",
    username: "VaultZero local backup",
    password: "Offline only",
    url: "",
    category: "note",
    brand: "vault",
    favorite: true,
    strength: "weak",
    score: 2,
    modified: "3 weeks ago",
    note: "Keep the printed emergency kit inside a locked drawer. Master password is never stored digitally.",
    tags: ["Recovery", "Offline"],
    folder: "Personal",
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
    passwordGenerator: "Password generator",
    authenticator: "2FA authenticator",
    securityCenter: "Security center",
    p2pSync: "P2P sync",
    emergencyKit: "Emergency kit",
    folders: "Folders",
    newFolder: "New folder",
    offlineNote: "100% offline",
    offlineCopy: "Everything stays on this device",
    greeting: "Good morning, Ayaan.",
    greetingBn: "শুভ সকাল, আয়ান।",
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
    addFirstItem: "Add first item",
    emptyFolder: "This folder is empty",
    emptyFolderCopy: "A quiet, private place for your next secret. Add anything from a login to a handwritten note.",
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
    passwordGenerator: "পাসওয়ার্ড জেনারেটর",
    authenticator: "২এফএ অথেন্টিকেটর",
    securityCenter: "সিকিউরিটি সেন্টার",
    p2pSync: "পিটুপি সিঙ্ক",
    emergencyKit: "ইমার্জেন্সি কিট",
    folders: "ফোল্ডার",
    newFolder: "নতুন ফোল্ডার",
    offlineNote: "সম্পূর্ণ অফলাইন",
    offlineCopy: "সবকিছু এই ডিভাইসেই থাকে",
    greeting: "শুভ সকাল, আয়ান।",
    greetingBn: "শুভ সকাল, আয়ান।",
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
    addFirstItem: "প্রথম আইটেম যোগ করুন",
    emptyFolder: "এই ফোল্ডারটি খালি",
    emptyFolderCopy: "আপনার পরবর্তী গোপন তথ্যের জন্য শান্ত, ব্যক্তিগত জায়গা। লগইন থেকে হাতে লেখা নোট—যেকোনো কিছু যোগ করুন।",
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
  },
} as const;

export type TranslationKey = keyof (typeof translations)["en"];

export const t = (lang: Language, key: TranslationKey) => translations[lang][key];

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

export async function checkGitHubUpdate(currentVersion = "v2.1.0"): Promise<{ hasUpdate: boolean; latestVersion?: string; downloadUrl?: string } | null> {
  try {
    const res = await fetch("https://api.github.com/repos/tonmoycoder/VaultZero/releases/latest", {
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const tag = data.tag_name;
    if (tag && tag !== currentVersion) {
      const exeAsset = (data.assets || []).find((a: any) => typeof a.name === "string" && a.name.endsWith(".exe"));
      return {
        hasUpdate: true,
        latestVersion: tag,
        downloadUrl: exeAsset ? exeAsset.browser_download_url : data.html_url,
      };
    }
    return { hasUpdate: false };
  } catch {
    return null;
  }
}
