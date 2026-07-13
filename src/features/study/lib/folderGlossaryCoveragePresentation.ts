export interface FolderGlossaryCoveragePresentation {
  percent: number;
  label: string;
  complete: boolean;
}

/**
 * A rounded percentage must never claim 100% while unresolved occurrences
 * still exist. Keep one decimal near completion and reserve the complete state
 * for an exact covered/total match.
 */
export function getFolderGlossaryCoveragePresentation(
  coveredOccurrences: number,
  totalOccurrences: number,
): FolderGlossaryCoveragePresentation {
  const safeCovered = Math.max(0, Number(coveredOccurrences) || 0);
  const safeTotal = Math.max(0, Number(totalOccurrences) || 0);
  const complete = safeTotal > 0 && safeCovered >= safeTotal;
  const rawPercent = safeTotal > 0
    ? Math.min(100, (safeCovered / safeTotal) * 100)
    : 0;
  const percent = complete
    ? 100
    : Math.min(99.9, Math.round(rawPercent * 10) / 10);
  const label = percent.toLocaleString("pt-BR", {
    minimumFractionDigits: Number.isInteger(percent) ? 0 : 1,
    maximumFractionDigits: 1,
  });

  return { percent, label, complete };
}
