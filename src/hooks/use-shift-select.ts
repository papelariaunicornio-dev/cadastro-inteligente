import { useState, useRef, useCallback } from 'react';

/**
 * Hook for multi-select with Shift+Click support (Windows-style).
 *
 * - Click: toggle single item
 * - Shift+Click: select range from last clicked to current
 */
export function useShiftSelect<T extends number>(orderedIds: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<T>>(new Set());
  const lastClickedRef = useRef<T | null>(null);

  const toggleSelect = useCallback((id: T, shiftKey: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (shiftKey && lastClickedRef.current !== null) {
        // Shift+Click: select range
        const lastIdx = orderedIds.indexOf(lastClickedRef.current);
        const currentIdx = orderedIds.indexOf(id);

        if (lastIdx !== -1 && currentIdx !== -1) {
          const start = Math.min(lastIdx, currentIdx);
          const end = Math.max(lastIdx, currentIdx);

          for (let i = start; i <= end; i++) {
            next.add(orderedIds[i]);
          }
        }
      } else {
        // Normal click: toggle
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }

      return next;
    });

    lastClickedRef.current = id;
  }, [orderedIds]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(orderedIds));
  }, [orderedIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastClickedRef.current = null;
  }, []);

  return { selectedIds, toggleSelect, selectAll, clearSelection, setSelectedIds };
}
