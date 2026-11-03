import { AnimatePresence, motion, useDragControls, useIsPresent, type PanInfo } from "framer-motion";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  exitTransition,
  surfaceEntranceSpring,
  surfaceSpeedLabel,
  useDialogFocus,
  useMediaQuery,
} from "../lib/motion";
import {
  rubberBand,
  shouldDismiss,
  speedIntensity,
  speedLabel,
  stretchFromDelta,
} from "../lib/gesturePhysics";
import type { Language, VaultItem } from "../lib/vault";
import DetailInspector from "./Inspector";
import { useMotionSettings } from "./Tactile";

type InspectorProps = {
  item: VaultItem;
  lang: Language;
  onClose: () => void;
  onNotify: (message: string) => void;
  onTool: (tool: "authenticator" | "generator" | "security") => void;
  onEdit: (item: VaultItem) => void;
  onDelete?: (item: VaultItem) => void;
  onFavorite: (item: VaultItem) => void;
  onRestorePassword?: (item: VaultItem, restoredPassword: string) => void;
};

function FloatingInspector({ mode, suspended, ...props }: InspectorProps & {
  mode: "drawer" | "sheet";
  suspended: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  // V-59: the drag handle also carries an `onClick={onClose}` for an
  // explicit tap. Without this guard a completed drag fires a click and
  // closes the sheet, so the rubber-band rebound is never seen.
  const draggedRef = useRef(false);
  const dragControls = useDragControls();
  const isPresent = useIsPresent();
  const { reduceMotion } = useMotionSettings();
  const sheet = mode === "sheet";
  useDialogFocus(ref, props.onClose, isPresent && !suspended);

  /**
   * V-58 Elastic Stretch & Rebound.
   *
   * Framer Motion already rubber-bands the *translation* through
   * `dragElastic` + `dragSnapToOrigin` + `dragTransition`. This adds the
   * second half of the ColorOS feel: the surface itself deforms while it is
   * being pulled, and on release it springs back with a bounce whose size and
   * duration follow the gesture speed. A fast flick also dismisses from a
   * much shorter travel than a slow pull.
   */
  const clearStretch = () => {
    const element = ref.current;
    if (!element) return;
    element.style.removeProperty("scale");
    element.removeAttribute("data-elastic-state");
    element.removeAttribute("data-rebound-speed");
  };

  const onDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (reduceMotion || !sheet) return;
    const element = ref.current;
    if (!element) return;
    const pull = Math.max(0, info.offset.y);
    // The visible stretch follows the damped rubber-band curve, so pulling
    // twice as far does not distort the panel twice as much.
    const damp = rubberBand(pull, element.getBoundingClientRect().height || 600);
    const stretch = stretchFromDelta(0, damp);
    draggedRef.current = true;
    element.dataset.elasticState = "stretch";
    element.style.scale = `${stretch.scaleX} ${stretch.scaleY}`;
  };

  const onDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!sheet) return;
    const element = ref.current;
    const velocity = Math.abs(info.velocity.y);
    const speed = speedLabel(velocity);
    if (Math.abs(info.offset.y) < 3 && velocity < 50) { clearStretch(); return; }
    const dismiss = shouldDismiss(info.offset.y, info.velocity.y, 60);
    // Suppress the click that follows this drag (see draggedRef above).
    window.setTimeout(() => { draggedRef.current = false; }, 350);
    if (dismiss) {
      if (element) element.dataset.elasticState = "dismiss";
      props.onClose();
      return;
    }
    if (reduceMotion || !element) {
      clearStretch();
      return;
    }
    const scale = element.style.scale || "1 1";
    const t = speedIntensity(velocity);
    element.dataset.elasticState = "rebound";
    element.dataset.reboundSpeed = speed;
    // Persistent observability hook: lets the regression suite assert which
    // speed class the rebound used after the transient animation finishes.
    element.dataset.lastRebound = speed;
    // Web Animations gives us a deterministic, GPU-composited bounce that is
    // independent of Framer Motion's y snap-back. Fast gestures overshoot
    // further and settle later; gentle ones barely bounce at all.
    const overshoot = 0.006 + t * 0.028;
    const frames = [
      { scale },
      { scale: `${1 + overshoot} ${1 - overshoot}`, offset: 0.45 },
      { scale: "1 1" },
    ];
    const animation = element.animate(frames, {
      duration: Math.round(260 + t * 280),
      easing: "cubic-bezier(.22,1,.36,1)",
      fill: "none",
    });
    animation.onfinish = clearStretch;
    animation.oncancel = clearStretch;
  };

  return createPortal(
    <motion.div
      className={`inspector-overlay ${sheet ? "is-sheet" : "is-drawer"}`}
      initial="closed"
      animate="open"
      exit="closed"
      style={{ pointerEvents: isPresent && !suspended ? "auto" : "none" }}
    >
      <motion.div
        className="inspector-scrim"
        variants={{ open: { opacity: 1 }, closed: { opacity: 0 } }}
        transition={{ duration: reduceMotion ? 0 : 0.22 }}
        onClick={props.onClose}
        aria-hidden="true"
      />
      <motion.aside
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Item details: ${props.item.title}`}
        data-testid="detail-inspector"
        data-mode={mode}
        data-elastic={sheet ? "sheet" : "drawer"}
        data-surface-speed={surfaceSpeedLabel()}
        className={`inspector-floating ${sheet ? "is-sheet" : "is-drawer"}`}
        variants={{
          open: {
            x: 0, y: 0, opacity: 1,
            transition: reduceMotion ? { duration: 0 } : surfaceEntranceSpring(false, "open"),
          },
          closed: {
            x: !sheet && !reduceMotion ? "105%" : 0,
            y: sheet && !reduceMotion ? "100%" : 0,
            opacity: 0,
            transition: reduceMotion ? { duration: 0 } : exitTransition,
          },
        }}
        drag={sheet && !suspended ? "y" : false}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.65 }}
        dragSnapToOrigin
        dragTransition={{ bounceStiffness: 420, bounceDamping: 18, timeConstant: 180 }}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        onClickCapture={(event) => {
          if (!draggedRef.current) return;
          event.preventDefault();
          event.stopPropagation();
          draggedRef.current = false;
        }}
      >
        <DetailInspector
          {...props}
          mode={mode}
          onDragHandlePointerDown={sheet ? (event) => dragControls.start(event) : undefined}
        />
      </motion.aside>
    </motion.div>,
    document.body,
  );
}

export default function InspectorHost({
  open,
  suspended,
  item,
  ...props
}: Omit<InspectorProps, "item"> & {
  item: VaultItem | null;
  open: boolean;
  suspended: boolean;
}) {
  const desktop = useMediaQuery("(min-width: 1280px)");
  const mobile = useMediaQuery("(max-width: 767px)");
  const wide = useMediaQuery("(min-width: 1600px)");
  const { reduceMotion } = useMotionSettings();
  const width = wide ? 370 : 344;

  useEffect(() => {
    if (!open || !desktop || suspended) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector('[aria-modal="true"]')) props.onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, desktop, suspended, props.onClose]);

  return (
    <AnimatePresence initial={false} mode="wait">
      {open && item && (desktop ? (
        <motion.aside
          key="docked-inspector"
          className="inspector-dock"
          aria-label={`Item details: ${item.title}`}
          data-testid="detail-inspector"
          data-mode="panel"
          data-elastic="dock"
          data-surface-speed={surfaceSpeedLabel()}
          initial={{ width: 0, marginLeft: 0, opacity: 0 }}
          animate={{ width, marginLeft: 16, opacity: 1 }}
          exit={{ width: 0, marginLeft: 0, opacity: 0, transition: reduceMotion ? { duration: 0 } : exitTransition }}
          transition={reduceMotion ? { duration: 0 } : surfaceEntranceSpring(false, "open")}
        >
          <div className="inspector-dock-inner" style={{ width }}>
            <DetailInspector {...props} item={item} mode="panel" />
          </div>
        </motion.aside>
      ) : (
        <FloatingInspector
          key={mobile ? "sheet-inspector" : "drawer-inspector"}
          {...props}
          item={item}
          mode={mobile ? "sheet" : "drawer"}
          suspended={suspended}
        />
      ))}
    </AnimatePresence>
  );
}
