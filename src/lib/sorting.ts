type SortableActivity = {
  last_activity?: string | null;
  order_index?: number | null;
  class_id?: string | null;
};

function activityTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * Natural sorter used by folder/list screens.
 *
 * Personal folders:
 * 1. Most recently opened/studied lists.
 * 2. Persisted order for untouched items.
 * 3. Natural title order.
 *
 * Classroom folders:
 * 1. Manual persisted order only.
 * 2. Natural title order as fallback.
 *
 * `class_id` is the boundary that prevents the responsive personal-library
 * behavior from overriding the teacher's manual classroom organization.
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
    const isClassroomContext = Boolean(aSortable.class_id || bSortable.class_id);

    if (!isClassroomContext) {
      const aActivity = activityTimestamp(aSortable.last_activity);
      const bActivity = activityTimestamp(bSortable.last_activity);

      if (aActivity !== null || bActivity !== null) {
        if (aActivity === null) return 1;
        if (bActivity === null) return -1;
        if (aActivity !== bActivity) return bActivity - aActivity;
      }
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
 * Natural sort for simple string arrays.
 */
export function naturalSortStrings(data: string[]): string[] {
  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
    ignorePunctuation: true,
  });

  return [...data].sort((a, b) => collator.compare(a, b));
}
