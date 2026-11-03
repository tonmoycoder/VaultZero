import { animate, MotionConfig, type AnimationPlaybackControls } from "framer-motion";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import {
  pressSpring,
  reportInteractionSpeed,
  speedFromSamples,
  speedLabel,
  stretchFromDelta,
} from "../lib/gesturePhysics";
import { spring, useMediaQuery } from "../lib/motion";

const MotionSettings = createContext({ reduceMotion: false });
export const useMotionSettings = () => useContext(MotionSettings);
let hapticsEnabled = true;

export function haptic(pattern: number | number[] = 7) {
  if (!hapticsEnabled || typeof navigator.vibrate !== "function") return;
  try { navigator.vibrate(pattern); } catch { /* Optional device support. */ }
}
export const hapticSuccess = () => haptic([8, 24, 12]);

type PressSample = {
  x: number;
  y: number;
  t: number;
  lastX: number;
  lastY: number;
  lastT: number;
  peakSpeed: number;
};

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
    let sample: PressSample | null = null;

    const targetFor = (origin: EventTarget | null) => {
      if (!(origin instanceof Element)) return null;
      const target = origin.closest<HTMLElement>('button, [role="button"], a[href]');
      if (!target || target.matches(':disabled, [data-no-tactile], [aria-disabled="true"]')) return null;
      return target;
    };

    /**
     * V-58: the release spring is chosen from the measured gesture speed.
     * A gentle press settles softly (damping 30), a fast tap keeps its
     * momentum and overshoots (damping 16, stiffness 640). The two-value
     * `scale` string written during a drag is replaced by this single-value
     * animation, so the elastic stretch springs back to an undistorted 1.
     */
    const scaleTo = (target: HTMLElement, value: number, releasing = false, speed = 0) => {
      animations.get(target)?.stop();
      const from = Number.parseFloat(getComputedStyle(target).scale) || 1;
      const controls = animate(from, value, {
        ...pressSpring(speed, releasing, reduceMotion),
        onUpdate: (current) => { target.style.scale = String(current); },
        onComplete: () => {
          if (releasing) {
            target.style.removeProperty("scale");
            target.removeAttribute("data-press-speed");
            target.removeAttribute("data-elastic-state");
          }
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
      const target = pressed;
      if (target && !reduceMotion) {
        const travelSpeed = sample
          ? speedFromSamples(sample.x, sample.y, sample.lastX, sample.lastY, sample.lastT - sample.t)
          : 0;
        const speed = Math.max(travelSpeed, sample?.peakSpeed ?? 0);
        // Share the gesture momentum with any surface that opens on this
        // click (modal, palette, sheet) — that is Speed-Responsive Physics.
        reportInteractionSpeed(speed);
        target.dataset.pressSpeed = speedLabel(speed);
        scaleTo(target, 1, true, speed);
      } else if (target) {
        reportInteractionSpeed(0);
        target.removeAttribute("data-press-speed");
        target.removeAttribute("data-elastic-state");
      }
      pressed = null;
      sample = null;
    };

    const start = (target: HTMLElement, x?: number, y?: number) => {
      release();
      haptic(5);
      if (reduceMotion) return;
      pressed = target;
      const now = performance.now();
      sample = {
        x: x ?? 0, y: y ?? 0, t: now,
        lastX: x ?? 0, lastY: y ?? 0, lastT: now,
        peakSpeed: 0,
      };
      scaleTo(target, target.classList.contains("vault-card") ? 0.985 : 0.95);
      ripple(target, x, y);
    };

    /**
     * Elastic Stretch: while a control is held, pointer movement physically
     * deforms it. The deformation is bounded and follows the drag direction;
     * the rebound happens in `release()` through the speed-responsive spring.
     */
    const onPointerMove = (event: PointerEvent) => {
      if (!pressed || !sample || reduceMotion) return;
      const now = performance.now();
      const delta = speedFromSamples(sample.lastX, sample.lastY, event.clientX, event.clientY, now - sample.lastT);
      sample.peakSpeed = Math.max(sample.peakSpeed, delta);
      sample.lastX = event.clientX;
      sample.lastY = event.clientY;
      sample.lastT = now;
      const stretch = stretchFromDelta(event.clientX - sample.x, event.clientY - sample.y);
      // Stop the press-down tween before taking ownership of `scale`, or its
      // onUpdate would overwrite the stretch on the very next frame.
      animations.get(pressed)?.stop();
      animations.delete(pressed);
      pressed.dataset.elasticState = "stretch";
      pressed.style.scale = `${stretch.scaleX} ${stretch.scaleY}`;
      reportInteractionSpeed(sample.peakSpeed);
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
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      animations.forEach((controls, element) => {
        controls.stop();
        element.style.removeProperty("scale");
        element.removeAttribute("data-press-speed");
        element.removeAttribute("data-elastic-state");
      });
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
