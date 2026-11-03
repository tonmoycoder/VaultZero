export type VaultErrorCode =
  | 'LOCKED'
  | 'VALIDATION'
  | 'AUTH_FAILED'
  | 'IO'
  | 'CONFLICT'
  | 'UNSUPPORTED'
  | 'TAMPERED'
  | 'INVALID_FORMAT'
  | 'VAULT_MISSING'
  | 'CRYPTO_FAILED'
  | 'UNKNOWN';

export interface VaultError {
  code: VaultErrorCode;
  safeMessage: string;
  retryable: boolean;
}

export function isNativeRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * SECURITY (V-26): the fixed, user-safe message for each error code.
 *
 * The Rust core used to return `e.to_string()` across the IPC boundary, so
 * the UI could show internal detail such as *"File header is invalid or has
 * wrong magic bytes (expected PMV1)"* or *"RAM memory lock error: ..."*.
 * That leaks the file format, the expected magic value and the platform's
 * memory-protection technique to anyone who can trigger an error.
 *
 * The core now returns a stable **code** plus a **fixed** message. Anything
 * that does not match a known code is replaced with a generic message — the
 * raw text is never shown to the user.
 */
const SAFE_MESSAGES: Record<VaultErrorCode, string> = {
  LOCKED: 'The vault is locked. Unlock it and try again.',
  VALIDATION: 'Some of the values entered were not valid.',
  AUTH_FAILED: 'Incorrect master password or keyfile. Nothing was changed.',
  IO: 'The vault file could not be read or written.',
  CONFLICT: 'Another operation is already in progress. Try again shortly.',
  UNSUPPORTED: 'That operation needs the desktop or mobile app; it is not available in the browser.',
  TAMPERED: 'The vault failed its integrity check and was not modified.',
  INVALID_FORMAT: 'This file is not a VaultZero vault, or it is corrupted.',
  VAULT_MISSING: 'No vault was found at this location.',
  CRYPTO_FAILED: 'A cryptographic operation failed. The vault was not modified.',
  UNKNOWN: 'Something went wrong. The vault was not modified.',
};

/** Maps a raw native error message onto a stable error code. */
export function classifyNativeError(message: string): VaultErrorCode {
  const upper = message.toUpperCase();
  if (upper.includes('AUTH_FAILED')) return 'AUTH_FAILED';
  if (upper.includes('VAULT_MISSING')) return 'VAULT_MISSING';
  if (upper.includes('INVALID_FORMAT')) return 'INVALID_FORMAT';
  if (upper.includes('TAMPER')) return 'TAMPERED';
  if (upper.includes('CRYPTO_FAILED')) return 'CRYPTO_FAILED';
  if (upper.includes('LOCKED')) return 'LOCKED';
  if (upper.includes('VALID')) return 'VALIDATION';
  if (upper.includes('CONFLICT')) return 'CONFLICT';
  if (upper.includes('IO_FAILED')) return 'IO';
  return 'UNKNOWN';
}

// Native error must NEVER silently fall back to browser localStorage vault.
export async function invokeNativeCommand<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isNativeRuntime()) {
    throw {
      code: 'UNSUPPORTED',
      safeMessage: SAFE_MESSAGES.UNSUPPORTED,
      retryable: false,
    } satisfies VaultError;
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err ?? 'Native IPC error');
    const code = classifyNativeError(raw);
    // SECURITY (V-26): the raw message is never surfaced. The detailed text
    // stays in the Rust-side log; the user sees a fixed, safe message.
    throw {
      code,
      safeMessage: SAFE_MESSAGES[code],
      retryable: code === 'IO',
    } satisfies VaultError;
  }
}
