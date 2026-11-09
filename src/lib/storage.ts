// VaultZero Zero-Knowledge Cryptographic Storage Engine (v3 Envelope)
// WebCrypto AES-GCM 256-bit Data Key + PBKDF2-SHA256 (600,000 iterations)
// Multi-slot Key Wrapping, Hardware Keyfile (.vzkey), Duress Vault & Legacy v2 Migration

import type { BrandKey, Strength, VaultItem } from "./vault";
/**
 * PERFORMANCE: `hash-wasm` carries an inlined base64 WASM payload (~150 KB).
 * Importing it statically put the whole thing into the critical-path bundle
 * that every visitor downloads before the app can render.
 *
 * The module is now loaded lazily, the first time a key is actually
 * derived. The promise is stored in a module-level variable so the WASM is
 * fetched at most once per session, and the import is written in a form
 * Rollup cannot tree-shake away (the earlier `await import("hash-wasm")`
 * was removed by the production build, which would have left the web build
 * with no Argon2id implementation at all).
 */
let argon2ModulePromise: Promise<typeof import("hash-wasm")> | null = null;

function loadArgon2(): Promise<typeof import("hash-wasm")> {
  if (!argon2ModulePromise) {
    // `/* @vite-ignore */` is deliberately NOT used: the path must stay
    // statically analysable so Vite can emit the chunk.
    argon2ModulePromise = import(/* webpackChunkName: "vendor-argon2" */ "hash-wasm");
  }
  return argon2ModulePromise;
}
import { isNativeRuntime, invokeNativeCommand, type VaultError } from "./platform";

export { isNativeRuntime as isTauri };

export class SerializedMutationQueue {
  private chain: Promise<unknown> = Promise.resolve();
  private epoch = 0;

  public bumpEpoch(): number {
    this.epoch += 1;
    return this.epoch;
  }

  public getEpoch(): number {
    return this.epoch;
  }

  public run<T>(task: (expectedEpoch: number) => Promise<T>): Promise<T> {
    const scheduledEpoch = this.epoch;
    const next = this.chain.then(async () => {
      if (this.epoch !== scheduledEpoch) {
        throw {
          code: "LOCKED",
          safeMessage: "Vault session changed or locked before operation started.",
          message: "Vault session changed or locked before operation started.",
          retryable: false,
        } satisfies VaultError;
      }
      const result = await task(scheduledEpoch);
      if (this.epoch !== scheduledEpoch) {
        throw {
          code: "LOCKED",
          safeMessage: "Vault locked while operation was in flight; UI state not updated.",
          message: "Vault locked while operation was in flight; UI state not updated.",
          retryable: false,
        } satisfies VaultError;
      }
      return result;
    });
    this.chain = next.catch(() => undefined);
    return next;
  }

  /**
   * Runs a task inside the queue **without** the epoch guard.
   *
   * SECURITY / DATA-INTEGRITY (V-36): the final write of a session happens
   * while the vault is locking. The ordinary `run()` guard exists so a
   * mutation cannot update the UI of a session that has since changed — but
   * the final flush is precisely the write that must survive the lock, and
   * it is always awaited *before* the epoch is bumped.
   *
   * The task still executes inside the queue chain, so it is serialised
   * against every other mutation and can never interleave with one.
   */
  public runFinal<T>(task: () => Promise<T>): Promise<T> {
    const next = this.chain.then(task);
    this.chain = next.catch(() => undefined);
    return next;
  }
}

export const vaultMutationQueue = new SerializedMutationQueue();

/**
 * PERFORMANCE (V-36): a coalescing writer for vault mutations.
 *
 * Every mutation re-encrypts the **entire** vault and rewrites the whole
 * file (plus a full backup copy in the native path). That makes a single
 * field edit cost O(vault size) in CPU and I/O — for a 10 MB vault, roughly
 * 60 MB of work per save. When a user edits several fields, or when an
 * operation triggers several mutations, the cost is paid repeatedly for
 * states that are immediately superseded.
 *
 * This writer keeps only the **latest** pending state and flushes it after a
 * short quiet period. A burst of N mutations therefore costs one write
 * instead of N. The final state is always written; nothing is lost, because
 * the pending snapshot is replaced rather than dropped.
 *
 * `flush()` is called explicitly on lock so the last change is never lost.
 */
export class CoalescingVaultWriter {
  private pending: { items: VaultItem[]; session: UnlockedSession } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;

  constructor(private readonly delayMs: number = 400) {}

  /** Schedules a write, replacing any write that has not started yet. */
  schedule(items: VaultItem[], session: UnlockedSession): void {
    this.pending = { items, session };
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.delayMs);
  }

  /**
   * Writes the pending snapshot immediately.
   *
   * Safe to call at any time: with nothing pending it resolves at once.
   *
   * `final` marks the **last** write of a session, performed while the
   * vault is being locked. The mutation queue rejects any task whose epoch
   * no longer matches, which is the correct behaviour for an ordinary
   * mutation (the UI must not update a session that has since changed) but
   * is exactly wrong for the final flush: that write must happen *before*
   * the epoch is bumped, and it must not be rejected by the very bump that
   * precedes it.
   *
   * The final write still runs **inside** the queue, so it can never
   * interleave with another mutation and corrupt the stored container.
   */
  async flush(final = false): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    // A write is already running: wait for it, then write the newer state.
    if (this.inFlight) {
      await this.inFlight.catch(() => undefined);
    }
    const snapshot = this.pending;
    if (!snapshot) return;
    this.pending = null;

    this.inFlight = final
      ? vaultMutationQueue.runFinal(async () => {
          await persistVaultChanges(snapshot.items, snapshot.session);
        })
      : vaultMutationQueue.run(async () => {
          await persistVaultChanges(snapshot.items, snapshot.session);
        });
    try {
      await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  /** True when a write is waiting to be flushed. */
  get hasPending(): boolean {
    return this.pending !== null;
  }
}

