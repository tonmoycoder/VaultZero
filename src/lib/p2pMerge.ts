/**
 * V-52 — Real P2P receive & merge.
 *
 * `sync_vault_payload` returns the peer's vault as a JSON string (the Rust
 * `Vault` struct on native, a plain `VaultItem[]` in the browser build).
 * The old UI only displayed "Received encrypted vault snapshot (N bytes)" —
 * it never parsed or merged anything, so "Receive & Merge" was a dead button.
 *
 * This module validates the untrusted peer payload (size, shape, field
 * types, entry count), normalises both representations into `VaultItem`s,
 * and merges by id without ever overwriting a local edit. No secrets are
 * logged and no field is spread wholesale (prototype-pollution safe).
 */
import type { BrandKey, Category, Strength, VaultItem } from "./vault";

const MAX_PAYLOAD_BYTES = 8_000_000;
const MAX_ENTRIES = 5_000;
const MAX_TEXT = 4_096;

const BRAND_KEYS: BrandKey[] = ["google", "github", "apple", "dropbox", "notion", "figma", "paypal", "x", "spotify", "vault"];
const CATEGORY_MAP: Record<string, Category> = {
  Logins: "login", Bookmarks: "note", Safenotes: "note", Identities: "identity", Payments: "payment",
  login: "login", note: "note", identity: "identity", payment: "payment",
};

type RawEntry = Record<string, unknown>;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.slice(0, MAX_TEXT) : fallback;
}

function strArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, 64).map((item) => item.slice(0, MAX_TEXT));
}

function inferBrand(entry: RawEntry): BrandKey {
  const slug = text(entry.brand_icon_slug).toLowerCase();
  if ((BRAND_KEYS as string[]).includes(slug)) return slug as BrandKey;
  const hint = `${text(entry.url)} ${text(entry.title)}`.toLowerCase();
  for (const key of BRAND_KEYS) {
    if (key === "vault") continue;
    if (hint.includes(key === "x" ? "twitter" : key === "apple" ? "apple" : key)) return key;
  }
  return "vault";
}

function estimateStrength(password: string): { strength: Strength; score: number } {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  if (score >= 4) return { strength: "strong", score: 4 };
  if (score >= 2) return { strength: "fair", score };
  return { strength: "weak", score: 1 };
}

function timestampLabel(value: unknown): string {
  const seconds = typeof value === "number" && Number.isFinite(value) ? value : 0;
  if (seconds <= 0) return "Just synced";
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? "Just synced" : date.toISOString().slice(0, 10);
}

function normaliseBrowserItem(raw: RawEntry): VaultItem {
  const id = text(raw.id);
  const password = text(raw.password);
  const { strength, score } = estimateStrength(password);
  const brandValue = text(raw.brand).toLowerCase();
  return {
    id,
    title: text(raw.title, "Untitled"),
    username: text(raw.username),
    password,
    url: text(raw.url),
    category: CATEGORY_MAP[text(raw.category)] ?? "login",
    brand: (BRAND_KEYS as string[]).includes(brandValue) ? (brandValue as BrandKey) : inferBrand(raw),
    favorite: raw.favorite === true,
    strength,
    score,
    modified: text(raw.modified, "Just synced"),
    totp: typeof raw.totp === "string" ? raw.totp : undefined,
    recoveryCodes: strArray(raw.recoveryCodes),
    note: text(raw.note),
    tags: strArray(raw.tags),
    folder: typeof raw.folder === "string" ? raw.folder : undefined,
    passwordHistory: Array.isArray(raw.passwordHistory)
      ? raw.passwordHistory
          .filter((entry): entry is RawEntry => typeof entry === "object" && entry !== null)
          .slice(0, 64)
          .map((entry) => ({ password: text(entry.password), changedAt: text(entry.changedAt, "Just synced") }))
      : [],
  };
}

function normaliseRustEntry(raw: RawEntry): VaultItem {
  const id = text(raw.id);
  const password = text(raw.password);
  const { strength, score } = estimateStrength(password);
  const codes = Array.isArray(raw.recovery_codes)
    ? raw.recovery_codes
        .filter((entry): entry is RawEntry => typeof entry === "object" && entry !== null && entry.used !== true)
        .map((entry) => text(entry.code))
        .filter(Boolean)
    : [];
  const history = Array.isArray(raw.password_history)
    ? raw.password_history
        .filter((entry): entry is RawEntry => typeof entry === "object" && entry !== null)
        .slice(0, 64)
        .map((entry) => ({ password: text(entry.password), changedAt: timestampLabel(entry.changed_at) }))
    : [];
  return {
    id,
    title: text(raw.title, "Untitled"),
    username: text(raw.username),
    password,
    url: text(raw.url),
    category: CATEGORY_MAP[text(raw.category)] ?? "login",
    brand: inferBrand(raw),
    favorite: raw.favorite === true,
    strength,
    score,
    modified: timestampLabel(raw.updated_at),
    recoveryCodes: codes,
    note: text(raw.notes),
    tags: strArray(raw.tags),
    passwordHistory: history,
  };
}

