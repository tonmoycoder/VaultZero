import { useEffect, useRef, useState, type RefObject } from "react";

import {
  getInteractionSpeed,
  speedResponsiveSpring,
  type SpeedLabel,
  speedLabel,
  type SpringSpec,
} from "./gesturePhysics";

export const spring = { type: "spring" as const, stiffness: 400, damping: 30, mass: 0.85 };
// Damping ratio ~0.72: the surface overshoots slightly instead of stopping dead.
export const softSpring = { type: "spring" as const, stiffness: 310, damping: 24, mass: 0.9 };
export const exitTransition = { duration: 0.2, ease: [0.32, 0, 0.67, 0] as const };

// ColorOS 17 Living Flow Physics Curves (120fps Aquamorphic Springs)
export const colorOsBouncySpring = {
  type: "spring" as const,
  stiffness: 420,
  damping: 18, // Under-damped: the signature lively ColorOS 17 bounce.
  mass: 0.75,
};

export const colorOsFluidMorph = {
  type: "spring" as const,
  stiffness: 340,
  damping: 22,
  mass: 0.8,
};

/**
 * V-58: these used to have damping 32/36, i.e. a damping ratio above 0.94.
 * A spring above ~0.8 never overshoots, so despite the "Living Flow" name
 * the modal simply slid into place and stopped. Lower damping makes opening
 * and closing visibly elastic.
 */
export const livingFlowExpand = {
  type: "spring" as const,
  stiffness: 380,
  damping: 20,
  mass: 0.75,
  restDelta: 0.001,
};

export const livingFlowCollapse = {
  type: "spring" as const,
  stiffness: 460,
  damping: 24,
  mass: 0.65,
  restDelta: 0.001,
};

export const aquamorphicBezier = [0.22, 1, 0.36, 1] as const;

/**
 * Speed-responsive open/close transition for a surface.
 *
 * Reads the most recent gesture speed (reported by Tactile on pointer up),
 * so a surface opened by a quick tap inherits that momentum and a surface
 * opened by a slow press settles softly. `reduceMotion` wins over everything.
 */
export function surfaceSpring(reduceMotion: boolean, speed?: number, direction: 1 | -1 = 1): SpringSpec | { duration: number } {
  if (reduceMotion) return { duration: 0 };
  return speedResponsiveSpring(speed ?? getInteractionSpeed(), direction);
}

/**
 * Variant entrance/exit spring. The gesture speed selects stiffness and
 * damping (soft settle vs. lively overshoot), but `velocity` is zeroed:
 * variant targets are in pixels/percent and a raw px/s velocity would fling
 * the surface past its resting position. Raw velocity is used only by the
 * drag-release rebound in `surfaceSpring`.
 */
export function surfaceEntranceSpring(reduceMotion: boolean, phase: "open" | "close" = "open"): SpringSpec | { duration: number } {
  if (reduceMotion) return { duration: 0 };
  const spec = speedResponsiveSpring(getInteractionSpeed(), 1);
  return {
    ...spec,
    velocity: 0,
    stiffness: phase === "close" ? Math.round(spec.stiffness * 1.12) : spec.stiffness,
    damping: phase === "close" ? Math.round(spec.damping * 1.15) : spec.damping,
  };
}

export function surfaceSpeedLabel(speed?: number): SpeedLabel {
  return speedLabel(speed ?? getInteractionSpeed());
}

export { getInteractionSpeed, reportInteractionSpeed } from "./gesturePhysics";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

// Only the topmost dialog owns Escape and Tab. Return focus to its trigger on close.
export function useDialogFocus(ref: RefObject<HTMLElement | null>, onClose: () => void, enabled = true) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const previousRef = useRef<HTMLElement | null>(
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  );

  useEffect(() => {
    if (!enabled) return;
    const root = ref.current;
    const focusable = () => Array.from(root?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]',
    ) ?? []).filter((element) => element.getClientRects().length > 0 && !element.closest('[inert]'));
    const frame = requestAnimationFrame(() => {
      if (root?.contains(document.activeElement) && document.activeElement !== root) return;
      const autofocus = root?.querySelector<HTMLElement>('[autofocus], [data-autofocus]');
      (autofocus ?? root)?.focus({ preventScroll: true });
    });
    const onKeyDown = (event: KeyboardEvent) => {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]'))
        .filter((element) => element.getClientRects().length > 0);
      if (dialogs[dialogs.length - 1] !== root) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const nodes = focusable();
      if (!nodes.length) { event.preventDefault(); root?.focus(); return; }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root || !root?.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root || !root?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled, ref]);

  useEffect(() => {
    return () => {
      setTimeout(() => {
        const lastTrigger = (window as any).__lastModalTrigger;
        if (lastTrigger && typeof lastTrigger.focus === "function") {
          lastTrigger.focus({ preventScroll: true });
          return;
        }
        const prev = previousRef.current;
        if (prev && prev.isConnected) {
          prev.focus({ preventScroll: true });
        }
      }, 30);
    };
  }, []);
}