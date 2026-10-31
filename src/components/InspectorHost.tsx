import { AnimatePresence, motion, useDragControls, useIsPresent } from "framer-motion";
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
  const dragControls = useDragControls();
  const isPresent = useIsPresent();
  const { reduceMotion } = useMotionSettings();
  const sheet = mode === "sheet";
  useDialogFocus(ref, props.onClose, isPresent && !suspended);

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
        variants={{
          open: { x: 0, y: 0, opacity: 1, transition: reduceMotion ? { duration: 0 } : softSpring },
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
        onDragEnd={(_, info) => {
          if (info.offset.y > 50 || info.velocity.y > 300) props.onClose();
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
