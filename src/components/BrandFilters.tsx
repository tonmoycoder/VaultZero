import { CaretLeft, CaretRight, Sparkle } from "@phosphor-icons/react";
import { LayoutGroup, motion } from "framer-motion";
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { brands, t, type BrandKey, type Language, type VaultItem } from "../lib/vault";
import GlassSelection from "./GlassSelection";
import { useMotionSettings } from "./Tactile";
import { BrandMark } from "./ui";

export default function BrandFilters({ items, active, onChange, lang }: {
  items: VaultItem[];
  active: BrandKey | "all";
  onChange: (brand: BrandKey | "all") => void;
  lang: Language;
}) {
  const groupId = useId();
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; scroll: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const { reduceMotion } = useMotionSettings();
  const options = useMemo(() => {
    const counts = new Map<BrandKey, number>();
    items.forEach((item) => counts.set(item.brand, (counts.get(item.brand) ?? 0) + 1));
    return [
      { id: "all" as const, name: t(lang, "allBrands"), count: items.length },
      ...[...counts.entries()].sort((a, b) => b[1] - a[1])
        .map(([id, count]) => ({ id, name: brands[id].name, count })),
    ];
  }, [items, lang]);

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const update = () => setEdges({
      left: element.scrollLeft > 2,
      right: element.scrollLeft + element.clientWidth < element.scrollWidth - 2,
    });
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 18 : 1);
      const canScroll = delta > 0
        ? element.scrollLeft + element.clientWidth < element.scrollWidth - 1
        : element.scrollLeft > 1;
      if (canScroll) {
        event.preventDefault();
        element.scrollLeft += delta;
      }
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener("scroll", update, { passive: true });
    element.addEventListener("wheel", onWheel, { passive: false });
    update();
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
      element.removeEventListener("wheel", onWheel);
    };
  }, [options]);

  const scrollBy = (direction: number) => {
    const element = rail.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth * 0.65, behavior: reduceMotion ? "instant" : "smooth" });
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    suppressClick.current = drag.current.moved;
    drag.current = null;
    event.currentTarget.dataset.dragging = "false";
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <LayoutGroup id={groupId}>
      <div className="brand-filter-row" aria-label="Filter vault by brand">
        <button className="brand-scroll-arrow" aria-label="Scroll brands left" disabled={!edges.left} onClick={() => scrollBy(-1)}>
          <CaretLeft size={13} weight="bold" />
        </button>
        <motion.div
          layoutScroll
          ref={rail}
          className="brand-rail thin-scrollbar"
          data-testid="brand-scroll"
          onPointerLeave={() => setHovered(null)}
          onPointerDown={(event) => {
            suppressClick.current = false;
            if (event.pointerType !== "mouse" || event.button !== 0) return;
            drag.current = { x: event.clientX, scroll: event.currentTarget.scrollLeft, moved: false };
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            const distance = event.clientX - drag.current.x;
            if (Math.abs(distance) > 6) {
              drag.current.moved = true;
              event.currentTarget.dataset.dragging = "true";
              event.currentTarget.setPointerCapture(event.pointerId);
              event.currentTarget.scrollLeft = drag.current.scroll - distance;
            }
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={(event) => {
            if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
          }}
          onDragStart={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            const index = options.findIndex((option) => option.id === (event.target as HTMLElement).dataset.brand);
            if (index < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
              : Math.max(0, Math.min(options.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)));
            const button = event.currentTarget.querySelector<HTMLButtonElement>(`[data-brand="${options[next].id}"]`);
            button?.focus({ preventScroll: true });
            button?.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth", block: "nearest", inline: "nearest" });
          }}
        >
          <div className="brand-rail-track">
            {options.map((option) => (
              <button
                key={option.id}
                className="brand-filter"
                data-brand={option.id}
                data-glass-option="true"
                aria-pressed={active === option.id}
                aria-label={`Filter by ${option.name}`}
                onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(option.id); }}
                onFocus={() => setHovered(option.id)}
                onBlur={() => setHovered(null)}
                onClick={(event) => {
                  onChange(option.id);
                  event.currentTarget.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth", block: "nearest", inline: "nearest" });
                }}
              >
                {active === option.id && <GlassSelection id="brand-selected" />}
                {hovered === option.id && active !== option.id && <GlassSelection id="brand-hover" hover />}
                {option.id === "all" ? <Sparkle size={14} weight="duotone" /> : <BrandMark brand={option.id} size={21} className="!shadow-none" />}
                <span>{option.name}</span>
                <small>{String(option.count).padStart(2, "0")}</small>
              </button>
            ))}
          </div>
        </motion.div>
        <button className="brand-scroll-arrow" aria-label="Scroll brands right" disabled={!edges.right} onClick={() => scrollBy(1)}>
          <CaretRight size={13} weight="bold" />
        </button>
      </div>
    </LayoutGroup>
  );
}