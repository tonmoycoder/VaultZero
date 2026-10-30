import { Minus, Plus, TextAa } from "@phosphor-icons/react";
import { Tooltip } from "./ui";
import { cn } from "../utils/cn";

export const TEXT_STEPS = [0.9, 1, 1.1, 1.22, 1.35] as const;
export const DEFAULT_TEXT_STEP = 1;

export const stepLabel = (index: number) =>
  ["Compact", "Default", "Comfortable", "Large", "Largest"][index] ?? "Default";

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
