/**
 * Natural sort utility for sorting strings with embedded numbers correctly.
 * E.g., "Passo 2" comes before "Passo 10" (not 1, 10, 2).
 */
export function naturalSort<T>(data: T[], keySelector: (item: T) => string): T[] {
  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: 'base',
    ignorePunctuation: true
  });

  return [...data].sort((a, b) => {
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
    ignorePunctuation: true
  });

  return [...data].sort((a, b) => collator.compare(a, b));
}
