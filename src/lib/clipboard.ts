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
            // Attempt to check if clipboard still holds the sensitive text before clearing
            if (navigator.clipboard?.readText) {
              const current = await navigator.clipboard.readText();
              if (current === lastCopiedValue) {
                await navigator.clipboard.writeText("");
              }
            } else {
              await navigator.clipboard.writeText("");
            }
          } catch {
            // Read permission might be blocked; overwrite directly
            try {
              await navigator.clipboard.writeText("");
            } catch {
              // Ignore failure in restricted context
            }
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
 * Immediately cancels any active auto-wipe timer and wipes clipboard.
 */
export async function clearClipboardWipe(): Promise<void> {
  if (activeWipeTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(activeWipeTimer);
    activeWipeTimer = null;
  }
  lastCopiedValue = null;
}

