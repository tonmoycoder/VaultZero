import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface VirtualWindow {
  /** Index of the first rendered item. */
  startIndex: number;
  /** Index **after** the last rendered item. */
  endIndex: number;
  /** Number of items before the window (for spacer sizing). */
  paddingTop: number;
  /** Number of items after the window (for spacer sizing). */
  paddingBottom: number;
  /** Total number of items in the list. */
  total: number;
}

/**
 * PERFORMANCE (V-37): windowing for long lists.
 *
 * The vault list used to render one `ItemCard` per entry with no upper
 * bound. A 10,000-entry vault created 10,000 card subtrees, which stalls
 * the main thread long enough to make the "120 fps" claim untrue — and the
 * cost grows with every keystroke in the search box, because the whole list
 * is re-rendered.
 *
 * This hook renders only the items that are near the viewport, plus a small
 * overscan so scrolling does not reveal blank space. The two spacer
 * elements keep the scrollbar the correct length, so the user can still
 * scroll to the end and the scroll position stays stable.
 *
 * @param count      Total number of items.
 * @param estimate   Estimated height of one item in pixels. A constant
 *                   average is used rather than measuring every row, which
 *                   would force a layout pass per item.
 * @param overscan   How many extra rows to render above and below the
 *                   visible area.
 */
export function useVirtualList(
  count: number,
  estimate: number,
  overscan: number = 4
): { ref: React.RefObject<HTMLDivElement | null>; window: VirtualWindow } {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    setScrollTop(node.scrollTop);
    setViewportHeight(node.clientHeight);
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, count]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const onScroll = () => {
      // `requestAnimationFrame` keeps the scroll handler off the critical
      // path: the state update happens once per frame, not once per event.
      const tracked = node as HTMLDivElement & { _raf?: number };
      if (tracked._raf !== undefined) cancelAnimationFrame(tracked._raf);
      tracked._raf = requestAnimationFrame(() => {
        setScrollTop(node.scrollTop);
      });
    };

    node.addEventListener("scroll", onScroll, { passive: true });

    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measure()) : null;
    observer?.observe(node);

    return () => {
      node.removeEventListener("scroll", onScroll);
      observer?.disconnect();
      const raf = (node as HTMLDivElement & { _raf?: number })._raf;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [measure]);

  const safeCount = Math.max(0, count);
  const rowHeight = Math.max(1, estimate);

  // Before the viewport has been measured (the first render), render a
  // small, conservative window rather than everything.
  if (viewportHeight === 0) {
    const initial = Math.min(safeCount, overscan * 2 + 4);
    return {
      ref,
      window: {
        startIndex: 0,
        endIndex: initial,
        paddingTop: 0,
        paddingBottom: Math.max(0, (safeCount - initial) * rowHeight),
        total: safeCount,
      },
    };
  }

  const firstVisible = Math.floor(scrollTop / rowHeight);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + 1;

  const startIndex = Math.max(0, firstVisible - overscan);
  const endIndex = Math.min(safeCount, firstVisible + visibleCount + overscan);

  return {
    ref,
    window: {
      startIndex,
      endIndex,
      paddingTop: startIndex * rowHeight,
      paddingBottom: Math.max(0, (safeCount - endIndex) * rowHeight),
      total: safeCount,
    },
  };
}