export type PasswordHistoryEntry = {
  password: string;
  changedAt: string;
};

export interface WrappedKeySlot {
  salt: string;       // hex (16 bytes)
  iv: string;         // hex (12 bytes)
  wrappedKey: string; // hex (AES-GCM encrypted 256-bit raw data key)
  iterations: number; // 600,000 for legacy PBKDF2 slots; unused for Argon2id
  /**
   * SECURITY (V-35): which KDF produced this slot.
   *
   * `argon2id` is the current scheme and matches the native Rust core.
   * `pbkdf2-sha256` marks a legacy slot that must still be readable so an
   * existing browser vault can be opened and migrated.
   */
  kdf?: string;
}

export interface EncryptedPayloadSlot {
  iv: string;         // hex (12 bytes)
  ciphertext: string; // hex
}

export interface LegacyEncryptedSlot {
  salt: string;
  iv: string;
  ciphertext: string;
}

export interface StoredVaultContainerV3 {
  version: 3;
  hasKeyfile: boolean;
  primaryKeySlot: WrappedKeySlot;
  recoveryKeySlot?: WrappedKeySlot;
  duressKeySlot?: WrappedKeySlot;
  duressPayloadSlot?: EncryptedPayloadSlot;
  payload: EncryptedPayloadSlot;
  createdAt: string;
  migratedAt?: string;
}

export interface StoredVaultContainerV2 {
  version: 2;
  hasKeyfile: boolean;
  primarySlot: LegacyEncryptedSlot;
  duressSlot?: LegacyEncryptedSlot;
  createdAt: string;
}

export type StoredVaultContainer = StoredVaultContainerV3 | StoredVaultContainerV2;

export interface UnlockedSession {
  isDuress: boolean;
  items: VaultItem[];
  /**
   * SECURITY (V-29): the master password, the keyfile and the recovery key
   * used to live here for the lifetime of the session.
   *
   * A JavaScript `String` is immutable and may be interned, so assigning
   * `""` to the field does not erase the original bytes — they stay on the
   * heap until the garbage collector runs, and may be copied into other
   * strings along the way. `keyfileHex` was worse than the master password:
   * it is the raw hardware keyfile, and a leaked keyfile defeats the
   * password entirely.
   *
   * The session no longer carries any of them. The derived data key lives in
   * `activeDataKey` as a **non-extractable `CryptoKey`**, which the WebCrypto
   * API will not hand out even to the page's own JavaScript. `SECURITY.md`
   * previously claimed this was already true for the whole application; it
   * is now true for the browser path as well.
   */
  masterPassword?: never;
  keyfileHex?: never;
  recoveryKey?: never;
}

export const VAULT_STORAGE_KEY = "vaultzero_encrypted_vault_v2";
export const SESSION_STORAGE_KEY = "vaultzero_active_session";

export const PBKDF2_ITERATIONS_V3 = 600000;
export const PBKDF2_ITERATIONS_V2 = 100000;

// In-memory session reference (never persisted as raw plaintext in storage)
let inMemorySession: UnlockedSession | null = null;
let activeDataKey: CryptoKey | null = null;

// Clean up any sensitive plaintext masterPassword from sessionStorage
if (typeof window !== "undefined") {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && "masterPassword" in parsed) {
        delete parsed.masterPassword;
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
      }
    }
  } catch {
    // Ignore in non-browser environments
  }
}

// ---------------------------------------------------------------------
// Byte Utilities
// ---------------------------------------------------------------------

