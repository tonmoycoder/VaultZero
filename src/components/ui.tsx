import { cloneElement, isValidElement, memo, useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useIsPresent, type PanInfo } from "framer-motion";
import { Check, Copy, Timer, X } from "@phosphor-icons/react";
import { brands, type BrandKey, type Strength } from "../lib/vault";
import { cn } from "../utils/cn";
import { hapticSuccess, useMotionSettings } from "./Tactile";
import {
  spring,
  surfaceEntranceSpring,
  surfaceSpeedLabel,
  useDialogFocus,
} from "../lib/motion";
import {
  rubberBand,
  shouldDismiss,
  speedIntensity,
  speedLabel,
  stretchFromDelta,
} from "../lib/gesturePhysics";
import { copySecure } from "../lib/clipboard";

export function Logo({ size = 40, showGlow = true }: { size?: number; showGlow?: boolean }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      {showGlow && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-[28%] opacity-60 blur-md"
          style={{
            background: "radial-gradient(circle at 68% 82%, rgba(191, 95, 255, .9), rgba(91, 205, 255, .2) 60%, transparent 72%)",
          }}
        />
      )}
      <img
        src="/vaultzero-logo.png"
        alt="VaultZero emblem"
        width={size}
        height={size}
        className="relative h-full w-full rounded-[28%] border border-white/25 object-cover shadow-[0_4px_14px_rgba(30,20,70,.28)]"
      />
    </span>
  );
}

export function extractSafeDomain(urlOrDomain?: string, title?: string): string | null {
  if (!urlOrDomain && !title) return null;
  let raw = (urlOrDomain || "").trim().toLowerCase();

  // If no URL was provided, infer standard domain from known title
  if (!raw && title) {
    const t = title.trim().toLowerCase();
    if (t === "facebook" || t.includes("facebook")) raw = "facebook.com";
    else if (t === "google" || t.includes("google")) raw = "google.com";
    else if (t === "github" || t.includes("github")) raw = "github.com";
    else if (t === "apple" || t.includes("apple")) raw = "apple.com";
    else if (t === "spotify" || t.includes("spotify")) raw = "spotify.com";
    else if (t === "paypal" || t.includes("paypal")) raw = "paypal.com";
    else if (t === "twitter" || t === "x") raw = "x.com";
    else if (t === "discord" || t.includes("discord")) raw = "discord.com";
    else if (t === "reddit" || t.includes("reddit")) raw = "reddit.com";
    else if (t === "netflix" || t.includes("netflix")) raw = "netflix.com";
    else if (t.includes(".com") || t.includes(".net") || t.includes(".org") || t.includes(".io") || t.includes(".app") || t.includes(".me")) {
      raw = t;
    }
  }

  if (!raw) return null;

  try {
    if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
      raw = `https://${raw}`;
    }
    const parsed = new URL(raw);
    const host = parsed.hostname;
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(host)) return null;
    if (
      host === "localhost" ||
      host.endsWith(".internal") ||
      host.endsWith(".lan") ||
      host.startsWith("127.") ||
      host.startsWith("192.168.") ||
      host.startsWith("10.")
    ) {
      return null;
    }
    return host;
  } catch {
    return null;
  }
}

const KNOWN_OFFLINE_SVGS: Record<string, { name: string; hex: string; path: string }> = {
  "facebook.com": {
    name: "Facebook",
    hex: "#1877F2",
    path: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  },
  "discord.com": {
    name: "Discord",
    hex: "#5865F2",
    path: "M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z",
  },
  "reddit.com": {
    name: "Reddit",
    hex: "#FF4500",
    path: "M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.197-2.512-.73a.326.326 0 0 0-.232-.095z",
  },
  "netflix.com": {
    name: "Netflix",
    hex: "#E50914",
    path: "M5.398 0v.006c3.028 8.556 5.37 15.175 8.348 23.596 2.344.058 4.85.398 4.85.398-3.174-8.989-5.45-15.42-8.528-23.994l-4.67-.006zm9.864 0l4.34 23.994s2.21-.34 4.398-.398V0h-8.738zM0 0v23.994c2.188.058 4.398.398 4.398.398L8.738 0H0z",
  },
};

