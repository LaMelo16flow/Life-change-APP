import { useEffect, useMemo, useRef, useState } from 'react';

interface MasonryGridProps<T> {
  items: T[];
  getKey: (item: T) => string;
  columns: number;
  gap?: number;
  renderItem: (item: T) => React.ReactNode;
  className?: string;
}

// A real masonry layout: each card is placed into whichever column is
// currently shortest, based on its actual measured height. CSS multi-column
// (`columns-*` + `break-inside-avoid`) looks similar but only pre-estimates a
// balanced split of the DOM order up front - with cards whose height varies
// a lot (uncropped product photos of different shapes, loading async) that
// estimate is wrong and dumps a run of items into one column while the
// others sit half-empty. Measuring real heights and reflowing as they
// change (image load, text wrap, filter/search) avoids that.
export function MasonryGrid<T,>({ items, getKey, columns, gap = 24, renderItem, className }: MasonryGridProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [containerWidth, setContainerWidth] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const itemsKey = items.map(getKey).join('|');

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      setHeights((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const entry of entries) {
          const key = (entry.target as HTMLElement).dataset.masonryKey;
          if (!key) continue;
          const h = Math.round(entry.contentRect.height);
          if (next[key] !== h) {
            next[key] = h;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });
    itemRefs.current.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [itemsKey, columns]);

  const { positions, containerHeight, columnWidth } = useMemo(() => {
    const safeColumns = Math.max(1, columns);
    const width = safeColumns === 1 || !containerWidth
      ? containerWidth
      : (containerWidth - gap * (safeColumns - 1)) / safeColumns;
    const colHeights = new Array(safeColumns).fill(0);
    const pos: Record<string, { top: number; left: number }> = {};
    for (const item of items) {
      const key = getKey(item);
      const h = heights[key] ?? 420;
      let col = 0;
      for (let c = 1; c < safeColumns; c++) {
        if (colHeights[c] < colHeights[col]) col = c;
      }
      pos[key] = { top: colHeights[col], left: col * (width + gap) };
      colHeights[col] += h + gap;
    }
    const maxHeight = colHeights.length ? Math.max(...colHeights) - gap : 0;
    return { positions: pos, containerHeight: Math.max(0, maxHeight), columnWidth: width };
  }, [items, heights, columns, containerWidth, gap, getKey]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', height: containerHeight || undefined }}
    >
      {items.map((item) => {
        const key = getKey(item);
        const pos = positions[key];
        return (
          <div
            key={key}
            ref={(el) => {
              if (el) itemRefs.current.set(key, el);
              else itemRefs.current.delete(key);
            }}
            data-masonry-key={key}
            style={{
              position: 'absolute',
              top: pos ? pos.top : 0,
              left: pos ? pos.left : 0,
              width: columnWidth || undefined,
              transition: 'top 0.25s ease, left 0.25s ease',
            }}
          >
            {renderItem(item)}
          </div>
        );
      })}
    </div>
  );
}
