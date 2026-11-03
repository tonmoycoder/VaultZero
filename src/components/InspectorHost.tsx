import { AnimatePresence, motion, useIsPresent, useMotionValue } from "framer-motion";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { exitTransition, softSpring, useDialogFocus, useMediaQuery } from "../lib/motion";
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
  const isPresent = useIsPresent();
  const { reduceMotion } = useMotionSettings();
  const sheet = mode === "sheet";
  useDialogFocus(ref, props.onClose, isPresent && !suspended);

  /*
   * The sheet is dragged by the handle.
   *
   * The gesture is implemented here, without a drag library, because the
   * library decides on its own when a drag has ended and how far it has
   * travelled. The sheet is closed by the release of a pointer, so the
   * distance that the pointer has covered is the only thing that matters
   * — and that distance has to be measured here, on the window, or the
   * pointer events stop arriving as soon as the pointer leaves the
   * handle.
   */
  /*
   * The vertical offset is a motion value.
   *
   * The panel's transform is animated by the motion library, so writing
   * to `style.transform` from here would be undone on the next frame:
   * the library owns that property. The offset is therefore kept in a
   * motion value, which the library reads while it animates the panel in
   * and out.
   */
  const sheetY = useMotionValue(0);
  const handleDownRef = useRef<
    ((event: React.PointerEvent<Element>) => void) | undefined
  >(undefined);

  useEffect(() => {
    if (!sheet || suspended) return;

    const panel = document.querySelector<HTMLElement>(
      '[data-testid="detail-inspector"][data-mode="sheet"]'
    );
    if (!panel) return;

    const height = panel.offsetHeight;
    if (!height) return;

    let startY = 0;
    let travelled = 0;
    let tracking = false;

    const apply = (offset: number) => {
      const clamped = Math.max(0, Math.min(offset, height));
      travelled = Math.max(travelled, clamped);
      sheetY.set(clamped);
    };

    const release = () => {
      if (!tracking) return;
      tracking = false;

      const threshold = Math.max(72, Math.round(height * 0.2));
      if (travelled > threshold) {
        // The offset is handed back to the library, which owns the
        // transform and runs the exit animation from it.
        sheetY.set(0);
        props.onClose();
        return;
      }

      const from = sheetY.get();
      if (reduceMotion || from === 0) {
        sheetY.set(0);
        return;
      }

      const startedAt = performance.now();
      const duration = 220;
      const step = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        // Cubic ease out.
        const eased = 1 - Math.pow(1 - progress, 3);
        sheetY.set(from * (1 - eased));
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          sheetY.set(0);
        }
      };
      requestAnimationFrame(step);
    };

    const onMove = (event: MouseEvent | TouchEvent | PointerEvent) => {
      if (!tracking) return;
      if (event.cancelable) event.preventDefault();
      const y =
        "touches" in event
          ? event.touches[0]?.clientY ?? startY
          : "clientY" in event
            ? event.clientY
            : startY;
      apply(y - startY);
    };

    const onUp = () => release();

    /*
     * Every kind of move is listened to.
     *
     * A touch screen sends `touchmove`, a pointer device sends
     * `pointermove`, and a mouse sends `mousemove`. A browser is free
     * to synthesise the last one for the first two, but it is not
     * obliged to, so listening for only one of them leaves the sheet
     * behind on the devices that do not send it. The three are
     * registered together and the gesture stays alive whichever
     * combination the platform chooses.
     */
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("mousemove", onMove, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("touchcancel", onUp);

    const onPointerDown = (event: React.PointerEvent<Element>) => {
      startY = event.clientY;
      travelled = 0;
      tracking = true;
      apply(0);
    };

    handleDownRef.current = onPointerDown;

    return () => {
      handleDownRef.current = undefined;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("touchcancel", onUp);
    };
  }, [sheet, suspended, reduceMotion, props.onClose]);

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
        className={`inspector-floating ${sheet ? "is-sheet" : "is-drawer"}`}
        style={sheet ? { y: sheetY } : undefined}
        /*
         * The vertical position is left out of the variants on purpose.
         *
         * For the sheet the vertical position belongs to the motion
         * value that the drag gesture writes to, and a variant that
         * also animates `y` would overwrite it on every frame. The
         * sheet therefore fades, and the gesture owns the movement.
         */
        variants={{
          open: {
            x: 0,
            opacity: 1,
            transition: reduceMotion ? { duration: 0 } : softSpring,
          },
          closed: {
            x: !sheet && !reduceMotion ? "105%" : 0,
            opacity: 0,
            transition: reduceMotion ? { duration: 0 } : exitTransition,
          },
        }}
      >
        <DetailInspector
          {...props}
          mode={mode}
          onDragHandlePointerDown={sheet ? (event) => handleDownRef.current?.(event) : undefined}
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
          initial={{ width: 0, marginLeft: 0, opacity: 0 }}
          animate={{ width, marginLeft: 16, opacity: 1 }}
          exit={{ width: 0, marginLeft: 0, opacity: 0, transition: reduceMotion ? { duration: 0 } : exitTransition }}
          transition={reduceMotion ? { duration: 0 } : softSpring}
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