export function BrandMark({
  brand,
  size = 40,
  className,
  muted = false,
  url,
  title,
}: {
  brand: BrandKey;
  size?: number;
  className?: string;
  muted?: boolean;
  url?: string;
  title?: string;
}) {
  const safeDomain = useMemo(() => extractSafeDomain(url, title), [url, title]);

  // 1. VaultZero Native Emblem for internal demo/vault items only
  const isVaultZero =
    (brand === "vault" && !safeDomain && (!title || title.toLowerCase() === "vaultzero" || title.toLowerCase().includes("vaultzero demo"))) ||
    (safeDomain && (safeDomain.includes("vaultzero") || safeDomain === "vaultzero.me" || safeDomain === "vaultzero.local"));

  if (isVaultZero) {
    return (
      <span
        className={cn(
          "brand-tile inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[30%] border border-white/20 shadow-sm",
          className,
        )}
        style={{ width: size, height: size, background: "var(--accent-soft)" }}
        aria-label="VaultZero Native"
      >
        <Logo size={Math.round(size * 0.78)} showGlow={false} />
      </span>
    );
  }

  // 2. Built-in Offline SVG Fast-Path (O(1) lookup)
  const matchedOffline = safeDomain ? KNOWN_OFFLINE_SVGS[safeDomain] : null;
  if (matchedOffline) {
    return (
      <span
        className={cn(
          "brand-tile inline-flex shrink-0 items-center justify-center rounded-[30%] border border-white/10 shadow-sm",
          className,
        )}
        style={{ width: size, height: size, background: "rgba(255,255,255,0.06)" }}
        aria-label={matchedOffline.name}
      >
        <svg
          viewBox="0 0 24 24"
          width={Math.round(size * 0.54)}
          height={Math.round(size * 0.54)}
          fill={muted ? "currentColor" : matchedOffline.hex}
          aria-hidden="true"
          className="opacity-95"
        >
          <path d={matchedOffline.path} />
        </svg>
      </span>
    );
  }

  // 3. Registered vector in simple-icons (non-vault)
  const data = brands[brand];
  if (data && data.path && brand !== "vault") {
    return (
      <span
        className={cn(
          "brand-tile inline-flex shrink-0 items-center justify-center rounded-[30%]",
          className,
        )}
        style={{ width: size, height: size }}
        aria-label={data.name}
      >
        <svg
          viewBox="0 0 24 24"
          width={size * 0.52}
          height={size * 0.52}
          fill={muted ? "currentColor" : data.hex}
          aria-hidden="true"
          className="opacity-95"
        >
          <path d={data.path} />
        </svg>
      </span>
    );
  }

  // 4. V-87 — NO remote favicon stage. This is a 100% offline vault: asking
  //    Google s2 / DuckDuckGo for a favicon leaked every saved domain to a
  //    third party and printed cert/DNS failures on air-gapped devices. The
  //    offline SVG map, simple-icons vectors and the monogram below already
  //    cover every tile, so unknown domains fall through to them directly.

  // 5. Ultra-Crisp Vector Monogram Initial fallback
  const initial = (title || (safeDomain ? safeDomain.replace(/^www\./, "") : "")).trim().charAt(0).toUpperCase() || "V";

  return (
    <span
      className={cn(
        "brand-tile inline-flex shrink-0 items-center justify-center rounded-[30%] border border-white/10",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: data?.tint || "var(--accent-soft)",
      }}
      aria-label={title || "Vault item"}
    >
      <span
        className="flex h-full w-full items-center justify-center rounded-[30%] font-semibold text-main text-[13px]"
        style={{ color: data?.hex || "var(--accent)" }}
      >
        {initial}
      </span>
    </span>
  );
}

export function Avatar({
  name = "Vault Owner",
  size = 34,
  photoUrl,
  className,
}: {
  name?: string;
  size?: number;
  photoUrl?: string | null;
  className?: string;
}) {
  const [photo, setPhoto] = useState<string | null>(photoUrl || null);

  useEffect(() => {
    if (photoUrl !== undefined) {
      setPhoto(photoUrl);
      return;
    }
    const update = () => {
      if (typeof window !== "undefined") {
        setPhoto(localStorage.getItem("vaultzero_user_avatar"));
      }
    };
    update();
    window.addEventListener("vaultzero_profile_updated", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("vaultzero_profile_updated", update);
      window.removeEventListener("storage", update);
    };
  }, [photoUrl]);

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("") || "V";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/40 font-semibold text-white shadow-[0_5px_14px_rgba(70,45,150,.22)]",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.33,
        background:
          "radial-gradient(circle at 72% 24%, #e7c5ff 0%, #ab79e8 33%, #6850c4 67%, #293a81 100%)",
      }}
      aria-label={name}
    >
      {photo ? (
        <img src={photo} alt={name} className="h-full w-full object-cover" />
      ) : (
        <>
          <span className="relative z-10 tracking-tight">{initials}</span>
          <span className="absolute inset-x-1 top-0 h-1/2 rounded-full bg-white/20 blur-sm" />
        </>
      )}
    </span>
  );
}

