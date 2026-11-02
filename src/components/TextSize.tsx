import { Minus, Plus, TextAa } from "@phosphor-icons/react";
import { Tooltip } from "./ui";
import { cn } from "../utils/cn";

/**
 * Base visual multiplier:
 * 122% visual size from v2.5.1 is now established as the 100% baseline.
 */
export const BASE_FONT_MULTIPLIER = 1.22;

/**
 * Display percentage steps:
 * Index 0: 80% (Compact)
 * Index 1: 90% (Small)
 * Index 2: 100% (Default baseline, rendering at 1.22x visual scale)
 * Index 3: 115% (Large)
 * Index 4: 130% (Largest)
 */
export const TEXT_STEPS = [0.80, 0.90, 1.00, 1.15, 1.30] as const;
export const DEFAULT_TEXT_STEP = 2; // 1.00 -> 100%

export const getEffectiveScale = (index: number): number => {
  const normalized = TEXT_STEPS[index] ?? 1.00;
  return Number((normalized * BASE_FONT_MULTIPLIER).toFixed(4));
};

export const stepLabel = (index: number) =>
  ["Compact", "Small", "Default", "Large", "Largest"][index] ?? "Default";

export default function TextSizeControl({
  index,
  onChange,
  compact = false,
  className,
}: {
  index: number;
  onChange: (index: number) => void;
  compact?: boolean;
  className?: string;
}) {
  const percent = Math.round(TEXT_STEPS[index] * 100);
  return (
    <div
      className={cn("text-size-control", compact && "is-compact", className)}
      role="group"
      aria-label={`Text size: ${stepLabel(index)}`}
      data-testid="text-size-control"
    >
      <Tooltip label="Smaller text">
        <button
          onClick={() => onChange(Math.max(0, index - 1))}
          disabled={index === 0}
          aria-label="Decrease text size"
        >
          <Minus size={11} weight="bold" />
        </button>
      </Tooltip>

      <Tooltip label={`Text size · ${stepLabel(index)} (${percent}%)`}>
        <button
          onClick={() => onChange(DEFAULT_TEXT_STEP)}
          className="text-size-value"
          aria-label={`Text size ${percent} percent. Reset to default`}
        >
          <TextAa size={compact ? 13 : 14} weight="duotone" />
          {!compact && <span>{percent}%</span>}
        </button>
      </Tooltip>

      <Tooltip label="Larger text">
        <button
          onClick={() => onChange(Math.min(TEXT_STEPS.length - 1, index + 1))}
          disabled={index === TEXT_STEPS.length - 1}
          aria-label="Increase text size"
        >
          <Plus size={11} weight="bold" />
        </button>
      </Tooltip>
    </div>
  );
}
