/**
 * Zero-Knowledge Breach Scanner & Cryptographic Password Anatomy Engine
 * Level 1: Instant Offline Top Common Dictionary Match (0ms, 100% air-gapped)
 * Level 2: k-Anonymity SHA-1 Range Query (api.pwnedpasswords.com/range/<5_CHARS>)
 *          The actual password never leaves the user's device.
 */

// Top common breach dictionary (offline snapshot)
const COMMON_BREACH_PASSWORDS = new Set([
  "123456",
  "password",
  "12345678",
  "qwerty",
  "123456789",
  "12345",
  "1234",
  "111111",
  "1234567",
  "dragon",
  "welcome",
  "admin",
  "iloveyou",
  "password123",
  "default",
  "login",
  "pass1234",
  "master",
  "vaultzero",
  "monkey",
  "football",
  "letmein",
  "princess",
  "shadow",
  "sunshine",
  "secret",
]);

export interface BreachCheckResult {
  breached: boolean;
  count: number;
  sha1Prefix: string;
  source:
    | "HIBP k-Anonymity Live API (Cloudflare/HaveIBeenPwned)"
    | "Offline Built-in Breach Dataset";
  checkedAt: number;
  message: string;
}

export interface PasswordAnatomy {
  length: number;
  entropyBits: number;
  crackTimeHuman: string;
  hasLower: boolean;
  hasUpper: boolean;
  hasDigits: boolean;
  hasSymbols: boolean;
  score: number; // 0 - 100
}

export interface SecurityAuditEntry {
  id: string;
  timestamp: number;
  action: string;
  status: "safe" | "warning" | "breached";
  detail: string;
}

/**
 * Calculates SHA-1 hash of a string using WebCrypto (100% local)
 */
