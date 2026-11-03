import { LockKey } from "@phosphor-icons/react";
import { Tooltip } from "./ui";
import { cn } from "../utils/cn";
import { AUTO_LOCK_PRESETS } from "../lib/autoLock";

/**
 * Auto-Lock timeout selector (V-06).
 *
 * A password manager must re-lock itself. This control lets the user pick how
 * long the vault may stay open without activity before it locks automatically.
 */
export default function AutoLockControl({
  minutes,
  onChange,
  lang = "en",
  className,
}: {
  minutes: number;
  onChange: (minutes: number) => void;
  lang?: "en" | "bn";
  className?: string;
}) {
  const label = (m: number) => {
    if (m === 0) return lang === "bn" ? "বন্ধ" : "Off";
    if (m === 60) return lang === "bn" ? "১ ঘণ্টা" : "1h";
    return lang === "bn" ? `${m} মিনিট` : `${m}m`;
  };

  const ariaLabel =
    lang === "bn"
      ? "স্বয়ংক্রিয় লক সময়"
      : "Auto-lock timeout";

  return (
    <div
      className={cn("auto-lock-control", className)}
      role="radiogroup"
      aria-label={ariaLabel}
      data-testid="auto-lock-control"
    >
      {AUTO_LOCK_PRESETS.map((m) => {
        const active = minutes === m;
        return (
          <Tooltip key={m} label={`${ariaLabel}: ${label(m)}`}>
            <button
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${ariaLabel}: ${label(m)}`}
              onClick={() => onChange(m)}
              className={cn(
                "auto-lock-option",
                active && "is-active"
              )}
            >
              {active ? <LockKey size={10} weight="fill" /> : null}
              <span>{label(m)}</span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