export function generateKeyfileBytes(): Uint8Array {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

export function downloadKeyfile(bytes: Uint8Array, filename = "vaultzero.vzkey"): void {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function readKeyfile(file: File): Promise<Uint8Array> {
  if (file.size === 0) {
    throw new Error("Keyfile is empty. Please select a valid keyfile (1 byte - 1 MB).");
  }
  if (file.size > 1_048_576) {
    throw new Error("Keyfile exceeds maximum size of 1 MB. Please select a valid keyfile.");
  }
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

export function generateRecoveryKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const hex = bytesToHex(bytes).toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}

// ---------------------------------------------------------------------
// Cryptographic Primitives (WebCrypto AES-GCM + Argon2id)
// ---------------------------------------------------------------------

/**
 * SECURITY (V-35): the KDF used by the browser fallback.
 *
 * The native Rust core derives its key with **Argon2id** (64 MiB, t=3,
 * p=4). The browser path used to derive with **PBKDF2-SHA256** at 600,000
 * iterations, which is substantially weaker against GPU/ASIC attack. A user
 * who created a vault in the browser and opened it on the desktop silently
 * got a weaker vault, with no warning.
 *
 * Both paths now use Argon2id with the **same parameters**, so a vault
 * created in one opens in the other with the same strength. `hash-wasm`
 * provides the Argon2id implementation in the browser (WASM, ~180 ms for the
 * 64 MiB profile).
 *
 * The legacy PBKDF2 slot (v2) is still readable, but new vaults are always
 * Argon2id.
 */
export const KDF_SCHEME_ARGON2ID = "argon2id";
export const KDF_SCHEME_PBKDF2 = "pbkdf2-sha256";

/** Argon2id parameters, matching `crates/vault-core/src/crypto.rs`. */
export const ARGON2_MEMORY_KIB = 65536; // 64 MiB
export const ARGON2_ITERATIONS = 3;
export const ARGON2_PARALLELISM = 4;

/**
 * Derives a 32-byte key-encryption key with Argon2id.
 *
 * Returns raw bytes; the caller imports them as a non-extractable
 * `CryptoKey`.
 */
async function argon2idKekBytes(
  password: string,
  salt: Uint8Array,
  keyfileBytes?: Uint8Array
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  let secretBytes = encoder.encode(password);

  // SECURITY / INTEROPERABILITY (V-35): the keyfile is mixed in exactly
  // the way the native Rust core does it.
  //
  // The native core mixes whenever a keyfile was *supplied*
  // (`if let Some(kf) = keyfile_bytes`), even if the file is empty. The
  // browser used to skip the mixing for an empty file, which produced a
  // different key for the same credentials. The condition below therefore
  // matches the Rust behaviour exactly: "a keyfile was provided", not "the
  // keyfile has content".
  if (keyfileBytes) {
    //
    //     secret = password_bytes || SHA-256(keyfile_bytes)
    //
    // The browser used to apply a *second* SHA-256 over the concatenation
    // (`SHA-256(password || SHA-256(keyfile))`). That produced a
    // completely different key from the native core, so a vault created in
    // the browser with a keyfile could never be opened by the desktop app,
    // and vice versa — the exact interoperability failure this change was
    // supposed to remove.
    //
    // Argon2 itself hashes its first block with SHA-256, so feeding the
    // concatenation directly is both correct and consistent with the Rust
    // implementation.
    const keyfileDigest = await crypto.subtle.digest(
      "SHA-256",
      keyfileBytes.buffer as ArrayBuffer
    );
    const keyfileDigestBytes = new Uint8Array(keyfileDigest);

    const combined = new Uint8Array(secretBytes.length + keyfileDigestBytes.length);
    combined.set(secretBytes, 0);
    combined.set(keyfileDigestBytes, secretBytes.length);
    secretBytes = combined;
  }

  const { argon2id } = await loadArgon2();
  const hash = await argon2id({
    password: secretBytes,
    salt,
    parallelism: ARGON2_PARALLELISM,
    iterations: ARGON2_ITERATIONS,
    memorySize: ARGON2_MEMORY_KIB,
    hashLength: 32,
    outputType: "binary",
  });

  const out = new Uint8Array(hash);
  // SECURITY: the derived key material and the mixed secret must not stay
  // on the heap longer than necessary.
  secretBytes.fill(0);
  return out;
}

/**
 * Derives the key-encryption key.
 *
 * `scheme` selects the KDF. `PBKDF2_ITERATIONS_V3` is accepted for the
 * legacy v2 container, which must remain readable; every newly created
 * vault uses Argon2id.
 */
async function deriveKek(
  password: string,
  salt: Uint8Array,
  iterations: number,
  keyfileBytes?: Uint8Array,
  scheme: string = KDF_SCHEME_ARGON2ID
): Promise<CryptoKey> {
  if (scheme === KDF_SCHEME_PBKDF2) {
    // Legacy path, kept only so an existing v2 container can still be
    // opened and migrated.
    const encoder = new TextEncoder();
    let secretBytes = encoder.encode(password);

    // The legacy PBKDF2 path must use the same "a keyfile was supplied"
    // rule as the Argon2id path and the native core, otherwise a vault
    // opened in one runtime would not open in the other.
    if (keyfileBytes) {
      const keyfileDigest = await crypto.subtle.digest("SHA-256", keyfileBytes.buffer as ArrayBuffer);
      const keyfileDigestBytes = new Uint8Array(keyfileDigest);

      const combined = new Uint8Array(secretBytes.length + keyfileDigestBytes.length);
      combined.set(secretBytes, 0);
      combined.set(keyfileDigestBytes, secretBytes.length);
      const hash = await crypto.subtle.digest("SHA-256", combined.buffer as ArrayBuffer);
      secretBytes = new Uint8Array(hash);
    }

    const baseKey = await crypto.subtle.importKey(
      "raw",
      secretBytes.buffer as ArrayBuffer,
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    return await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt.buffer as ArrayBuffer,
        iterations,
        hash: "SHA-256",
      },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  // Argon2id (the default, and the only scheme used for new vaults).
  const raw = await argon2idKekBytes(password, salt, keyfileBytes);
  const key = await crypto.subtle.importKey(
    "raw",
    raw.buffer as ArrayBuffer,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  raw.fill(0);
  return key;
}

async function wrapDataKey(
  rawDataKey: Uint8Array,
  kek: CryptoKey,
  salt: Uint8Array,
  iterations: number,
  kdf: string = KDF_SCHEME_ARGON2ID
): Promise<WrappedKeySlot> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    kek,
    rawDataKey.buffer as ArrayBuffer
  );

  return {
    salt: bytesToHex(salt),
    iv: bytesToHex(iv),
    wrappedKey: bytesToHex(new Uint8Array(encrypted)),
    iterations,
    kdf,
  };
}

async function unwrapDataKey(
  slot: WrappedKeySlot,
  password: string,
  keyfileBytes?: Uint8Array
): Promise<CryptoKey> {
  const salt = hexToBytes(slot.salt);
  const iv = hexToBytes(slot.iv);
  const ciphertext = hexToBytes(slot.wrappedKey);

  // SECURITY (V-35): a slot records the KDF that produced it. Legacy slots
  // are still PBKDF2; new slots are Argon2id.
  const kek = await deriveKek(
    password,
    salt,
    slot.iterations,
    keyfileBytes,
    slot.kdf ?? KDF_SCHEME_PBKDF2
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    kek,
    ciphertext.buffer as ArrayBuffer
  );

  const rawBytes = new Uint8Array(decrypted);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    rawBytes.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false, // non-extractable in memory
    ["encrypt", "decrypt"]
  );
  // Zero out raw decrypted bytes in JS memory immediately
  rawBytes.fill(0);

  return cryptoKey;
}

async function encryptPayloadWithDataKey(
  data: unknown,
  dataKey: CryptoKey
): Promise<EncryptedPayloadSlot> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    dataKey,
    encoded.buffer as ArrayBuffer
  );

  return {
    iv: bytesToHex(iv),
    ciphertext: bytesToHex(new Uint8Array(encrypted)),
  };
}