/**
 * Tooltip.
 *
 * ACCESSIBILITY (V-16): the tooltip bubble is only a *visual* affordance, so
 * assistive technology never learns what an icon-only button does. We
 * therefore:
 *   1. give the bubble a stable `id`,
 *   2. clone the child element and inject `aria-describedby` pointing at it,
 *      so screen readers announce the label when the control is focused.
 *
 * When the child already has its own `aria-label`, we still attach the
 * description (it adds context rather than replacing the name).
 */
/**
 * A tooltip that escapes every overflow context and stays in the viewport.
 *
 * UX: the tooltip used to be a `position: absolute` child of its trigger.
 * That means any ancestor with `overflow: hidden` clips it — and the vault
 * card has exactly that (`.vault-card { overflow: hidden }`), so a tooltip on
 * a card action button was sliced in half. On a 97-character label such as
 * "Copy all account details (Title, Website, Username, Password, 2FA Code &
 * Notes) formatted line-by-line" inside the Inspector panel, the user saw
 * "Copy all account details (Title, Website, Username, Password, 2FA Code a"
 * and the rest was gone.
 *
 * The bubble is now rendered in a **portal** attached to `document.body`,
 * positioned with fixed coordinates measured from the trigger. That solves
 * three problems at once:
 *
 * 1. No ancestor can clip it.
 * 2. It is measured against the real viewport, so it can be clamped to stay
 *    on screen instead of hanging off the edge.
 * 3. It can wrap, so a long label becomes two readable lines rather than a
 *    500-pixel-wide strip.
 *
 * The trigger keeps `aria-describedby` pointing at the bubble, so screen
 * readers still announce it.
 */