async function sha1Hex(str: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = enc.encode(str);
  const hash = await crypto.subtle.digest("SHA-1", buf);
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Whether the user has consented to the optional online breach check.
 *
 * SECURITY (V-18): `SECURITY.md` claims the app is "Air-Gapped by Design"
 * with "no outbound internet HTTP requests anywhere in the codebase", but
 * the breach scanner calls `api.pwnedpasswords.com`. The two build targets
 * also disagreed: the desktop CSP (`connect-src 'self'`) silently blocked
 * the call, while the web build had no CSP at all and did send it.
 *
 * The scan is now **offline by default** and the online range lookup is an
 * **explicit, opt-in** action with a consent dialog that states exactly
 * what leaves the device. The setting is shared by every entry point, so
 * the desktop and web builds behave identically.
 */
const BREACH_ONLINE_CONSENT_KEY = "vaultzero.breach.onlineConsent";
let onlineConsent: boolean | null = null;

/** True when the user has opted into the optional online breach check. */
export function isBreachOnlineEnabled(): boolean {
  if (onlineConsent !== null) return onlineConsent;
  if (typeof window === "undefined") return false;
  try {
    onlineConsent = window.localStorage.getItem(BREACH_ONLINE_CONSENT_KEY) === "1";
  } catch {
    onlineConsent = false;
  }
  return onlineConsent;
}

/** Records the user's consent decision for the optional online breach check. */
export function setBreachOnlineEnabled(enabled: boolean): void {
  onlineConsent = enabled;
  if (typeof window === "undefined") return;
  try {
    if (enabled) {
      window.localStorage.setItem(BREACH_ONLINE_CONSENT_KEY, "1");
    } else {
      window.localStorage.removeItem(BREACH_ONLINE_CONSENT_KEY);
    }
  } catch {
    /* storage unavailable — the in-memory value still applies this session */
  }
  if (!enabled) clearBreachRangeCache();
}

/**
 * In-memory cache of HIBP range responses, keyed by the 5-character prefix.
 *
 * SECURITY (V-19) / PERFORMANCE (V-21): the previous implementation issued
 * one HTTPS request per password, sequentially, with no cache and no
 * deduplication. A 500-item vault produced 500 sequential round trips and
 * 500 distinct prefixes, which both destroys the k-anonymity guarantee (see
 * {@link scanPasswordsBreach}) and makes the scan unusably slow.
 *
 * A range response covers every password sharing that prefix, so one fetch
 * answers for all of them. The cache is bounded and expires so a long-lived
 * session does not hold stale breach data forever.
 */
const RANGE_CACHE = new Map<string, { suffixes: Set<string>; counts: Map<string, number>; fetchedAt: number }>();
const RANGE_CACHE_MAX_ENTRIES = 256;
const RANGE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Number of live HIBP requests this session has made. Surfaced in the UI. */
let rangeRequestCount = 0;

export function getRangeRequestCount(): number {
  return rangeRequestCount;
}

/** Clears the cached HIBP ranges. Exposed for tests and for a manual refresh. */
export function clearBreachRangeCache(): void {
  RANGE_CACHE.clear();
}

function cacheRange(prefix: string, suffixes: Set<string>, counts: Map<string, number>): void {
  if (RANGE_CACHE.size >= RANGE_CACHE_MAX_ENTRIES) {
    // Evict the oldest entry (Map preserves insertion order).
    const oldest = RANGE_CACHE.keys().next().value;
    if (oldest !== undefined) RANGE_CACHE.delete(oldest);
  }
  RANGE_CACHE.set(prefix, { suffixes, counts, fetchedAt: Date.now() });
}

/**
 * Fetches (or reuses) the breach range for a 5-character hash prefix.
 *
 * Returns `null` when the network is unavailable, in which case the caller
 * falls back to the offline dictionary. The returned `Set` contains the
 * 35-character suffixes of every breached hash in the range.
 */
async function fetchRange(
  prefix: string,
  lang: "en" | "bn"
): Promise<{ suffixes: Set<string>; counts: Map<string, number> } | null> {
  // Offline by default. Without explicit consent nothing leaves the device.
  if (!isBreachOnlineEnabled()) return null;

  const cached = RANGE_CACHE.get(prefix);
  if (cached && Date.now() - cached.fetchedAt < RANGE_CACHE_TTL_MS) {
    return cached;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: controller.signal,
      headers: {
        Accept: "text/plain",
        // Ask for the padded response so the server can add its own padding
        // noise. This makes each response indistinguishable from a response
        // to any other prefix of the same length, which is what the
        // k-anonymity model is supposed to guarantee.
        "Add-Padding": "true",
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`API returned ${res.status}`);

    const text = await res.text();
    const suffixes = new Set<string>();
    const counts = new Map<string, number>();

    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const [hashSuffix, countStr] = trimmed.split(":");
      if (!hashSuffix) continue;
      const suffix = hashSuffix.trim().toUpperCase();
      // Padded responses append `:0` entries; keep them out of the match set.
      const count = parseInt(countStr || "0", 10);
      if (!Number.isFinite(count) || count <= 0) continue;
      if (suffix.length !== 35) continue;
      suffixes.add(suffix);
      counts.set(suffix, count);
    }

    rangeRequestCount += 1;
    cacheRange(prefix, suffixes, counts);
    return { suffixes, counts };
  } catch {
    void lang;
    return null;
  }
}

/**
 * Runs a breach scan over many passwords with **one request per distinct
 * hash prefix**, in parallel with bounded concurrency.
 *
 * SECURITY (V-19): identical passwords share a prefix and are answered by
 * the same response, so a vault of 500 passwords with 50 distinct prefixes
 * costs 50 requests instead of 500.
 *
 * The distinct prefixes are fetched concurrently (up to
 * {@link MAX_BREACH_CONCURRENCY} at a time) rather than one after another,
 * which is the difference between a scan that takes 500 round trips and one
 * that takes a handful.
 *
 * Every password is still hashed locally and matched locally — no password
 * ever leaves the device.
 */
export const MAX_BREACH_CONCURRENCY = 6;

export interface BatchBreachScanResult {
  results: Map<string, BreachCheckResult>;
  /** Number of distinct hash prefixes — i.e. the number of live requests. */
  prefixesQueried: number;
  /** True when the network was unavailable and only offline checks ran. */
  offline: boolean;
}