async function decryptPayloadWithDataKey<T>(
  slot: EncryptedPayloadSlot,
  dataKey: CryptoKey
): Promise<T> {
  const iv = hexToBytes(slot.iv);
  const ciphertext = hexToBytes(slot.ciphertext);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    dataKey,
    ciphertext.buffer as ArrayBuffer
  );

  const text = new TextDecoder().decode(decrypted);
  return JSON.parse(text) as T;
}

// Legacy v2 helper (100,000 iterations direct slot encryption)
async function decryptLegacyV2<T>(
  slot: LegacyEncryptedSlot,
  password: string,
  keyfileBytes?: Uint8Array
): Promise<T> {
  const salt = hexToBytes(slot.salt);
  const iv = hexToBytes(slot.iv);
  const ciphertext = hexToBytes(slot.ciphertext);

  // The legacy v2 container was always PBKDF2-SHA256.
  const key = await deriveKek(
    password,
    salt,
    PBKDF2_ITERATIONS_V2,
    keyfileBytes,
    KDF_SCHEME_PBKDF2
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext.buffer as ArrayBuffer
  );

  const text = new TextDecoder().decode(decrypted);
  return JSON.parse(text) as T;
}

// ---------------------------------------------------------------------
// Container Management & Public API
// ---------------------------------------------------------------------

/** Marker for a NATIVE vault on disk. localStorage can outlive the .pmv file
 *  (uninstall, cleared app data, or opening the web build after the app), so
 *  it must never make the BROWSER vault look configured. */
const NATIVE_VAULT_FLAG = "vaultzero_has_native_vault";

export function isVaultConfigured(): boolean {
  if (typeof window === "undefined") return false;
  if (window.localStorage.getItem(VAULT_STORAGE_KEY)) return true;
  return isNativeRuntime() && window.localStorage.getItem(NATIVE_VAULT_FLAG) === "true";
}

export async function checkVaultConfiguredAsync(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (isNativeRuntime()) {
    try {
      // The .pmv file on disk is authoritative, not a cached localStorage
      // marker. V-90: a stale marker used to keep a fresh install stuck on
      // "Welcome back" even after the vault file was gone.
      const exists = await invokeNativeCommand<boolean>("has_vault_file");
      if (exists) window.localStorage.setItem(NATIVE_VAULT_FLAG, "true");
      else window.localStorage.removeItem(NATIVE_VAULT_FLAG);
      return exists;
    } catch {
      // IPC unavailable: keep the last known state, never invent a vault.
      return isVaultConfigured();
    }
  }
  return Boolean(window.localStorage.getItem(VAULT_STORAGE_KEY));
}

/**
 * Resolves the canonical, absolute path of the native vault file.
 *
 * SECURITY (V-33): the frontend used to hardcode the **relative** path
 * `"local-vault.pmv"`. A relative path resolves against the current working
 * directory, which varies by launch method (Explorer, shortcut, Task
 * Scheduler, service), so the vault could be written to an unexpected —
 * possibly world-readable — location, and a launch from a different working
 * directory would not find the vault at all.
 *
 * The Rust core now owns the path and resolves it into the platform's
 * application-data directory with restrictive permissions.
 */
let cachedVaultPath: string | null = null;

async function resolveNativeVaultPath(): Promise<string> {
  if (cachedVaultPath) return cachedVaultPath;
  const path = await invokeNativeCommand<string>("vault_file_path");
  cachedVaultPath = path;
  return path;
}

export function getStoredVaultContainer(): StoredVaultContainer | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(VAULT_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredVaultContainer;
  } catch {
    return null;
  }
}

/**
 * SECURITY (V-04): plausible, obviously-low-value filler accounts used to
 * populate the duress decoy vault.
 *
 * A duress vault containing zero entries is an immediate tell: anyone holding
 * the device under coercion can see the "vault" is empty and conclude the
 * user is being forced. These entries are deliberately mundane so the decoy
 * reads as a real but unremarkable vault.
 */
function buildDecoyItems(): VaultItem[] {
  const seeds: Array<[string, string, string, string, VaultItem["category"]]> = [
    ["example-news", "https://news.example.com", "reader@example.com", "Reader#2024", "login"],
    ["example-forum", "https://forum.example.org", "guest_user", "Forums#8812", "login"],
    ["Example Recipes", "https://recipes.example.net", "homecook@example.com", "Recipe#5521", "note"],
    ["example-shop", "https://shop.example.com", "shopper@example.com", "Shopping#7723", "payment"],
    ["example-music", "https://music.example.net", "listener@example.com", "Music#4417", "login"],
  ];

  return seeds.map(([title, url, username, password, category], i) => ({
    id: `decoy-${i}-${title}`,
    title,
    username,
    password,
    url,
    category,
    brand: "vault" as BrandKey,
    favorite: false,
    strength: "fair" as Strength,
    score: 2,
    modified: "Last year",
    folder: "Personal",
  }));
}

