import { motion } from "framer-motion";
import { surfaceEntranceSpring, surfaceSpeedLabel } from "../lib/motion";
import { useMotionSettings } from "./Tactile";

export default function GlassSelection({ id = "selection", hover = false }: { id?: string; hover?: boolean }) {
  const { reduceMotion } = useMotionSettings();
  return (
    <motion.span
      aria-hidden="true"
      layoutId={id}
      className={`liquid-selection${hover ? " is-hover" : ""}`}
      initial={false}
      transition={reduceMotion ? { duration: 0 } : surfaceEntranceSpring(false, "open")}
      style={{ borderRadius: "inherit" }}
      data-glass-indicator={hover ? "hover" : "selected"}
      data-elastic="selection"
      data-surface-speed={surfaceSpeedLabel()}
    />
  );
}