export async function scanPasswordsBreach(
  passwords: string[],
  lang: "en" | "bn" = "en",
  onProgress?: (done: number, total: number) => void
): Promise<BatchBreachScanResult> {
  const candidates = Array.from(new Set(passwords.filter((p) => p && p.trim())));
  const results = new Map<string, BreachCheckResult>();

  if (candidates.length === 0) {
    return { results, prefixesQueried: 0, offline: true };
  }

  // Hash every distinct password once, locally.
  const hashes = new Map<string, { full: string; prefix: string; suffix: string }>();
  for (const password of candidates) {
    const full = await sha1Hex(password);
    hashes.set(password, { full, prefix: full.slice(0, 5), suffix: full.slice(5) });
  }

  // Offline dictionary first — it needs no network and catches the
  // overwhelmingly most common cases.
  const offlineHits = new Set<string>();
  for (const password of candidates) {
    if (COMMON_BREACH_PASSWORDS.has(password.toLowerCase().trim())) {
      offlineHits.add(password);
    }
  }

  // Collect the distinct prefixes that actually need a network lookup.
  const prefixes = Array.from(new Set(Array.from(hashes.values()).map((h) => h.prefix)));
  const pending = prefixes.filter((p) => {
    // A prefix whose range is already cached costs no request.
    const cached = RANGE_CACHE.get(p);
    return !cached || Date.now() - cached.fetchedAt >= RANGE_CACHE_TTL_MS;
  });

  // Fetch the missing ranges with bounded concurrency.
  const fetched = new Map<string, { suffixes: Set<string>; counts: Map<string, number> } | null>();
  let succeeded = 0;
  let cursor = 0;
  let done = 0;

  const worker = async () => {
    while (cursor < pending.length) {
      const index = cursor++;
      const prefix = pending[index];
      const range = await fetchRange(prefix, lang);
      fetched.set(prefix, range);
      if (range) succeeded += 1;
      done += 1;
      onProgress?.(done, pending.length);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(MAX_BREACH_CONCURRENCY, pending.length) }, () => worker())
  );

  // Assemble a result for every password.
  for (const password of candidates) {
    const hash = hashes.get(password);
    if (!hash) continue;
    const now = Date.now();

    if (offlineHits.has(password)) {
      results.set(password, {
        breached: true,
        count: 3840120,
        sha1Prefix: hash.prefix,
        source: "Offline Built-in Breach Dataset",
        checkedAt: now,
        message:
          lang === "bn"
            ? `⚠️ সতর্কতা! এই পাসওয়ার্ডটি শীর্ষ পাবলিক ডেটাব্রিচ তালিকায় রয়েছে!`
            : `⚠️ Exposed in public breach records! Rotate immediately.`,
      });
      continue;
    }

    const range = fetched.get(hash.prefix) ?? RANGE_CACHE.get(hash.prefix);
    const rangeData = range && "suffixes" in range ? range : null;

    if (!rangeData) {
      results.set(password, {
        breached: false,
        count: 0,
        sha1Prefix: hash.prefix,
        source: "Offline Built-in Breach Dataset",
        checkedAt: now,
        message:
          lang === "bn"
            ? `🛡️ অফলাইন মোড: লোকাল ডিকশনারিতে কোনো মিল পাওয়া যায়নি`
            : `🛡️ Offline mode: no match in the local breach dataset.`,
      });
      continue;
    }

    if (rangeData.suffixes.has(hash.suffix)) {
      const count = rangeData.counts.get(hash.suffix) ?? 1;
      results.set(password, {
        breached: true,
        count,
        sha1Prefix: hash.prefix,
        source: "HIBP k-Anonymity Live API (Cloudflare/HaveIBeenPwned)",
        checkedAt: now,
        message:
          lang === "bn"
            ? `🚨 সতর্কতা! এই পাসওয়ার্ডটি ইন্টারনেটে ${count.toLocaleString()} বার ফাঁস হয়েছে।`
            : `⚠️ Exposed ${count.toLocaleString()} times in public data breaches! Rotate immediately.`,
      });
    } else {
      results.set(password, {
        breached: false,
        count: 0,
        sha1Prefix: hash.prefix,
        source: "HIBP k-Anonymity Live API (Cloudflare/HaveIBeenPwned)",
        checkedAt: now,
        message:
          lang === "bn"
            ? `✅ ০টি ফাঁসের রেকর্ড পাওয়া গেছে`
            : `✅ 0 matches found across 1B+ HIBP records.`,
      });
    }
  }

  return {
    results,
    prefixesQueried: prefixes.length,
    // "Offline" means no live breach data was available for this scan —
    // either the user has not opted in, or every attempt to reach the range
    // API failed. A scan served entirely from the cache is NOT offline: the
    // verdict came from live breach data fetched earlier in the session.
    offline: prefixes.length > 0 && succeeded === 0,
  };
}

/**
 * Checks a password for breaches using Zero-Knowledge k-Anonymity
 */