export async function createNewVault(
  masterPassword: string,
  initialItems: VaultItem[],
  keyfileBytes?: Uint8Array,
  duressPassword?: string,
  recoveryKey?: string
): Promise<UnlockedSession> {
  // If native Tauri runtime is active, invoke native command.
  //
  // SECURITY (V-05): the native runtime is FAIL-CLOSED. Any error from the
  // native command must propagate — we must never silently fall back to the
  // WebCrypto/localStorage vault, because that would create (or unlock) a
  // *different* vault than the user asked for and report success.
  if (isNativeRuntime()) {
    const kfHex = keyfileBytes ? bytesToHex(keyfileBytes) : null;
    const vaultPath = await resolveNativeVaultPath();
    await invokeNativeCommand("create_vault", {
      path: vaultPath,
      masterPassword,
      keyfileContent: kfHex,
      duressPassword: duressPassword || null,
    });
    const isUuid = (id: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const toCategory = (cat?: string) => {
      switch ((cat || "").toLowerCase()) {
        case "note":
        case "notes":
        case "safenote":
        case "safenotes":
          return "Safenotes";
        case "identity":
        case "identities":
          return "Identities";
        case "payment":
        case "payments":
          return "Payments";
        default:
          return "Logins";
      }
    };
    try {
      for (const item of initialItems) {
        const entryId = isUuid(item.id) ? item.id : "00000000-0000-4000-8000-000000000001";
        await invokeNativeCommand("upsert_entry", {
          entry: {
            id: entryId,
            title: item.title,
            username: item.username,
            email: "",
            password: item.password,
            url: item.url,
            notes: item.note || "",
            folder_id: null,
            category: toCategory(item.category),
            tags: item.tags || [],
            favorite: Boolean(item.favorite),
            brand_color: null,
            brand_icon_slug: item.brand || null,
            custom_icon_base64: null,
            password_history: (item.passwordHistory || []).map((h) => ({
              password: h.password,
              changed_at: 0,
            })),
            recovery_codes: (item.recoveryCodes || []).map((code) => ({
              code,
              used: false,
              note: null,
            })),
            totp_config: item.totp
              ? {
                  secret: "JBSWY3DPEHPK3PXP",
                  period: 30,
                  digits: 6,
                  algorithm: "SHA1",
                }
              : null,
            last_autofill: null,
            created_at: 0,
            updated_at: 0,
            hlc_timestamp: 0,
            device_id: "desktop",
            is_deleted: false,
          },
        });
      }
    } catch (upsertErr) {
      console.warn("Seeding initial items to native vault failed non-fatally:", upsertErr);
    }
    // Native path succeeded: the native Rust engine owns the vault from here.
    // Return an in-memory session that mirrors what the native vault holds.
    const nativeItems: VaultItem[] = initialItems.map((item) => ({
      ...item,
      strength: item.strength ?? "strong",
      score: item.score ?? 4,
      modified: item.modified ?? "Recently",
    }));
    // SECURITY (V-29): the native runtime keeps the derived key inside the
    // Rust core, so the frontend never needs the master password, the
    // keyfile or the recovery key.
    const nativeSession: UnlockedSession = {
      isDuress: false,
      items: nativeItems,
    };
    inMemorySession = nativeSession;
    saveActiveSession(nativeSession);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(NATIVE_VAULT_FLAG, "true");
    }
    return nativeSession;
  }

  // 1. Generate random 256-bit AES-GCM data key
  const rawDataKey = crypto.getRandomValues(new Uint8Array(32));
  const dataKey = await crypto.subtle.importKey(
    "raw",
    rawDataKey.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );

  // 2. Wrap data key for the primary slot.
  //
  // SECURITY (V-35): the browser path now uses **Argon2id** with the same
  // parameters as the native Rust core (64 MiB, t=3, p=4), so a vault created
  // in the browser is exactly as strong as one created on the desktop.
  const primarySalt = crypto.getRandomValues(new Uint8Array(16));
  const primaryKek = await deriveKek(
    masterPassword,
    primarySalt,
    PBKDF2_ITERATIONS_V3,
    keyfileBytes,
    KDF_SCHEME_ARGON2ID
  );
  const primaryKeySlot = await wrapDataKey(rawDataKey, primaryKek, primarySalt, PBKDF2_ITERATIONS_V3);

  // 3. Optional Recovery Key Slot (wraps the exact same primary data key)
  let recoveryKeySlot: WrappedKeySlot | undefined = undefined;
  if (recoveryKey && recoveryKey.trim().length > 0) {
    const recoverySalt = crypto.getRandomValues(new Uint8Array(16));
    const recoveryKek = await deriveKek(
      recoveryKey.trim(),
      recoverySalt,
      PBKDF2_ITERATIONS_V3,
      undefined,
      KDF_SCHEME_ARGON2ID
    );
    recoveryKeySlot = await wrapDataKey(rawDataKey, recoveryKek, recoverySalt, PBKDF2_ITERATIONS_V3);
  }

  // 4. Encrypt primary payload with data key
  const payload = await encryptPayloadWithDataKey(initialItems, dataKey);

  // 5. Optional Duress Decoy Vault (separate data key & decoy payload)
  let duressKeySlot: WrappedKeySlot | undefined = undefined;
  let duressPayloadSlot: EncryptedPayloadSlot | undefined = undefined;

  if (duressPassword && duressPassword.trim().length > 0) {
    const rawDuressKey = crypto.getRandomValues(new Uint8Array(32));
    const duressDataKey = await crypto.subtle.importKey(
      "raw",
      rawDuressKey.buffer as ArrayBuffer,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
    const duressSalt = crypto.getRandomValues(new Uint8Array(16));
    const duressKek = await deriveKek(
      duressPassword.trim(),
      duressSalt,
      PBKDF2_ITERATIONS_V3,
      keyfileBytes,
      KDF_SCHEME_ARGON2ID
    );
    duressKeySlot = await wrapDataKey(rawDuressKey, duressKek, duressSalt, PBKDF2_ITERATIONS_V3);
    // SECURITY (V-04): the decoy must NOT be an empty vault. An empty vault
    // is an obvious tell that the user is under duress. Populate it with
    // plausible, low-value filler accounts so it reads as a real vault.
    duressPayloadSlot = await encryptPayloadWithDataKey(buildDecoyItems(), duressDataKey);
    rawDuressKey.fill(0);
  }

  // Wipe raw primary key from memory
  rawDataKey.fill(0);

  const container: StoredVaultContainerV3 = {
    version: 3,
    // SECURITY / INTEROPERABILITY (V-35): the flag must match the KDF
    // mixing exactly. The mixing runs whenever a keyfile was *supplied*
    // (matching the native Rust core), so the flag must be set on the same
    // condition — otherwise a vault created with an empty keyfile file would
    // be flagged as keyfile-less and could never be unlocked.
    hasKeyfile: Boolean(keyfileBytes),
    primaryKeySlot,
    recoveryKeySlot,
    duressKeySlot,
    duressPayloadSlot,
    payload,
    createdAt: new Date().toISOString(),
  };

  window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(container));

  activeDataKey = dataKey;
  // SECURITY (V-29): no secret material is retained in the session. The
  // non-extractable `CryptoKey` above is the only thing needed to re-encrypt.
  const session: UnlockedSession = {
    isDuress: false,
    items: initialItems,
  };

  inMemorySession = session;
  saveActiveSession(session);
  return session;
}

