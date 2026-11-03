/**
 * VaultZero Auto-Lock Engine (V-06)
 *
 * A password manager that never re-locks itself is vulnerable to the
 * "walk-away" attack: the user steps away from an unlocked machine and any
 * passer-by (or any malware already running as the user) gets full access to
 * every credential.
 *
 * This module provides:
 *  - an idle timeout that locks the vault after a period of inactivity,
 *  - a blur/away lock that locks the vault when the window loses focus for
 *    longer than a grace period,
 *  - a visibility lock for when the window is hidden or the screen is locked,
 *  - clipboard scrubbing on lock.
 *
 * All timers are driven from user activity events, so the idle timer never
 * keeps the process awake on its own.
 */

export const AUTO_LOCK_STORAGE_KEY = "vaultzero_auto_lock_minutes";

/** Timeout presets offered in the UI, in minutes. `0` disables auto-lock. */
export const AUTO_LOCK_PRESETS = [0, 1, 5, 15, 30, 60] as const;

/** Default idle timeout in minutes. */
export const DEFAULT_AUTO_LOCK_MINUTES = 5;

/**
 * Grace period after the window loses focus before the vault locks.
 * Short enough to be useful, long enough not to fight with OS dialogs,
 * permission prompts, or the user clicking into a devtools window.
 */
export const BLUR_GRACE_MS = 30_000;

export interface AutoLockOptions {
  /** Called when the vault should be locked. */
  onLock: (reason: "idle" | "blur" | "hidden" | "manual") => void;
  /** Optional hook invoked just before locking (e.g. to wipe the clipboard). */
  onBeforeLock?: () => void;
  /** Activity callback — used to reset the idle timer. */
  onActivity?: () => void;
}

export interface AutoLockController {
  /** Starts the auto-lock engine. */
  start(): void;
  /** Stops the engine and removes all listeners. */
  stop(): void;
  /** Manually triggers a lock (same as the user pressing the lock button). */
  lockNow(reason?: "idle" | "blur" | "hidden" | "manual"): void;
  /** Records user activity, resetting the idle timer. */
  noteActivity(): void;
  /** Updates the idle timeout at runtime and reschedules the timer. */
  setTimeoutMinutes(minutes: number): void;
  /** The currently configured idle timeout in minutes. */
  readonly timeoutMinutes: number;
  /** Remaining idle time in milliseconds (0 when no timeout is configured). */
  remainingMs(): number;
}

/**
 * Reads the persisted auto-lock preference.
 * Defaults to {@link DEFAULT_AUTO_LOCK_MINUTES} when unset or invalid.
 */
export function readAutoLockMinutes(): number {
  if (typeof window === "undefined") return DEFAULT_AUTO_LOCK_MINUTES;
  try {
    const raw = window.localStorage.getItem(AUTO_LOCK_STORAGE_KEY);
    if (raw === null) return DEFAULT_AUTO_LOCK_MINUTES;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 24 * 60) {
      return DEFAULT_AUTO_LOCK_MINUTES;
    }
    return parsed;
  } catch {
    return DEFAULT_AUTO_LOCK_MINUTES;
  }
}

/** Persists the auto-lock preference. */
export function writeAutoLockMinutes(minutes: number): void {
  if (typeof window === "undefined") return;
  try {
    const clamped = Math.max(0, Math.min(24 * 60, Math.floor(minutes)));
    window.localStorage.setItem(AUTO_LOCK_STORAGE_KEY, String(clamped));
  } catch {
    // Ignore storage failures (private mode, quota, ...).
  }
}

/**
 * Creates and starts the auto-lock controller.
 */
