import { useEffect, useRef, useState, type ReactNode } from "react";

interface TopHorizontalScrollbarProps {
  children: ReactNode;
  className?: string;
}

/**
 * Renders a sticky top horizontal scrollbar that mirrors the horizontal scroll
 * of a Radix ScrollArea (or any element with an overflow-x scrollable descendant).
 * Lets users scroll horizontally without scrolling down to the bottom of the grid.
 */
export const TopHorizontalScrollbar = ({ children, className }: TopHorizontalScrollbarProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const syncing = useRef<"top" | "bottom" | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // Radix ScrollArea viewport
    const vp = containerRef.current.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]"
    ) ?? containerRef.current.querySelector<HTMLElement>(".overflow-auto, .overflow-x-auto");
    if (!vp) return;
    viewportRef.current = vp;

    const measure = () => {
      const inner = vp.firstElementChild as HTMLElement | null;
      const w = inner?.scrollWidth ?? vp.scrollWidth;
      setScrollWidth(w);
      // Mirror RTL direction onto the top scrollbar so scrollLeft semantics match.
      if (topBarRef.current) {
        const dir = getComputedStyle(vp).direction;
        topBarRef.current.style.direction = dir;
      }
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    if (vp.firstElementChild) ro.observe(vp.firstElementChild as Element);

    const onVpScroll = () => {
      if (syncing.current === "top") { syncing.current = null; return; }
      if (topBarRef.current) {
        syncing.current = "bottom";
        topBarRef.current.scrollLeft = vp.scrollLeft;
      }
    };
    vp.addEventListener("scroll", onVpScroll, { passive: true });

    return () => {
      ro.disconnect();
      vp.removeEventListener("scroll", onVpScroll);
    };
  }, [children]);

  const onTopScroll = () => {
    if (syncing.current === "bottom") { syncing.current = null; return; }
    const vp = viewportRef.current;
    if (vp && topBarRef.current) {
      syncing.current = "top";
      vp.scrollLeft = topBarRef.current.scrollLeft;
    }
  };

  return (
    <div className={className}>
      <div
        ref={topBarRef}
        onScroll={onTopScroll}
        className="sticky top-0 z-20 overflow-x-auto overflow-y-hidden bg-background border-b"
        style={{ height: 14 }}
      >
        <div style={{ width: scrollWidth, height: 1 }} />
      </div>
      <div ref={containerRef}>{children}</div>
    </div>
  );
};