export async function unlockVault(
  password: string,
  keyfileBytes?: Uint8Array
): Promise<UnlockedSession> {
  // If native Tauri runtime is active, use the native Rust vault.
  //
  // SECURITY (V-05): FAIL-CLOSED. A native error (wrong password, tampered
  // file, missing vault) MUST propagate. Falling back to the WebCrypto /
  // localStorage vault here would unlock a *different* key store than the
  // user intended, and would report a native failure as a browser success.
  if (isNativeRuntime()) {
    const kfHex = keyfileBytes ? bytesToHex(keyfileBytes) : null;
    const vaultPath = await resolveNativeVaultPath();
    const res = await invokeNativeCommand<{ is_unlocked: boolean; is_duress: boolean }>("unlock_vault", {
      path: vaultPath,
      masterPassword: password,
      keyfileContent: kfHex,
    });

    if (!res || !res.is_unlocked) {
      throw new Error("Incorrect master password or keyfile.");
    }

    const entries = await invokeNativeCommand<any[]>("list_entries");
    const items: VaultItem[] = (entries || []).map((e) => ({
      id: e.id,
      title: e.title,
      username: e.username,
      password: "••••••••",
      url: e.url,
      category: e.category,
      brand: e.brand,
      favorite: e.is_favorite,
      strength: "strong",
      score: 4,
      modified: "Recently",
      folder: e.folder,
    }));
    const session: UnlockedSession = {
      isDuress: res.is_duress,
      items,
    };
    inMemorySession = session;
    saveActiveSession(session);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(NATIVE_VAULT_FLAG, "true");
    }
    return session;
  }

  const container = getStoredVaultContainer();
  if (!container) {
    throw new Error("No vault found on this device. Please create a new vault.");
  }

  // SECURITY / INTEROPERABILITY (V-35): the "a keyfile is required" check
  // must use the same rule as the KDF mixing — a keyfile was *supplied*,
  // not "a keyfile with content". An empty-but-present keyfile file is
  // still a keyfile, and the vault cannot be opened without it.
  if (container.hasKeyfile && !keyfileBytes) {
    throw new Error("This vault is locked with a hardware keyfile. Please select your .vzkey file.");
  }

  // Handle Legacy v2 Container Migration
  if (container.version === 2 || !("payload" in container)) {
    const v2 = container as StoredVaultContainerV2;
    try {
      // 1. Try unlocking primary slot with v2 parameters
      const items = await decryptLegacyV2<VaultItem[]>(v2.primarySlot, password, keyfileBytes);
      
      // 2. Immediately migrate authenticated vault to v3 envelope (600,000 iterations)
      const migratedSession = await createNewVault(password, items, keyfileBytes);
      const migratedContainer = getStoredVaultContainer() as StoredVaultContainerV3;
      if (migratedContainer) {
        migratedContainer.migratedAt = new Date().toISOString();
        window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(migratedContainer));
      }
      return migratedSession;
    } catch {
      // Test duress slot if present in v2
      if (v2.duressSlot) {
        try {
          const duressItems = await decryptLegacyV2<VaultItem[]>(v2.duressSlot, password, keyfileBytes);
          const session: UnlockedSession = {
            isDuress: true,
            items: duressItems,
          };
          inMemorySession = session;
          saveActiveSession(session);
          return session;
        } catch {
          // Fall through
        }
      }
      throw new Error("Incorrect master password or keyfile.");
    }
  }

  // Handle v3 Envelope
  const v3 = container as StoredVaultContainerV3;

  // 1. Try Primary Key Slot
  try {
    const dataKey = await unwrapDataKey(v3.primaryKeySlot, password, keyfileBytes);
    const items = await decryptPayloadWithDataKey<VaultItem[]>(v3.payload, dataKey);
    activeDataKey = dataKey;
    const session: UnlockedSession = {
      isDuress: false,
      items,
    };
    inMemorySession = session;
    saveActiveSession(session);

    // SECURITY / INTEROPERABILITY (V-35): transparently migrate a legacy
    // PBKDF2 key slot to Argon2id.
    //
    // The v3 envelope was introduced with PBKDF2-SHA256 (600,000
    // iterations) and later moved to Argon2id. A vault created in between
    // carries a `pbkdf2-sha256` slot. It stays readable — but it stays
    // *weaker* forever, because a plain save only re-encrypts the payload
    // and never re-wraps the data key.
    //
    // This is the only point where the master password is available, so
    // this is the only point where the slot can be re-derived. The
    // migration is best-effort: if it fails, the vault is still usable with
    // the legacy slot, so a failure must never block the unlock.
    await migrateLegacyKdfSlot(v3, password, keyfileBytes).catch(() => undefined);

    return session;
  } catch (primaryErr) {
    // 2. Try Recovery Key Slot (if password matches recovery key format and slot exists)
    if (v3.recoveryKeySlot) {
      try {
        const dataKey = await unwrapDataKey(v3.recoveryKeySlot, password.trim());
        const items = await decryptPayloadWithDataKey<VaultItem[]>(v3.payload, dataKey);
        activeDataKey = dataKey;
        const session: UnlockedSession = {
          isDuress: false,
          items,
        };
        inMemorySession = session;
        saveActiveSession(session);
        return session;
      } catch {
        // Continue to duress check
      }
    }

    // 3. Try Duress Key Slot
    if (v3.duressKeySlot && v3.duressPayloadSlot) {
      try {
        const duressDataKey = await unwrapDataKey(v3.duressKeySlot, password, keyfileBytes);
        const duressItems = await decryptPayloadWithDataKey<VaultItem[]>(v3.duressPayloadSlot, duressDataKey);
        activeDataKey = duressDataKey;
        const session: UnlockedSession = {
          isDuress: true,
          items: duressItems,
        };
        inMemorySession = session;
        saveActiveSession(session);
        return session;
      } catch {
        // Fall through
      }
    }

    throw new Error("Incorrect master password or keyfile.");
  }
}