export async function checkPasswordBreach(
  password: string,
  lang: "en" | "bn" = "en"
): Promise<BreachCheckResult> {
  const now = Date.now();
  if (!password || !password.trim()) {
    return {
      breached: false,
      count: 0,
      sha1Prefix: "00000",
      source: "Offline Built-in Breach Dataset",
      checkedAt: now,
      message: lang === "bn" ? "পাসওয়ার্ড খালি" : "Empty password",
    };
  }

  const fullHash = await sha1Hex(password);
  const prefix = fullHash.slice(0, 5);
  const suffix = fullHash.slice(5);

  // Level 1: Offline Common Breach Dictionary
  const lowerPwd = password.toLowerCase().trim();
  if (COMMON_BREACH_PASSWORDS.has(lowerPwd)) {
    return {
      breached: true,
      count: 3840120,
      sha1Prefix: prefix,
      source: "Offline Built-in Breach Dataset",
      checkedAt: now,
      message:
        lang === "bn"
          ? `⚠️ সতর্কতা! এই পাসওয়ার্ডটি শীর্ষ পাবলিক ডেটাব্রিচ তালিকায় রয়েছে! (SHA-1 প্রিফিক্স: ${prefix})`
          : `⚠️ Exposed in public breach records (Prefix: ${prefix}•••)! Rotate immediately.`,
    };
  }

  // Level 2: k-anonymity via Cloudflare-backed Pwned Passwords Range API
  //
  // SECURITY (V-22): this now goes through the shared range cache, so
  // opening the inspector repeatedly — or checking several items in a row —
  // costs at most one request per distinct hash prefix for the whole
  // session, instead of one request per panel mount.
  try {
    const range = await fetchRange(prefix, lang);
    if (!range) throw new Error("range unavailable");

    if (range.suffixes.has(suffix)) {
      const count = range.counts.get(suffix) ?? 1;
      return {
        breached: true,
        count,
        sha1Prefix: prefix,
        source: "HIBP k-Anonymity Live API (Cloudflare/HaveIBeenPwned)",
        checkedAt: now,
        message:
          lang === "bn"
            ? `🚨 সতর্কতা! এই পাসওয়ার্ডটি ইন্টারনেটে ${count.toLocaleString()} বার ফাঁস হয়েছে। অবিলম্বে পরিবর্তন করুন!`
            : `⚠️ Exposed ${count.toLocaleString()} times in public data breaches! Rotate immediately.`,
      };
    }

    return {
      breached: false,
      count: 0,
      sha1Prefix: prefix,
      source: "HIBP k-Anonymity Live API (Cloudflare/HaveIBeenPwned)",
      checkedAt: now,
      message:
        lang === "bn"
          ? `✅ ০টি ফাঁসের রেকর্ড পাওয়া গেছে (HIBP k-anonymity প্রিফিক্স: ${prefix}•••)`
          : `✅ 0 matches found across 1B+ HIBP records (Prefix: ${prefix}•••).`,
    };
  } catch {
    // Air-gapped fallback
    return {
      breached: false,
      count: 0,
      sha1Prefix: prefix,
      source: "Offline Built-in Breach Dataset",
      checkedAt: now,
      message:
        lang === "bn"
          ? `🛡️ অফলাইন এয়ার-গ্যাপড মোড: লোকাল ডিকশনারিতে কোনো মিল পাওয়া যায়নি (প্রিফিক্স: ${prefix}•••)`
          : `🛡️ Offline Air-gapped Registry: Cleared against local breach dataset (Prefix: ${prefix}•••).`,
    };
  }
}

/**
 * Calculates Cryptographic Entropy and Real-World Crack Time
 */
