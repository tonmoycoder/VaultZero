export type VaultErrorCode =
  | 'LOCKED'
  | 'VALIDATION'
  | 'AUTH_FAILED'
  | 'IO'
  | 'CONFLICT'
  | 'UNSUPPORTED';

export interface VaultError {
  code: VaultErrorCode;
  safeMessage: string;
  retryable: boolean;
}

export function isNativeRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// Native error must NEVER silently fall back to browser localStorage vault.
export async function invokeNativeCommand<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isNativeRuntime()) {
    throw {
      code: 'UNSUPPORTED',
      safeMessage: 'Native runtime is not active.',
      retryable: false,
    } satisfies VaultError;
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (err: unknown) {
    // Redact any raw payload; map to safe structured VaultError
    const msg = err instanceof Error ? err.message : String(err ?? 'Native IPC error');
    const code: VaultErrorCode =
      msg.includes('LOCKED') ? 'LOCKED' :
      msg.includes('AUTH') ? 'AUTH_FAILED' :
      msg.includes('VALID') ? 'VALIDATION' : 'IO';
    throw {
      code,
      safeMessage: msg.slice(0, 240),
      retryable: code === 'IO',
    } satisfies VaultError;
  }
}

