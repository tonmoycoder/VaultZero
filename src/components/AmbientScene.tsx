import { AnimatePresence, motion } from "framer-motion";
import type { Theme } from "../lib/vault";
import { useMotionSettings } from "./Tactile";

export default function AmbientScene({ theme }: { theme: Theme }) {
  const { reduceMotion } = useMotionSettings();
  return (
    <div className="ambient-scene" aria-hidden="true">
      <AnimatePresence initial={false}>
        <motion.div
          key={theme}
          className={`ambient-plane ambient-${theme}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.65, ease: "easeInOut" }}
        >
          {theme === "lofi" && (
            <>
              <div className="zen-sunset" />
              <svg className="zen-waves" viewBox="0 0 1440 600" preserveAspectRatio="none">
                <path d="M0 390 Q220 240 470 370 T960 365 T1440 330 V600 H0Z" fill="#5e3a40" opacity=".32" />
                <path d="M0 430 Q280 320 550 430 T1050 425 T1440 390 V600 H0Z" fill="#4b354e" opacity=".3" />
                <path d="M0 500 Q350 410 650 480 T1200 460 T1440 465 V600 H0Z" fill="#261b22" opacity=".46" />
              </svg>
            </>
          )}
        </motion.div>
      </AnimatePresence>
      <div className="ambient-grain" />
    </div>
  );
}