// VaultZero Zero-Knowledge Cryptographic Storage Engine (v3 Envelope)
// WebCrypto AES-GCM 256-bit Data Key + PBKDF2-SHA256 (600,000 iterations)
// Multi-slot Key Wrapping, Hardware Keyfile (.vzkey), Duress Vault & Legacy v2 Migration

import type { BrandKey, Strength, VaultItem } from "./vault";
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
          retryable: false,
        } satisfies VaultError;
      }
      const result = await task(scheduledEpoch);
      if (this.epoch !== scheduledEpoch) {
        throw {
          code: "LOCKED",
          safeMessage: "Vault locked while operation was in flight; UI state not updated.",
          retryable: false,
        } satisfies VaultError;
      }
      return result;
    });
    this.chain = next.catch(() => undefined);
    return next;
  }
}

export const vaultMutationQueue = new SerializedMutationQueue();

export type PasswordHistoryEntry = {
  password: string;
  changedAt: string;
};

export interface WrappedKeySlot {
  salt: string;       // hex (16 bytes)
  iv: string;         // hex (12 bytes)
  wrappedKey: string; // hex (AES-GCM encrypted 256-bit raw data key)
  iterations: number; // 600,000 for v3, 100,000 for legacy
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
  masterPassword?: string;
  keyfileHex?: string;
  recoveryKey?: string;
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
// Cryptographic Primitives (WebCrypto AES-GCM + PBKDF2-SHA256)
// ---------------------------------------------------------------------

async function deriveKek(
  password: string,
  salt: Uint8Array,
  iterations: number,
  keyfileBytes?: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  let secretBytes = encoder.encode(password);

  if (keyfileBytes && keyfileBytes.length > 0) {
    // Digest keyfile with SHA-256 and mix with password bytes
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

async function wrapDataKey(
  rawDataKey: Uint8Array,
  kek: CryptoKey,
  salt: Uint8Array,
  iterations: number
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

  const kek = await deriveKek(password, salt, slot.iterations, keyfileBytes);
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

  const key = await deriveKek(password, salt, PBKDF2_ITERATIONS_V2, keyfileBytes);
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

export function isVaultConfigured(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(VAULT_STORAGE_KEY));
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
    await invokeNativeCommand("create_vault", {
      path: "local-vault.pmv",
      masterPassword,
      keyfileContent: kfHex,
      duressPassword: duressPassword || null,
    });
    for (const item of initialItems) {
      await invokeNativeCommand("upsert_entry", {
        entry: {
          id: item.id,
          title: item.title,
          username: item.username,
          password: item.password,
          url: item.url,
          notes: item.note || "",
          folder: item.folder || "",
          category: item.category,
          brand: item.brand,
          is_favorite: item.favorite,
          password_history: (item.passwordHistory || []).map((h) => ({
            password: h.password,
            changed_at: 0,
          })),
          recovery_codes: (item.recoveryCodes || []).map((code) => ({
            code,
            used: false,
          })),
          totp_config: item.totp
            ? {
                secret: "JBSWY3DPEHPK3PXP",
                period: 30,
                digits: 6,
                algorithm: "SHA1",
              }
            : null,
          created_at: 0,
          updated_at: 0,
          hlc_timestamp: 0,
          is_deleted: false,
        },
      });
    }
    // Native path succeeded: the native Rust engine owns the vault from here.
    // Return an in-memory session that mirrors what the native vault holds.
    const nativeItems: VaultItem[] = initialItems.map((item) => ({
      ...item,
      strength: item.strength ?? "strong",
      score: item.score ?? 4,
      modified: item.modified ?? "Recently",
    }));
    const nativeSession: UnlockedSession = {
      isDuress: false,
      items: nativeItems,
      masterPassword,
      keyfileHex: keyfileBytes ? bytesToHex(keyfileBytes) : undefined,
      recoveryKey,
    };
    inMemorySession = nativeSession;
    saveActiveSession(nativeSession);
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

  // 2. Wrap data key for primary slot (PBKDF2-SHA256, 600,000 iterations)
  const primarySalt = crypto.getRandomValues(new Uint8Array(16));
  const primaryKek = await deriveKek(masterPassword, primarySalt, PBKDF2_ITERATIONS_V3, keyfileBytes);
  const primaryKeySlot = await wrapDataKey(rawDataKey, primaryKek, primarySalt, PBKDF2_ITERATIONS_V3);

  // 3. Optional Recovery Key Slot (wraps the exact same primary data key)
  let recoveryKeySlot: WrappedKeySlot | undefined = undefined;
  if (recoveryKey && recoveryKey.trim().length > 0) {
    const recoverySalt = crypto.getRandomValues(new Uint8Array(16));
    const recoveryKek = await deriveKek(recoveryKey.trim(), recoverySalt, PBKDF2_ITERATIONS_V3);
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
    const duressKek = await deriveKek(duressPassword.trim(), duressSalt, PBKDF2_ITERATIONS_V3, keyfileBytes);
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
    hasKeyfile: Boolean(keyfileBytes && keyfileBytes.length > 0),
    primaryKeySlot,
    recoveryKeySlot,
    duressKeySlot,
    duressPayloadSlot,
    payload,
    createdAt: new Date().toISOString(),
  };

  window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(container));

  activeDataKey = dataKey;
  const session: UnlockedSession = {
    isDuress: false,
    items: initialItems,
    masterPassword,
    keyfileHex: keyfileBytes ? bytesToHex(keyfileBytes) : undefined,
    recoveryKey,
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
    const res = await invokeNativeCommand<{ is_unlocked: boolean; is_duress: boolean }>("unlock_vault", {
      path: "local-vault.pmv",
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
      masterPassword: password,
      keyfileHex: keyfileBytes ? bytesToHex(keyfileBytes) : undefined,
    };
    inMemorySession = session;
    saveActiveSession(session);
    return session;
  }

  const container = getStoredVaultContainer();
  if (!container) {
    throw new Error("No vault found on this device. Please create a new vault.");
  }

  if (container.hasKeyfile && (!keyfileBytes || keyfileBytes.length === 0)) {
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
            masterPassword: password,
            keyfileHex: keyfileBytes ? bytesToHex(keyfileBytes) : undefined,
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
      masterPassword: password,
      keyfileHex: keyfileBytes ? bytesToHex(keyfileBytes) : undefined,
    };
    inMemorySession = session;
    saveActiveSession(session);
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
          masterPassword: password,
          keyfileHex: keyfileBytes ? bytesToHex(keyfileBytes) : undefined,
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
          masterPassword: password,
          keyfileHex: keyfileBytes ? bytesToHex(keyfileBytes) : undefined,
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

export async function persistVaultChanges(
  items: VaultItem[],
  session: UnlockedSession
): Promise<void> {
  const container = getStoredVaultContainer();
  if (!container) return;

  const password = session.masterPassword;
  if (!password) return;

  const keyfileBytes = session.keyfileHex ? hexToBytes(session.keyfileHex) : undefined;

  if ("payload" in container) {
    const v3 = container as StoredVaultContainerV3;
    if (session.isDuress && v3.duressKeySlot) {
      const duressDataKey = activeDataKey || (await unwrapDataKey(v3.duressKeySlot, password, keyfileBytes));
      v3.duressPayloadSlot = await encryptPayloadWithDataKey(items, duressDataKey);
    } else {
      const dataKey = activeDataKey || (await unwrapDataKey(v3.primaryKeySlot, password, keyfileBytes));
      v3.payload = await encryptPayloadWithDataKey(items, dataKey);
    }
    window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(v3));
  } else {
    // If legacy v2, re-encrypt slot
    const v2 = container as StoredVaultContainerV2;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKek(password, salt, PBKDF2_ITERATIONS_V2, keyfileBytes);
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
 * Safely archives existing encrypted container to a timestamped backup before resetting vault.
 */
export function archiveAndResetVault(reason = "emergency_reset"): string {
  if (typeof window === "undefined") return "";
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const archiveKey = `vaultzero_archived_${reason}_${ts}`;
  const v2 = window.localStorage.getItem(VAULT_STORAGE_KEY);
  if (v2) {
    window.localStorage.setItem(archiveKey, v2);
  }
  window.localStorage.removeItem(VAULT_STORAGE_KEY);
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  clearActiveSession();
  return archiveKey;
}