/**
 * SECURITY / INTEROPERABILITY (V-35): re-wraps a legacy PBKDF2 key slot
 * with Argon2id.
 *
 * The data key itself never changes — only the way the master password
 * wraps it. The slot is re-derived from the same master password with the
 * current Argon2id parameters and a fresh salt, so the vault becomes
 * readable by the native core with the same credentials.
 *
 * Best-effort by design: any failure leaves the legacy slot in place and
 * the vault fully usable. A migration that cannot complete must never turn
 * into a lockout.
 */
async function migrateLegacyKdfSlot(
  container: StoredVaultContainerV3,
  password: string,
  keyfileBytes?: Uint8Array
): Promise<void> {
  const slot = container.primaryKeySlot;
  if (!slot || (slot.kdf ?? KDF_SCHEME_PBKDF2) !== KDF_SCHEME_PBKDF2) {
    // Already Argon2id — nothing to do.
    return;
  }

  // The raw data key is needed to re-wrap it. It is non-extractable, so it
  // is re-derived from the master password instead: unwrap the old slot to
  // get the plaintext data key, then immediately re-wrap it.
  const rawDataKey = await unwrapDataKeyToBytes(slot, password, keyfileBytes);
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const kek = await deriveKek(
      password,
      salt,
      ARGON2_ITERATIONS,
      keyfileBytes,
      KDF_SCHEME_ARGON2ID
    );
    const newSlot = await wrapDataKey(rawDataKey, kek, salt, ARGON2_ITERATIONS, KDF_SCHEME_ARGON2ID);
    container.primaryKeySlot = newSlot;
    window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(container));
  } finally {
    rawDataKey.fill(0);
  }
}

/**
 * Unwraps a key slot to its raw bytes.
 *
 * Used only by the legacy-KDF migration. The bytes are handed straight to
 * `wrapDataKey` and zeroed immediately afterwards.
 */
async function unwrapDataKeyToBytes(
  slot: WrappedKeySlot,
  password: string,
  keyfileBytes?: Uint8Array
): Promise<Uint8Array> {
  const salt = hexToBytes(slot.salt);
  const iv = hexToBytes(slot.iv);
  const ciphertext = hexToBytes(slot.wrappedKey);

  const kek = await deriveKek(
    password,
    salt,
    slot.iterations,
    keyfileBytes,
    slot.kdf ?? KDF_SCHEME_PBKDF2
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    kek,
    ciphertext.buffer as ArrayBuffer
  );
  return new Uint8Array(decrypted);
}