export function Tooltip({
  label,
  children,
  side,
  up,
  className,
}: {
  label: string;
  children: ReactNode;
  side?: boolean;
  up?: boolean;
  className?: string;
}) {
  const bubbleId = useId();
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const bubbleRef = useRef<HTMLSpanElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number; placement: "top" | "bottom" | "side" } | null>(
    null
  );
  const [mounted, setMounted] = useState(false);

  const child = isValidElement(children)
    ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        "aria-describedby": bubbleId,
      })
    : children;

  const reposition = useCallback(() => {
    const wrap = wrapRef.current;
    const bubble = bubbleRef.current;
    if (!wrap || !bubble) return;

    const wrapRect = wrap.getBoundingClientRect();
    // The bubble is measured after the portal mount, when it is visible.
    const bubbleRect = bubble.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 10;
    const gap = 8;

    // Prefer the requested placement, then flip when it does not fit.
    let placement: "top" | "bottom" | "side" = side ? "side" : up ? "top" : "bottom";

    if (placement === "bottom" && wrapRect.bottom + gap + bubbleRect.height > viewportHeight - margin) {
      placement = "top";
    }
    if (placement === "top" && wrapRect.top - gap - bubbleRect.height < margin) {
      placement = "bottom";
    }
    if (placement === "side" && wrapRect.right + gap + bubbleRect.width > viewportWidth - margin) {
      placement = "side";
    }

    let top: number;
    let left: number;

    if (placement === "side") {
      top = wrapRect.top + wrapRect.height / 2 - bubbleRect.height / 2;
      left = wrapRect.right + gap;
    } else if (placement === "top") {
      top = wrapRect.top - gap - bubbleRect.height;
      left = wrapRect.left + wrapRect.width / 2 - bubbleRect.width / 2;
    } else {
      top = wrapRect.bottom + gap;
      left = wrapRect.left + wrapRect.width / 2 - bubbleRect.width / 2;
    }

    // Clamp horizontally so the bubble never leaves the viewport.
    if (left < margin) left = margin;
    if (left + bubbleRect.width > viewportWidth - margin) {
      left = Math.max(margin, viewportWidth - margin - bubbleRect.width);
    }
    // Clamp vertically as a final safety net.
    top = Math.max(margin, Math.min(top, viewportHeight - margin - bubbleRect.height));

    setPosition({ top, left, placement });
  }, [side, up]);

  const show = useCallback(() => {
    setMounted(true);
    // Measure after the bubble has been laid out.
    requestAnimationFrame(reposition);
  }, [reposition]);

  const hide = useCallback(() => {
    setMounted(false);
    setPosition(null);
  }, []);

  // Keep the bubble glued to the trigger while it is open.
  useEffect(() => {
    if (!mounted) return;
    const onScroll = () => reposition();
    const onResize = () => reposition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [mounted, reposition]);

  return (
    <span
      ref={wrapRef}
      className={cn("tooltip-wrap inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {child}
      {mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            id={bubbleId}
            ref={bubbleRef}
            className="tooltip-bubble tooltip-bubble-portal"
            data-placement={position?.placement ?? (side ? "side" : up ? "top" : "bottom")}
            style={
              position
                ? ({ top: position.top, left: position.left } as CSSProperties)
                : { top: -9999, left: -9999, visibility: "hidden" }
            }
            role="tooltip"
          >
            {label}
          </span>,
          document.body
        )}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>;
}

export function Modal({
  onClose,
  title,
  subtitle,
  icon,
  children,
  width = "max-w-[560px]",
  className,
  bodyClassName,
  footer,
  pullDown = false,
}: {
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  width?: string;
  className?: string;
  bodyClassName?: string;
  footer?: ReactNode;
  /** Enable pull-down-to-dismiss with elastic stretch (menus and sheets). */
  pullDown?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  // V-59: a completed pull-down drag must not leak a click into a control
  // inside the menu (which could close it or trigger an unrelated action).
  const draggedRef = useRef(false);
  const titleId = useId();
  const isPresent = useIsPresent();
  const { reduceMotion } = useMotionSettings();
  useDialogFocus(ref, onClose, isPresent);

  /**
   * V-58: a pull-down menu resists progressively, deforms, and rebounds.
   * Same physics as the inspector sheet, shared through `gesturePhysics`.
   */
  const clearStretch = () => {
    const element = surfaceRef.current;
    if (!element) return;
    element.style.removeProperty("scale");
    element.removeAttribute("data-elastic-state");
    element.removeAttribute("data-rebound-speed");
  };
  const onDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (reduceMotion || !pullDown) return;
    const element = surfaceRef.current;
    if (!element) return;
    const damp = rubberBand(Math.max(0, info.offset.y), element.getBoundingClientRect().height || 520);
    const stretch = stretchFromDelta(0, damp);
    draggedRef.current = true;
    element.dataset.elasticState = "stretch";
    element.style.scale = `${stretch.scaleX} ${stretch.scaleY}`;
  };
  const onDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!pullDown) return;
    const element = surfaceRef.current;
    const velocity = Math.abs(info.velocity.y);
    window.setTimeout(() => { draggedRef.current = false; }, 350);
    if (Math.abs(info.offset.y) < 3 && velocity < 50) { clearStretch(); return; }
    if (shouldDismiss(info.offset.y, info.velocity.y, 70)) {
      if (element) element.dataset.elasticState = "dismiss";
      onClose();
      return;
    }
    if (reduceMotion || !element) { clearStretch(); return; }
    const t = speedIntensity(velocity);
    const overshoot = 0.006 + t * 0.026;
    const reboundSpeed = speedLabel(velocity);
    element.dataset.elasticState = "rebound";
    element.dataset.reboundSpeed = reboundSpeed;
    element.dataset.lastRebound = reboundSpeed;
    const animation = element.animate(
      [
        { scale: element.style.scale || "1 1" },
        { scale: `${1 + overshoot} ${1 - overshoot}`, offset: 0.45 },
        { scale: "1 1" },
      ],
      { duration: Math.round(250 + t * 270), easing: "cubic-bezier(.22,1,.36,1)" },
    );
    animation.onfinish = clearStretch;
    animation.oncancel = clearStretch;
  };

  return createPortal(
    <motion.div
      ref={ref}
      tabIndex={-1}
      className="modal-overlay fixed inset-0 z-[100] flex items-end justify-center bg-[#070914]/35 p-0 backdrop-blur-[10px] sm:items-center sm:p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
      style={{ pointerEvents: isPresent ? "auto" : "none" }}
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <motion.div
        ref={surfaceRef}
        data-elastic={pullDown ? "pull-down" : "surface"}
        data-surface-speed={surfaceSpeedLabel()}
        initial={{ y: reduceMotion ? 0 : 24, scale: reduceMotion ? 1 : 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: reduceMotion ? 0 : 16, scale: reduceMotion ? 1 : 0.97, transition: reduceMotion ? { duration: 0 } : surfaceEntranceSpring(false, "close") }}
        /*
         * UX / "Living Flow" (V-58): open and close springs are now chosen
         * from the gesture speed that triggered them. A gentle tap settles
         * softly; a fast one overshoots. Both are under-damped, so the
         * surface actually bounces instead of sliding to a dead stop.
         */
        transition={reduceMotion ? { duration: 0 } : surfaceEntranceSpring(false, "open")}
        drag={pullDown && !reduceMotion ? "y" : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.55 }}
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
        className={cn(
          "glass-strong modal-surface flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] sm:rounded-[26px]",
          width,
          className,
        )}
        style={{ boxShadow: "0 40px 100px rgba(8,10,28,.38), var(--inset-hi)" }}
      >
        {/*
          UX: the header row used to let a long title run under the close
          button, because the title block had `min-w-0` but no truncation
          and the row itself had no `overflow-hidden`. The title and the
          right-hand actions visually overlapped.

          The header now clips its content, the title truncates on one line,
          and the subtitle is clamped to two lines so it can never push the
          body off the screen.
        */}
        <header className="flex shrink-0 items-start justify-between gap-3 overflow-hidden px-5 pb-3 pt-5 sm:gap-4 sm:px-6 sm:pt-6">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            {icon && (
              <span
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border"
                style={{
                  color: "var(--accent)",
                  background: "var(--accent-soft)",
                  borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)",
                }}
              >
                {icon}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h2
                id={titleId}
                className="truncate font-display text-[19px] font-semibold leading-tight tracking-[-0.02em] text-main"
                title={typeof title === "string" ? title : undefined}
              >
                {title}
              </h2>
              {subtitle && (
                <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted">{subtitle}</p>
              )}
            </div>
          </div>
          <Tooltip label="Close · Esc">
            <button
              onClick={onClose}
              className="icon-button -mr-1 -mt-1 h-8 w-8 shrink-0 rounded-full"
              aria-label="Close dialog"
            >
              <X size={15} weight="bold" />
            </button>
          </Tooltip>
        </header>
        <div className={cn("thin-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6", bodyClassName)}>
          {children}
        </div>
        {footer && (
          <footer
            className="shrink-0 border-t border-[var(--border-soft)] px-5 py-3.5 sm:px-6"
            style={{ background: "var(--glass-soft)" }}
          >
            {footer}
          </footer>
        )}
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  const { reduceMotion } = useMotionSettings();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors duration-200"
      style={{
        background: checked ? "var(--accent)" : "var(--border-ink)",
        borderColor: checked ? "color-mix(in srgb, var(--accent) 70%, white)" : "var(--border-soft)",
      }}
    >
      <motion.span
        className="absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white shadow-sm"
        initial={false}
        animate={{ x: checked ? 16 : 0 }}
        transition={reduceMotion ? { duration: 0 } : spring}
        style={{ left: 2 }}
      />
    </button>
  );
}

