/**
 * Living Flow gesture physics — pure, deterministic, and testable.
 *
 * The product brief asks for two things that a fixed spring cannot deliver:
 *
 * 1. **Elastic stretch & rebound** — pulling a surface past its resting
 *    position must resist progressively (a rubber band), and releasing it
 *    must spring back with a bounce instead of snapping flat.
 * 2. **Speed-responsive physics** — a gentle gesture settles softly, while a
 *    fast one carries extra momentum and overshoots more.
 *
 * These functions contain no DOM or React state, so the browserless harness
 * can assert the maths directly. The UI layer only maps the numbers onto
 * Framer Motion springs.
 */

export type SpringSpec = {
  type: "spring";
  stiffness: number;
  damping: number;
  mass: number;
  velocity: number;
  restDelta: number;
};

export const SPEED_GENTLE = 260; // px/s — below this a gesture is "gentle"
export const SPEED_FIRM = 1500; // px/s — at/above this it is "firm"
const MAX_SPEED = 3600;

export function clampSpeed(speed: number): number {
  if (!Number.isFinite(speed) || speed <= 0) return 0;
  return Math.min(Math.abs(speed), MAX_SPEED);
}

/**
 * Damped rubber-band translation.
 *
 * `offset` is how far the finger pulled past the constraint; `dimension` is
 * the size of the surface along the drag axis. Small pulls move almost 1:1,
 * large pulls asymptote to `dimension` instead of growing without bound —
 * the same curve iOS uses for scroll overscroll.
 */
export function rubberBand(offset: number, dimension: number, factor = 0.55): number {
  if (!Number.isFinite(offset) || offset <= 0) return 0;
  if (!Number.isFinite(dimension) || dimension <= 0) return 0;
  const c = Math.max(0.05, Math.min(2, factor));
  return (1 - 1 / ((offset * c) / dimension + 1)) * dimension;
}

/** Linear interpolation, clamped to [0, 1]. */
function blend(from: number, to: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return from + (to - from) * k;
}

/** 0 for a gentle gesture, 1 for a firm/fast one. */
export function speedIntensity(speed: number): number {
  const s = clampSpeed(speed);
  if (s <= SPEED_GENTLE) return 0;
  if (s >= SPEED_FIRM) return 1;
  return (s - SPEED_GENTLE) / (SPEED_FIRM - SPEED_GENTLE);
}

export type SpeedLabel = "gentle" | "balanced" | "firm";

export function speedLabel(speed: number): SpeedLabel {
  const t = speedIntensity(speed);
  if (t <= 0.15) return "gentle";
  if (t >= 0.8) return "firm";
  return "balanced";
}

/**
 * A spring whose stiffness/damping/velocity follow the gesture speed.
 *
 * Gentle  -> stiffness 300, damping 30 (soft, barely overshoots)
 * Firm    -> stiffness 560, damping 16 (lively overshoot, momentum retained)
 *
 * `velocity` is passed through so Framer Motion continues the gesture rather
 * than restarting it from rest (this is what makes a flick feel physical).
 */
export function speedResponsiveSpring(
  speed: number,
  direction: 1 | -1 = 1,
  reduceMotion = false
): SpringSpec {
  if (reduceMotion) {
    return { type: "spring", stiffness: 1000, damping: 100, mass: 1, velocity: 0, restDelta: 0.001 };
  }
  const t = speedIntensity(speed);
  const magnitude = clampSpeed(speed);
  return {
    type: "spring",
    stiffness: Math.round(blend(300, 560, t)),
    damping: Math.round(blend(30, 16, t)),
    mass: Number(blend(0.9, 0.68, t).toFixed(2)),
    velocity: direction * Math.min(magnitude, 2200),
    restDelta: 0.001,
  };
}

/**
 * Press/release spring for buttons and shortcuts. A quick tap rebounds with
 * a visible overshoot; a slow press settles softly.
 */
export function pressSpring(speed: number, releasing: boolean, reduceMotion = false): SpringSpec {
  if (reduceMotion) {
    return { type: "spring", stiffness: 1000, damping: 100, mass: 1, velocity: 0, restDelta: 0.001 };
  }
  const t = speedIntensity(speed);
  if (!releasing) {
    return {
      type: "spring",
      stiffness: 1050,
      damping: 45,
      mass: 0.65,
      velocity: 0,
      restDelta: 0.001,
    };
  }
  return {
    type: "spring",
    stiffness: Math.round(blend(420, 640, t)),
    damping: Math.round(blend(30, 16, t)),
    mass: Number(blend(0.8, 0.62, t).toFixed(2)),
    velocity: -Math.min(clampSpeed(speed), 900),
    restDelta: 0.001,
  };
}

/**
 * Overshoot peak after a release. Used for the press rebound keyframes so a
 * fast tap visibly springs past 1.0 before settling.
 */
export function reboundOvershoot(speed: number): number {
  return 1 + Math.min(0.045, speedIntensity(speed) * 0.045);
}

/**
 * Elastic stretch of a pressed surface from the pointer delta.
 *
 * Pulling horizontally compresses X a little and expands Y (volume-like
 * preservation), and vice versa. Values are deliberately bounded so a drag
 * can never distort a control into unreadability.
 */
export function stretchFromDelta(dx: number, dy: number): { scaleX: number; scaleY: number } {
  const ax = Math.min(Math.abs(Number.isFinite(dx) ? dx : 0), 240);
  const ay = Math.min(Math.abs(Number.isFinite(dy) ? dy : 0), 240);
  return {
    scaleX: Number(Math.max(0.94, Math.min(1.03, 1 - ax / 3200 + ay / 6400)).toFixed(4)),
    scaleY: Number(Math.max(0.94, Math.min(1.03, 1 - ay / 3200 + ax / 6400)).toFixed(4)),
  };
}

/** Speed in px/s between two pointer samples. */
export function speedFromSamples(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  elapsedMs: number
): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  const distance = Math.hypot(endX - startX, endY - startY);
  return (distance / elapsedMs) * 1000;
}

/**
 * Whether a downward drag should dismiss a surface.
 *
 * A slow pull needs to travel far enough; a fast flick can dismiss with a
 * short travel, which is exactly how a physical object behaves.
 */
export function shouldDismiss(offset: number, velocity: number, threshold = 60): boolean {
  if (offset >= threshold * 3) return true;
  if (offset > threshold && velocity > 220) return true;
  // A very short flick must not fling a full-height surface away, however
  // fast it was: there has to be a meaningful travel first.
  return velocity > 900 && offset > threshold * 0.55;
}

/* ------------------------------------------------------------------ */
/* Interaction speed registry                                          */
/* ------------------------------------------------------------------ */

/**
 * The most recent gesture speed, shared across surfaces without triggering
 * React re-renders. A surface that opens because of a click inherits that
 * click's momentum; a value older than 600 ms is ignored so opening a dialog
 * much later does not inherit an unrelated gesture.
 */
let lastInteraction = { speed: 0, at: 0 };

export function reportInteractionSpeed(speed: number): void {
  lastInteraction = { speed: clampSpeed(speed), at: Date.now() };
}

export function getInteractionSpeed(): number {
  if (Date.now() - lastInteraction.at > 600) return 0;
  return lastInteraction.speed;
}

export function resetInteractionSpeed(): void {
  lastInteraction = { speed: 0, at: 0 };
}
