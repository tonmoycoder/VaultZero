import { useEffect, useRef, useState, type RefObject } from "react";

export const spring = { type: "spring" as const, stiffness: 400, damping: 30, mass: 0.85 };
export const softSpring = { type: "spring" as const, stiffness: 310, damping: 28, mass: 0.9 };
export const exitTransition = { duration: 0.2, ease: [0.32, 0, 0.67, 0] as const };

// ColorOS 17 Living Flow Physics Curves (120fps Aquamorphic Springs)
export const colorOsBouncySpring = {
  type: "spring" as const,
  stiffness: 420,
  damping: 22, // Lower damping creates the signature lively ColorOS 17 bounce!
  mass: 0.75,
};

export const colorOsFluidMorph = {
  type: "spring" as const,
  stiffness: 340,
  damping: 26,
  mass: 0.8,
};

export const livingFlowExpand = {
  type: "spring" as const,
  stiffness: 380,
  damping: 32,
  mass: 0.75,
  restDelta: 0.001,
};

export const livingFlowCollapse = {
  type: "spring" as const,
  stiffness: 460,
  damping: 36,
  mass: 0.65,
  restDelta: 0.001,
};

export const aquamorphicBezier = [0.22, 1, 0.36, 1] as const;

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
  useEffect(() => {
    if (!enabled) return;
    const previous = document.activeElement as HTMLElement | null;
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
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [enabled, ref]);
}