export function StrengthDots({ strength, score, className }: { strength: Strength; score: number; className?: string }) {
  const color = strength === "strong" ? "var(--success)" : strength === "fair" ? "var(--warning)" : "var(--danger)";
  return (
    <span className={cn("inline-flex items-center gap-[3px]", className)} aria-label={`Password strength: ${strength}`}>
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className="h-[3px] w-[9px] rounded-full transition-colors"
          style={{ background: n <= score ? color : "var(--border-ink)" }}
        />
      ))}
    </span>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[9px] font-bold uppercase tracking-[0.14em] text-faint", className)}>{children}</p>
  );
}

export function CopyButton({
  value,
  onCopied,
  label = "Copy",
  filled,
  className,
}: {
  value: string;
  onCopied: (message: string) => void;
  label?: string;
  filled?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await copySecure(value);
    setCopied(true);
    hapticSuccess();
    onCopied(`${label} copied to clipboard (auto-wipes in 30s)`);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Tooltip label={copied ? "Copied" : label}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void copy();
        }}
        className={cn(
          "inline-flex items-center justify-center rounded-full transition-colors",
          filled
            ? "h-8 gap-1.5 px-3 text-[10.5px] font-semibold text-white"
            : "h-7 w-7 text-muted hover:text-main",
          className,
        )}
        style={filled ? { background: "var(--accent)" } : {}}
        aria-label={label}
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={copied ? "copied" : "copy"}
            className="inline-flex"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.13 }}
          >
            {copied ? <Check size={13} weight="bold" className="text-success" /> : <Copy size={13} weight="duotone" />}
          </motion.span>
        </AnimatePresence>
        {filled && <span>{copied ? "Copied" : label}</span>}
      </button>
    </Tooltip>
  );
}