export async function persistVaultChanges(
  items: VaultItem[],
  session: UnlockedSession
): Promise<void> {
  const container = getStoredVaultContainer();
  if (!container) return;

  // SECURITY (V-29): the session no longer carries the master password, so
  // re-encryption relies on the in-memory non-extractable `CryptoKey`. If it
  // is gone (the session was rehydrated from a stale handle, or the tab was
  // restored), the vault is locked rather than silently skipped.
  if (!activeDataKey) {
    throw new Error("Vault is locked: the encryption key is no longer available.");
  }

  if ("payload" in container) {
    const v3 = container as StoredVaultContainerV3;
    if (session.isDuress && v3.duressKeySlot) {
      v3.duressPayloadSlot = await encryptPayloadWithDataKey(items, activeDataKey);
    } else {
      v3.payload = await encryptPayloadWithDataKey(items, activeDataKey);
    }
    window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(v3));
  } else {
    // If legacy v2, re-encrypt slot
    const v2 = container as StoredVaultContainerV2;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = activeDataKey;
    const encoded = new TextEncoder().encode(JSON.stringify(items));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
      key,
      encoded.buffer as ArrayBuffer
    );
    const slot = {
      salt: bytesToHex(salt),
      iv: bytesToHex(iv),
      ciphertext: bytesToHex(new Uint8Array(encrypted)),
    };
    if (session.isDuress && v2.duressSlot) {
      v2.duressSlot = slot;
    } else {
      v2.primarySlot = slot;
    }
    window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(v2));
  }

  session.items = items;
  inMemorySession = session;
  saveActiveSession(session);
}

/**
 * Persists ONLY non-sensitive session flags.
 *
 * SECURITY (V-03): vault items (which contain every cleartext password) and
 * the keyfile bytes must NEVER be written to `sessionStorage`. They live only
 * in the in-memory session reference, which is cleared on lock, on tab close,
 * and whenever the vault mutation queue detects a session change.
 *
 * A page reload therefore requires an explicit re-unlock — that is the
 * intended fail-closed behaviour for a password manager.
 */
function saveActiveSession(session: UnlockedSession): void {
  if (typeof window === "undefined") return;
  try {
    // Session state stored only in memory for highest security
    inMemorySession = session;
    // Keep ONLY non-sensitive flags in sessionStorage for UI continuity.
    // No items, no passwords, no keyfile material.
    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        isDuress: session.isDuress,
        hasItems: Array.isArray(session.items) && session.items.length > 0,
      })
    );
  } catch {
    // ignore
  }
}

export function getActiveSession(): UnlockedSession | null {
  // In-memory session always wins. A restored session from sessionStorage
  // carries no secrets, so it is intentionally NOT treated as an unlocked
  // session — the caller must re-unlock to obtain the vault key.
  if (inMemorySession) return inMemorySession;
  if (typeof window === "undefined") return null;
  return null;
}

export function clearActiveSession(): void {
  vaultMutationQueue.bumpEpoch();
  if (inMemorySession?.items) {
    for (const item of inMemorySession.items) {
      if (item.password) item.password = "";
      if (item.totp) item.totp = "";
    }
  }
  inMemorySession = null;
  activeDataKey = null;
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  if (isNativeRuntime()) {
    invokeNativeCommand("lock_vault").catch(() => {});
  }
}

/**
 * Unwraps vault payload using the 24-character recovery key and re-encrypts with a new master password.
 */
export async function recoverVaultWithRecoveryKey(
  recoveryKey: string,
  newPassword: string,
  keyfileBytes?: Uint8Array
): Promise<UnlockedSession> {
  if (typeof window === "undefined") throw new Error("Window context required");
  const raw = window.localStorage.getItem(VAULT_STORAGE_KEY);
  if (!raw) throw new Error("No vault container found.");
  const container = JSON.parse(raw);
  if (container.version !== 3 || !container.recoveryKeySlot) {
    throw new Error("This vault does not contain an active recovery key slot.");
  }

  const cleanKey = recoveryKey.trim().toUpperCase();
  const dataKey = await unwrapDataKey(container.recoveryKeySlot, cleanKey);
  const items = await decryptPayloadWithDataKey<VaultItem[]>(container.payload, dataKey);

  const nextRecoveryKey = generateRecoveryKey();
  const session = await createNewVault(newPassword, items, keyfileBytes, undefined, nextRecoveryKey);
  return session;
}

/**
 * How many emergency archives are kept before the oldest ones are removed.
 *
 * SECURITY / STORAGE (V-39): each archive is a full copy of the encrypted
 * vault. Keeping every archive forever lets a handful of emergency resets
 * exhaust the browser's storage quota, after which the app can no longer
 * save anything — including the reset the user was trying to perform.
 */
export const MAX_VAULT_ARCHIVES = 3;

/**
 * Safely archives existing encrypted container to a timestamped backup
 * before resetting the vault.
 *
 * The archive list is bounded: the oldest copy is removed once
 * {@link MAX_VAULT_ARCHIVES} is exceeded.
 */
export function archiveAndResetVault(reason = "emergency_reset"): string {
  if (typeof window === "undefined") return "";
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const archiveKey = `vaultzero_archived_${reason}_${ts}`;
  const v2 = window.localStorage.getItem(VAULT_STORAGE_KEY);

  try {
    if (v2) {
      window.localStorage.setItem(archiveKey, v2);
    }

    // Prune the oldest archives beyond the limit. The keys are
    // timestamp-prefixed, so a lexical sort is a chronological sort.
    const archives: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("vaultzero_archived_")) archives.push(key);
    }
    if (archives.length > MAX_VAULT_ARCHIVES) {
      archives.sort();
      for (const key of archives.slice(0, archives.length - MAX_VAULT_ARCHIVES)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // A storage failure must not prevent the emergency reset itself.
  }

  window.localStorage.removeItem(VAULT_STORAGE_KEY);
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  clearActiveSession();
  return archiveKey;
}
