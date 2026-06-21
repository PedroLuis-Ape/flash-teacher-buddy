type SortableActivity = {
  last_activity?: string | null;
  order_index?: number | null;
};

function activityTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * Natural sort utility for sorting strings with embedded numbers correctly.
 * E.g., "Passo 2" comes before "Passo 10" (not 1, 10, 2).
 *
 * Priority:
 * 1. Most recently used items when `last_activity` is available.
 * 2. Explicit persisted `order_index` for items without recent activity.
 * 3. Natural title order as the stable fallback.
 *
 * This keeps normal/manual ordering intact for untouched lists, while a list
 * that the current user opens or studies automatically moves to the top.
 */
export function naturalSort<T>(data: T[], keySelector: (item: T) => string): T[] {
  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
    ignorePunctuation: true,
  });

  return [...data].sort((a, b) => {
    const aSortable = a as SortableActivity;
    const bSortable = b as SortableActivity;
    const aActivity = activityTimestamp(aSortable.last_activity);
    const bActivity = activityTimestamp(bSortable.last_activity);

    if (aActivity !== null || bActivity !== null) {
      if (aActivity === null) return 1;
      if (bActivity === null) return -1;
      if (aActivity !== bActivity) return bActivity - aActivity;
    }

    const aOrder = Number(aSortable.order_index ?? 0);
    const bOrder = Number(bSortable.order_index ?? 0);
    const aHasOrder = Number.isFinite(aOrder) && aOrder > 0;
    const bHasOrder = Number.isFinite(bOrder) && bOrder > 0;

    if (aHasOrder && bHasOrder && aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    if (aHasOrder !== bHasOrder) {
      return aHasOrder ? -1 : 1;
    }

    return collator.compare(keySelector(a), keySelector(b));
  });
}

/**
 * Natural sort for simple string arrays
 */
export function naturalSortStrings(data: string[]): string[] {
  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
    ignorePunctuation: true,
  });

  return [...data].sort((a, b) => collator.compare(a, b));
}