/**
 * A single shared one-second ticker for the whole application.
 *
 * PERFORMANCE: `useCountdown` used to create its own `setInterval` per
 * caller. The vault list renders a TOTP ring on **every** card that has
 * two-factor enabled, so a 500-entry vault with 2FA started 500 timers and
 * performed 500 state updates every second — a constant, invisible CPU tax
 * that scaled with the size of the vault and re-rendered every card each
 * tick.
 *
 * One shared timer now drives every countdown in the app. The number of
 * subscribers is bounded by the number of visible components, but the
 * *timers* are always exactly one.
 *
 * The tick is also aligned to the wall-clock second, so every countdown
 * flips at the same instant instead of drifting apart.
 */
type TickListener = () => void;

const tickListeners = new Set<TickListener>();
let tickTimer: number | null = null;

/**
 * Schedules the next tick.
 *
 * The first tick of a "session" is aligned to the next whole second, so
 * every countdown in the app flips on the same frame instead of drifting
 * apart. Subsequent ticks run once per second.
 */
function scheduleTick(delay: number): void {
  if (typeof window === "undefined") return;
  tickTimer = window.setTimeout(() => {
    tickTimer = null;
    for (const listener of tickListeners) listener();
    if (tickListeners.size > 0) scheduleTick(1000);
  }, delay);
}

function subscribeToTick(listener: TickListener): () => void {
  tickListeners.add(listener);

  if (tickTimer === null) {
    scheduleTick(1000 - (Date.now() % 1000));
  }

  return () => {
    tickListeners.delete(listener);
    if (tickListeners.size === 0 && tickTimer !== null) {
      window.clearTimeout(tickTimer);
      tickTimer = null;
    }
  };
}

export function useCountdown(period = 30) {
  const compute = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    return period - (now % period);
  }, [period]);

  const [remaining, setRemaining] = useState(compute);

  useEffect(() => {
    setRemaining(compute());
    return subscribeToTick(() => {
      setRemaining(compute());
    });
  }, [compute]);

  return { remaining, progress: remaining / period };
}

export function TotpRing({
  size = 32,
  remaining,
  progress,
  stroke = 2.5,
}: {
  size?: number;
  remaining: number;
  progress: number;
  stroke?: number;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = remaining <= 5 ? "var(--danger)" : "var(--accent)";
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-ink)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span
        className="absolute font-mono font-semibold tabular-nums"
        style={{ color, fontSize: size * 0.3 }}
      >
        {remaining}
      </span>
    </span>
  );
}

export function GlassCheck({
  checked,
  onChange,
  label,
  className,
  style,
}: {
  checked: boolean;
  onChange: () => void;
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border transition-all",
        className,
      )}
      style={{
        background: checked ? "var(--accent)" : "var(--glass-input)",
        borderColor: checked ? "var(--accent)" : "var(--border)",
        ...style,
      }}
    >
      {checked && <Check size={11} weight="bold" className="text-white" />}
    </button>
  );
}

export const IsolatedTotpClock = memo(function IsolatedTotpClock({
  size = 29,
  stroke = 2.3,
  showLabel = false,
  label = "expires",
  suffix = "s",
}: {
  size?: number;
  stroke?: number;
  showLabel?: boolean;
  label?: string;
  suffix?: string;
}) {
  const { remaining, progress } = useCountdown();
  return (
    <div className="inline-flex items-center gap-1.5">
      <TotpRing size={size} remaining={remaining} progress={progress} stroke={stroke} />
      {showLabel && (
        <span className="flex items-center gap-1 text-[7.5px] text-faint font-mono">
          <Timer size={9} />
          {label} {remaining}{suffix}
        </span>
      )}
    </div>
  );
});

