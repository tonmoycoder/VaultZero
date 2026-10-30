import { animate, MotionConfig, type AnimationPlaybackControls } from "framer-motion";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { spring, useMediaQuery } from "../lib/motion";

const MotionSettings = createContext({ reduceMotion: false });
export const useMotionSettings = () => useContext(MotionSettings);
let hapticsEnabled = true;

export function haptic(pattern: number | number[] = 7) {
  if (!hapticsEnabled || typeof navigator.vibrate !== "function") return;
  try { navigator.vibrate(pattern); } catch { /* Optional device support. */ }
}
export const hapticSuccess = () => haptic([8, 24, 12]);

export default function TactileProvider({ press, haptics, children }: {
  press: boolean;
  haptics: boolean;
  children: ReactNode;
}) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const reduceMotion = Boolean(reduced) || !press;

  useEffect(() => {
    hapticsEnabled = haptics;
    document.documentElement.dataset.motion = reduceMotion ? "reduced" : "full";
  }, [haptics, reduceMotion]);

  useEffect(() => {
    const animations = new Map<HTMLElement, AnimationPlaybackControls>();
    const ripples = new Set<HTMLElement>();
    let pressed: HTMLElement | null = null;
    const targetFor = (origin: EventTarget | null) => {
      if (!(origin instanceof Element)) return null;
      const target = origin.closest<HTMLElement>('button, [role="button"], a[href]');
      if (!target || target.matches(':disabled, [data-no-tactile], [aria-disabled="true"]')) return null;
      return target;
    };
    const scaleTo = (target: HTMLElement, value: number, releasing = false) => {
      animations.get(target)?.stop();
      const from = Number.parseFloat(getComputedStyle(target).scale) || 1;
      // Individual scale composes with existing hover transforms rather than replacing them.
      const controls = animate(from, value, {
        type: "spring", stiffness: releasing ? 480 : 1050,
        damping: releasing ? 22 : 45, mass: 0.65,
        onUpdate: (current) => { target.style.scale = String(current); },
        onComplete: () => {
          if (releasing) target.style.removeProperty("scale");
          animations.delete(target);
        },
      });
      animations.set(target, controls);
    };
    const ripple = (target: HTMLElement, clientX?: number, clientY?: number) => {
      const rect = target.getBoundingClientRect();
      const layer = document.createElement("span");
      layer.className = "tactile-ripple-layer";
      layer.setAttribute("aria-hidden", "true");
      Object.assign(layer.style, {
        left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`,
        height: `${rect.height}px`, borderRadius: getComputedStyle(target).borderRadius,
      });
      const size = Math.hypot(rect.width, rect.height) * 2;
      const dot = document.createElement("span");
      dot.className = "tactile-ripple-dot";
      Object.assign(dot.style, {
        width: `${size}px`, height: `${size}px`,
        left: `${(clientX ?? rect.left + rect.width / 2) - rect.left - size / 2}px`,
        top: `${(clientY ?? rect.top + rect.height / 2) - rect.top - size / 2}px`,
      });
      layer.append(dot);
      document.body.append(layer);
      ripples.add(layer);
      const animation = dot.animate(
        [{ transform: "scale(0.04)", opacity: 0.65 }, { transform: "scale(1)", opacity: 0 }],
        { duration: 560, easing: "cubic-bezier(.16,1,.3,1)" },
      );
      animation.onfinish = () => { layer.remove(); ripples.delete(layer); };
    };
    const release = () => {
      if (pressed && !reduceMotion) scaleTo(pressed, 1, true);
      pressed = null;
    };
    const start = (target: HTMLElement, x?: number, y?: number) => {
      release();
      haptic(5);
      if (reduceMotion) return;
      pressed = target;
      scaleTo(target, target.classList.contains("vault-card") ? 0.985 : 0.95);
      ripple(target, x, y);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = targetFor(event.target);
      if (target) start(target, event.clientX, event.clientY);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
      const target = targetFor(event.target);
      if (target) start(target);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") release();
    };
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      animations.forEach((controls, element) => { controls.stop(); element.style.removeProperty("scale"); });
      ripples.forEach((layer) => layer.remove());
    };
  }, [reduceMotion]);

  return (
    <MotionSettings.Provider value={{ reduceMotion }}>
      <MotionConfig reducedMotion={reduceMotion ? "always" : "user"} transition={spring}>
        {children}
      </MotionConfig>
    </MotionSettings.Provider>
  );
}