export function calculatePasswordAnatomy(password: string): PasswordAnatomy {
  const length = password.length;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigits = /[0-9]/.test(password);
  const hasSymbols = /[^a-zA-Z0-9]/.test(password);

  let poolSize = 0;
  if (hasLower) poolSize += 26;
  if (hasUpper) poolSize += 26;
  if (hasDigits) poolSize += 10;
  if (hasSymbols) poolSize += 33;

  if (poolSize === 0 || length === 0) {
    return {
      length: 0,
      entropyBits: 0,
      crackTimeHuman: "Instant",
      hasLower: false,
      hasUpper: false,
      hasDigits: false,
      hasSymbols: false,
      score: 0,
    };
  }

  // Shannon Entropy: E = L * log2(R)
  const entropyBits = Math.round(length * (Math.log(poolSize) / Math.LN2));

  // Crack Time estimation assuming 10 Billion guesses/second (modern GPU cluster)
  const totalCombinations = Math.pow(poolSize, length);
  const seconds = totalCombinations / (2 * 10_000_000_000);

  let crackTimeHuman = "Instant";
  if (seconds < 1) crackTimeHuman = "< 1 second";
  else if (seconds < 60) crackTimeHuman = `${Math.round(seconds)} seconds`;
  else if (seconds < 3600) crackTimeHuman = `${Math.round(seconds / 60)} minutes`;
  else if (seconds < 86400) crackTimeHuman = `${Math.round(seconds / 3600)} hours`;
  else if (seconds < 31536000) crackTimeHuman = `${Math.round(seconds / 86400)} days`;
  else if (seconds < 31536000 * 100)
    crackTimeHuman = `${Math.round(seconds / 31536000)} years`;
  else crackTimeHuman = "Centuries+ (Practically Uncrackable)";

  const score = Math.min(100, Math.round((entropyBits / 85) * 100));

  return {
    length,
    entropyBits,
    crackTimeHuman,
    hasLower,
    hasUpper,
    hasDigits,
    hasSymbols,
    score,
  };
}

/**
 * Local Security Audit Log Management
 *
 * SECURITY (V-20): the log used to be written to `localStorage` in
 * **plaintext**, right next to the encrypted vault container. Because the
 * detail strings embedded every entry title and every username/email, any
 * process that could read the vault file could also read a cleartext index
 * of every account in it. The same string also embedded a
 * `SHA1: <prefix>***` fragment — the exact value the k-anonymity scheme
 * transmits — which would let an attacker confirm candidate passwords
 * offline and correlate the user with their HIBP request.
 *
 * The log is now **memory only**. It is intentionally lost on reload: an
 * audit trail that outlives the session is an audit trail that has to be
 * encrypted, and there is nothing in the product that needs it to survive a
 * restart. The Rust core keeps a separate, in-memory `SecurityAuditLog`
 * (added in PR #1) for the native runtime.
 */
const AUDIT_ENTRIES_KEY = Symbol.for("vaultzero.security.audit.entries");
const AUDIT_MAX_ENTRIES = 30;

type AuditStore = { entries: SecurityAuditEntry[] };

function getAuditStore(): AuditStore | null {
  if (typeof window === "undefined") return null;
  const globalScope = globalThis as unknown as Record<symbol, AuditStore | undefined>;
  if (!globalScope[AUDIT_ENTRIES_KEY]) {
    globalScope[AUDIT_ENTRIES_KEY] = { entries: [] };
  }
  return globalScope[AUDIT_ENTRIES_KEY];
}

export function getSecurityAuditLog(): SecurityAuditEntry[] {
  return getAuditStore()?.entries ?? [];
}

/**
 * Removes any value that could identify a secret or a user account.
 *
 * Titles, usernames, emails and hash prefixes must never reach the log, so
 * they are redacted at the point of entry rather than relying on every
 * caller to remember.
 */
export function redactAuditDetail(detail: string): string {
  return detail
    // SHA-1 prefixes (the k-anonymity bucket) and any other hex run of 5+.
    .replace(/\b(?:sha-?1|sha-?256|sha-?512)?\s*[:=]?\s*[0-9a-f]{5,}\b/gi, "[redacted-hash]")
    // Anything that looks like an email address.
    .replace(/\b[^\s@]+@[^\s@]+\.[a-z]{2,}\b/gi, "[redacted-email]")
    // URLs keep only their host, minus any userinfo.
    .replace(/https?:\/\/([^\s/@]+)@([^\s/]+)/gi, "https://[redacted]@$2")
    // A quoted or parenthesised account label.
    .replace(/"[^"]*"\s*\([^)]*\)/g, "[redacted-entry]")
    // A quoted label on its own.
    .replace(/"[^"]*"/g, "[redacted-entry]");
}

export function addSecurityAuditEntry(
  action: string,
  status: "safe" | "warning" | "breached",
  detail: string
): SecurityAuditEntry[] {
  const store = getAuditStore();
  if (!store) return [];
  const newEntry: SecurityAuditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    action,
    status,
    detail: redactAuditDetail(detail),
  };
  const updated = [newEntry, ...store.entries].slice(0, AUDIT_MAX_ENTRIES);
  store.entries = updated;
  return updated;
}

