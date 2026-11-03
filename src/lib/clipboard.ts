/**
 * Secure Clipboard Auto-Wipe Module
 * Automatically purges sensitive copied credentials from the clipboard after a timeout
 * to minimize exposure to other processes or malicious web pages.
 */

let activeWipeTimer: number | null = null;
let lastCopiedValue: string | null = null;

export interface SecureCopyOptions {
  timeoutMs?: number;
  onWipe?: () => void;
}

export const DEFAULT_CLIPBOARD_WIPE_TIMEOUT_MS = 30_000; // 30 seconds

/**
 * Copies text to the system clipboard and schedules an automatic wipe.
 */
export async function copySecure(
  text: string,
  options: SecureCopyOptions = {}
): Promise<boolean> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_CLIPBOARD_WIPE_TIMEOUT_MS;

  // Clear any existing wipe timer
  clearClipboardWipe();

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      lastCopiedValue = text;

      if (timeoutMs > 0 && typeof window !== "undefined") {
        activeWipeTimer = window.setTimeout(async () => {
          try {
            // Only wipe the clipboard if it still holds the sensitive text we
            // copied. Blindly clearing it would destroy an unrelated value
            // the user copied in the meantime (a real data-loss bug).
            if (navigator.clipboard?.readText) {
              const current = await navigator.clipboard.readText();
              if (current === lastCopiedValue) {
                await navigator.clipboard.writeText("");
              }
            }
            // If `readText` is unavailable we cannot verify ownership, so we
            // deliberately leave the clipboard alone rather than risk wiping
            // unrelated data.
          } catch {
            // Read permission might be blocked — leave the clipboard as-is
            // rather than risk destroying unrelated data.
          } finally {
            lastCopiedValue = null;
            activeWipeTimer = null;
            options.onWipe?.();
          }
        }, timeoutMs);
      }

      return true;
    }
  } catch {
    // Fallback if clipboard API is blocked
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Immediately cancels any active auto-wipe timer **and scrubs the clipboard**.
 *
 * SECURITY (V-06): this is called when the vault auto-locks. Previously the
 * function only cancelled the pending timer and cleared the in-memory
 * bookkeeping, leaving the copied secret sitting in the system clipboard for
 * the next person at the machine to paste.
 *
 * We only overwrite the clipboard if it still holds the value *we* copied.
 * If the user copied something else in the meantime, overwriting it would
 * destroy unrelated data.
 */
export async function clearClipboardWipe(): Promise<void> {
  if (activeWipeTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(activeWipeTimer);
    activeWipeTimer = null;
  }

  const expected = lastCopiedValue;
  lastCopiedValue = null;

  if (!expected || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return;
  }

  try {
    if (navigator.clipboard?.readText) {
      const current = await navigator.clipboard.readText();
      // Only wipe if the clipboard still holds our secret.
      if (current !== expected) return;
    }
    await navigator.clipboard.writeText("");
  } catch {
    // Clipboard read/write permission may be denied. Best effort only.
  }
}

