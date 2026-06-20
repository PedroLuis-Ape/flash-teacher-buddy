/**
 * Natural sort utility for sorting strings with embedded numbers correctly.
 * E.g., "Passo 2" comes before "Passo 10" (not 1, 10, 2).
 *
 * When items expose a positive `order_index`, that explicit persisted order
 * takes priority. This keeps classroom/folder organization independent from
 * titles such as 001, 002 or 003.
 */
export function naturalSort<T>(data: T[], keySelector: (item: T) => string): T[] {
  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: 'base',
    ignorePunctuation: true,
  });

  return [...data].sort((a, b) => {
    const aOrder = Number((a as { order_index?: number | null }).order_index ?? 0);
    const bOrder = Number((b as { order_index?: number | null }).order_index ?? 0);
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
    sensitivity: 'base',
    ignorePunctuation: true,
  });

  return [...data].sort((a, b) => collator.compare(a, b));
}