/** Parse an untrusted peer snapshot into validated VaultItems. Throws on bad input. */
export function parsePeerVaultPayload(raw: string): VaultItem[] {
  if (typeof raw !== "string" || raw.length === 0) throw new Error("Empty peer payload.");
  if (raw.length > MAX_PAYLOAD_BYTES) throw new Error("Peer payload is too large.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Peer payload is not valid JSON.");
  }

  let entries: unknown[];
  let rust = false;
  if (Array.isArray(parsed)) {
    entries = parsed;
  } else if (parsed && typeof parsed === "object") {
    const object = parsed as RawEntry;
    if (Array.isArray(object.entries)) {
      entries = object.entries;
      rust = true;
    } else if (Array.isArray(object.items)) {
      entries = object.items;
    } else {
      throw new Error("Peer payload has no vault entries.");
    }
  } else {
    throw new Error("Peer payload has an unexpected shape.");
  }
  if (entries.length > MAX_ENTRIES) throw new Error("Peer payload has too many entries.");

  const seen = new Set<string>();
  const items: VaultItem[] = [];
  for (const candidate of entries) {
    if (!candidate || typeof candidate !== "object") continue;
    const entry = candidate as RawEntry;
    if (entry.is_deleted === true) continue;
    const id = text(entry.id);
    if (!id || seen.has(id)) continue;
    if (typeof entry.title !== "string" || typeof entry.password !== "string") continue;
    seen.add(id);
    items.push(rust ? normaliseRustEntry(entry) : normaliseBrowserItem(entry));
  }
  return items;
}

/**
 * Union by id. Local entries win on conflict (the local vault is the one the
 * user is actively editing); only genuinely new ids are appended. Returns the
 * original array when there is nothing to add, so React can skip a re-render.
 */
export function mergeVaultItems(local: VaultItem[], remote: VaultItem[]): VaultItem[] {
  const known = new Set(local.map((item) => item.id));
  const additions = remote.filter((item) => item.id && !known.has(item.id));
  if (additions.length === 0) return local;
  return [...local, ...additions];
}

/**
 * Parse the manual "Connect" field or a scanned QR payload into an address
 * and a pairing PIN. The old UI accepted one free-form string, treated a
 * 6-digit PIN as an address, and then authenticated with the *local* PIN —
 * so connecting to a remote host could never succeed.
 */
/**
 * A peer must be a REAL LAN endpoint: four decimal octets, optionally
 * followed by a port. Truncated IPs (`192.1`), WebView hostnames
 * (`tauri.localhost`), out-of-range octets/ports and ambiguous leading
 * zeros must never become a "selected" or "connected" peer.
 */
export function isValidPeerAddress(value: string): boolean {
  const raw = value.trim();
  const match = /^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{1,5}))?$/.exec(raw);
  if (!match) return false;
  const octets = match[1].split(".");
  if (!octets.every((part) => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255)) return false;
  if (match[2]) {
    const port = Number(match[2]);
    if (port < 1 || port > 65535) return false;
  }
  return true;
}

export function parsePeerInput(input: string): { address: string | null; pin: string | null } {
  const raw = input.trim();
  if (!raw) return { address: null, pin: null };
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const ip = typeof parsed.ip === "string" ? parsed.ip : "";
      const port = typeof parsed.port === "number" ? parsed.port : 0;
      const code = typeof parsed.code === "string" ? parsed.code : "";
      const candidate = ip && port > 0 && port <= 65535 ? `${ip}:${port}` : ip;
      return {
        address: isValidPeerAddress(candidate) ? candidate : null,
        pin: /^\d{6}$/.test(code) ? code : null,
      };
    } catch {
      return { address: null, pin: null };
    }
  }
  const parts = raw.split("/").filter(Boolean);
  let address: string | null = null;
  let pin: string | null = null;
  for (const part of parts) {
    const value = part.trim();
    if (/^\d{6}$/.test(value)) { pin = value; continue; }
    if (isValidPeerAddress(value)) address = value;
  }
  return { address, pin };
}

/** Human-readable result of a merge, used by the UI toast. */
export function mergeSummary(local: VaultItem[], remote: VaultItem[]): { added: number; duplicates: number } {
  const known = new Set(local.map((item) => item.id));
  let added = 0;
  for (const item of remote) {
    if (item.id && !known.has(item.id)) { added += 1; known.add(item.id); }
  }
  return { added, duplicates: remote.length - added };
}
