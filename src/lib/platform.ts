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
  message?: string;
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

/**
 * The exact, fixed messages the Rust core may put on the IPC boundary.
 *
 * V-99 / D-01: the classifier used to look for substrings such as `VALID`.
 * That matched "inVALID master password", "File header is inVALID" and
 * "inVALID_FORMAT" alike, so a WRONG master password was reported as
 * "Some of the values entered were not valid." — the Windows screenshot.
 * Real AUTH_FAILED / INVALID_FORMAT / TAMPERED / IO failures were never
 * classified at all. Only exact, known strings are trusted now; anything
 * unknown is UNKNOWN and never leaks internal detail.
 */
const MESSAGE_CODES: Record<string, VaultErrorCode> = {
  ...(Object.fromEntries(
    Object.entries(SAFE_MESSAGES).map(([code, message]) => [message, code]),
  ) as Record<string, VaultErrorCode>),
  // The Rust core's `user_message()` for VaultMissing is slightly longer
  // than the frontend's fixed string. Both must classify identically.
  'No vault was found at this location. Create one to get started.': 'VAULT_MISSING',
};

/**
 * Prefixes of the raw `VaultError` Display strings. Some commands still
 * return `e.to_string()`; map those deterministically instead of guessing
 * from a word buried inside the sentence.
 */
const LEGACY_PREFIX_CODES: ReadonlyArray<readonly [string, VaultErrorCode]> = [
  ['AUTHENTICATION FAILED:', 'AUTH_FAILED'],
  ['AUTHENTICATION ERROR:', 'AUTH_FAILED'],
  ['FILE HEADER IS INVALID', 'INVALID_FORMAT'],
  ['DATA TAMPERING DETECTED', 'TAMPERED'],
  ['CORRUPTED DATA:', 'TAMPERED'],
  ['DECRYPTION FAILED', 'CRYPTO_FAILED'],
  ['CRYPTOGRAPHIC ERROR:', 'CRYPTO_FAILED'],
  ['I/O ERROR:', 'IO'],
  ['STORAGE ERROR:', 'IO'],
  ['SERIALIZATION ERROR:', 'UNKNOWN'],
  ['RAM MEMORY LOCK ERROR:', 'UNKNOWN'],
  ['KEY DERIVATION PARAMETER ERROR:', 'UNKNOWN'],
  ['VAULT IS LOCKED', 'LOCKED'],
  // Tauri's own IPC argument errors are the ONLY genuine VALIDATION case.
  ['INVALID VALUE', 'VALIDATION'],
];

/** Maps a raw native error message onto a stable error code. */
export function classifyNativeError(message: string): VaultErrorCode {
  const raw = String(message ?? '').trim();
  const exact = MESSAGE_CODES[raw];
  if (exact) return exact;

  const upper = raw.toUpperCase();
  // A structured code-only error (e.g. "AUTH_FAILED") is already safe.
  if (Object.prototype.hasOwnProperty.call(SAFE_MESSAGES, upper)) {
    return upper as VaultErrorCode;
  }
  for (const [prefix, code] of LEGACY_PREFIX_CODES) {
    if (upper.startsWith(prefix)) return code;
  }
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
      message: SAFE_MESSAGES.UNSUPPORTED,
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
      message: SAFE_MESSAGES[code],
      safeMessage: SAFE_MESSAGES[code],
      retryable: code === 'IO',
    } satisfies VaultError;
  }
}
