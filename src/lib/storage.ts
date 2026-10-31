// VaultZero Zero-Knowledge Cryptographic Storage Engine
// WebCrypto PBKDF2 + AES-GCM 256-bit with Duress Slot & .vzkey hardware keyfile support

import type { VaultItem } from "./vault";
import { isTauri, invokeTauri } from "./vault";

export type PasswordHistoryEntry = {
  password: string;
  changedAt: string;
};

export interface EncryptedSlot {
  salt: string; // hex
  iv: string;   // hex
  ciphertext: string; // hex
}

export interface StoredVaultContainer {
  version: 2;
  hasKeyfile: boolean;
  primarySlot: EncryptedSlot;
  duressSlot?: EncryptedSlot;
  createdAt: string;
}

export interface UnlockedSession {
  isDuress: boolean;
  items: VaultItem[];
  masterPassword?: string;
  keyfileHex?: string;
}

const VAULT_STORAGE_KEY = "vaultzero_encrypted_vault_v2";
const SESSION_STORAGE_KEY = "vaultzero_active_session";

// 32-byte CSPRNG Keyfile generation
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
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

// Key derivation: PBKDF2 (SHA-256, 100,000 iterations)
async function deriveAesKey(
  password: string,
  salt: Uint8Array,
  keyfileBytes?: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  let secretBytes = encoder.encode(password);

  if (keyfileBytes && keyfileBytes.length > 0) {
    // Mix keyfile with password via SHA-256
    const combined = new Uint8Array(secretBytes.length + keyfileBytes.length);
    combined.set(secretBytes, 0);
    combined.set(keyfileBytes, secretBytes.length);
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
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptData(
  data: unknown,
  password: string,
  keyfileBytes?: Uint8Array
): Promise<EncryptedSlot> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt, keyfileBytes);

  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    encoded.buffer as ArrayBuffer
  );

  return {
    salt: bytesToHex(salt),
    iv: bytesToHex(iv),
    ciphertext: bytesToHex(new Uint8Array(encrypted)),
  };
}

async function decryptData<T>(
  slot: EncryptedSlot,
  password: string,
  keyfileBytes?: Uint8Array
): Promise<T> {
  const salt = hexToBytes(slot.salt);
  const iv = hexToBytes(slot.iv);
  const ciphertext = hexToBytes(slot.ciphertext);

  const key = await deriveAesKey(password, salt, keyfileBytes);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext.buffer as ArrayBuffer
  );

  const text = new TextDecoder().decode(decrypted);
  return JSON.parse(text) as T;
}

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

export async function createNewVault(
  masterPassword: string,
  initialItems: VaultItem[],
  keyfileBytes?: Uint8Array,
  duressPassword?: string
): Promise<UnlockedSession> {
  // If Tauri is active, invoke Tauri backend
  if (isTauri()) {
    try {
      const kfHex = keyfileBytes ? bytesToHex(keyfileBytes) : null;
      await invokeTauri("create_vault", {
        path: "local-vault.pmv",
        masterPassword,
        keyfileContent: kfHex,
        duressPassword: duressPassword || null,
      });
      // Save demo item if any
      for (const item of initialItems) {
        await invokeTauri("upsert_entry", {
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
    } catch (err) {
      console.warn("Tauri create_vault error:", err);
    }
  }

  // WebCrypto storage (acts as persistent store for web and fallback)
  const primarySlot = await encryptData(initialItems, masterPassword, keyfileBytes);
  let duressSlot: EncryptedSlot | undefined = undefined;

  if (duressPassword && duressPassword.trim().length > 0) {
    duressSlot = await encryptData([], duressPassword.trim(), keyfileBytes);
  }

  const container: StoredVaultContainer = {
    version: 2,
    hasKeyfile: Boolean(keyfileBytes && keyfileBytes.length > 0),
    primarySlot,
    duressSlot,
    createdAt: new Date().toISOString(),
  };

  window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(container));

  const session: UnlockedSession = {
    isDuress: false,
    items: initialItems,
    masterPassword,
    keyfileHex: keyfileBytes ? bytesToHex(keyfileBytes) : undefined,
  };

  saveActiveSession(session);
  return session;
}

export async function unlockVault(
  password: string,
  keyfileBytes?: Uint8Array
): Promise<UnlockedSession> {
  // If in Tauri, attempt Tauri unlock
  if (isTauri()) {
    try {
      const kfHex = keyfileBytes ? bytesToHex(keyfileBytes) : null;
      const res = await invokeTauri<{ is_unlocked: boolean; is_duress: boolean }>("unlock_vault", {
        path: "local-vault.pmv",
        masterPassword: password,
        keyfileContent: kfHex,
      });
      if (res && res.is_unlocked) {
        // Fetch summaries
        const entries = await invokeTauri<any[]>("list_entries");
        const items: VaultItem[] = (entries || []).map((e) => ({
          id: e.id,
          title: e.title,
          username: e.username,
          password: "••••••••", // secret revealed on inspect
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
        saveActiveSession(session);
        return session;
      }
    } catch (err) {
      console.warn("Tauri unlock error, falling back to WebCrypto:", err);
    }
  }

  const container = getStoredVaultContainer();
  if (!container) {
    throw new Error("No vault found on this device. Please create a new vault.");
  }

  if (container.hasKeyfile && (!keyfileBytes || keyfileBytes.length === 0)) {
    throw new Error("This vault is locked with a hardware keyfile. Please select your .vzkey file.");
  }

  // First try primary vault
  try {
    const items = await decryptData<VaultItem[]>(container.primarySlot, password, keyfileBytes);
    const session: UnlockedSession = {
      isDuress: false,
      items,
      masterPassword: password,
      keyfileHex: keyfileBytes ? bytesToHex(keyfileBytes) : undefined,
    };
    saveActiveSession(session);
    return session;
  } catch (primaryErr) {
    // If duress slot exists, test duress password
    if (container.duressSlot) {
      try {
        const duressItems = await decryptData<VaultItem[]>(container.duressSlot, password, keyfileBytes);
        const session: UnlockedSession = {
          isDuress: true,
          items: duressItems, // Empty or decoy
          masterPassword: password,
          keyfileHex: keyfileBytes ? bytesToHex(keyfileBytes) : undefined,
        };
        saveActiveSession(session);
        return session;
      } catch {
        // Fall through to invalid credentials
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

  const keyfileBytes = session.keyfileHex ? hexToBytes(session.keyfileHex) : undefined;
  const password = session.masterPassword;
  if (!password) return;

  if (session.isDuress && container.duressSlot) {
    container.duressSlot = await encryptData(items, password, keyfileBytes);
  } else {
    container.primarySlot = await encryptData(items, password, keyfileBytes);
  }

  window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(container));
  session.items = items;
  saveActiveSession(session);
}

function saveActiveSession(session: UnlockedSession): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        isDuress: session.isDuress,
        items: session.items,
        masterPassword: session.masterPassword,
        keyfileHex: session.keyfileHex,
      })
    );
  } catch {
    // ignore
  }
}

export function getActiveSession(): UnlockedSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UnlockedSession;
  } catch {
    return null;
  }
}

export function clearActiveSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  if (isTauri()) {
    invokeTauri("lock_vault").catch(() => {});
  }
}