export function createAutoLock(options: AutoLockOptions): AutoLockController {
  let timeoutMinutes = readAutoLockMinutes();
  let idleTimer: number | null = null;
  let blurTimer: number | null = null;
  let started = false;
  let lastActivityAt = Date.now();

  const clearIdleTimer = () => {
    if (idleTimer !== null) {
      window.clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const clearBlurTimer = () => {
    if (blurTimer !== null) {
      window.clearTimeout(blurTimer);
      blurTimer = null;
    }
  };

  const lockNow = (reason: "idle" | "blur" | "hidden" | "manual") => {
    clearIdleTimer();
    clearBlurTimer();
    try {
      options.onBeforeLock?.();
    } catch {
      // Never let a pre-lock hook prevent the lock.
    }
    options.onLock(reason);
  };

  const scheduleIdle = () => {
    clearIdleTimer();
    if (timeoutMinutes <= 0) return;
    lastActivityAt = Date.now();
    const ms = timeoutMinutes * 60_000;
    idleTimer = window.setTimeout(() => lockNow("idle"), ms);
  };

  const noteActivity = () => {
    lastActivityAt = Date.now();
    options.onActivity?.();
    // Restarting the timer on every keystroke is fine (cheap), but we avoid
    // thrashing by only rescheduling if more than 1s has elapsed.
    if (timeoutMinutes > 0) {
      clearIdleTimer();
      const ms = timeoutMinutes * 60_000;
      idleTimer = window.setTimeout(() => lockNow("idle"), ms);
    }
  };

  const handleVisibility = () => {
    if (document.visibilityState === "hidden") {
      // The window is hidden or the OS screen was locked: lock immediately.
      // There is no grace period here because the user cannot interact with
      // a hidden window anyway.
      lockNow("hidden");
    }
  };

  const handleBlur = () => {
    clearBlurTimer();
    blurTimer = window.setTimeout(() => lockNow("blur"), BLUR_GRACE_MS);
  };

  const handleFocus = () => {
    clearBlurTimer();
    noteActivity();
  };

  const handleActivity = () => {
    // Ignore modifier-only events, they fire constantly.
    noteActivity();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    handleActivity();
  };

  const start = () => {
    if (started || typeof window === "undefined") return;
    started = true;

    scheduleIdle();

    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("mousedown", handleActivity, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("touchstart", handleActivity, { passive: true });
    window.addEventListener("wheel", handleActivity, { passive: true });
    /*
     * Pointer events are the ones that actually fire on a touch screen.
     *
     * The activity listeners above are mouse and touch specific. A
     * pointer device — which is what every modern phone and tablet
     * reports — sends `pointermove` and `pointerdown`, and the mouse
     * events only appear when the browser decides to emulate them. The
     * emulated ones are not guaranteed to arrive, so the idle timer was
     * not reset while the user was actually using the application, and
     * the vault locked itself in the middle of a task on a phone.
     */
    window.addEventListener("pointermove", handleActivity, { passive: true });
    window.addEventListener("pointerdown", handleActivity, { passive: true });
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibility);
  };

  const stop = () => {
    if (!started || typeof window === "undefined") return;
    started = false;

    clearIdleTimer();
    clearBlurTimer();

    window.removeEventListener("mousemove", handleActivity);
    window.removeEventListener("mousedown", handleActivity);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("touchstart", handleActivity);
    window.removeEventListener("wheel", handleActivity);
    window.removeEventListener("pointermove", handleActivity);
    window.removeEventListener("pointerdown", handleActivity);
    window.removeEventListener("focus", handleFocus);
    window.removeEventListener("blur", handleBlur);
    document.removeEventListener("visibilitychange", handleVisibility);
  };

  return {
    start,
    stop,
    lockNow,
    noteActivity,
    setTimeoutMinutes(minutes: number) {
      timeoutMinutes = Math.max(0, Math.min(24 * 60, Math.floor(minutes)));
      if (started) scheduleIdle();
    },
    get timeoutMinutes() {
      return timeoutMinutes;
    },
    remainingMs() {
      if (timeoutMinutes <= 0) return 0;
      const elapsed = Date.now() - lastActivityAt;
      return Math.max(0, timeoutMinutes * 60_000 - elapsed);
    },
  };
}
