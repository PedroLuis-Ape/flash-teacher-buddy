export type StudyProgressMode = "mastery" | "continuous";

export type StudyProgressMetricsInput = {
  mode: StudyProgressMode;
  overallTotal: number;
  masteredTotal?: number;
  currentIndex: number;
  currentRoundTotal: number;
};

export type StudyProgressMetrics = {
  overallCompleted: number;
  overallRemaining: number;
  overallPercent: number;
  roundPosition: number;
  roundPercent: number;
};

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function percent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (completed / total) * 100));
}

/**
 * Produces the two progress layers used by the compact study HUD.
 *
 * In mastery rounds, overall progress means unique cards already mastered.
 * In continuous sessions, it means the current position in the effective deck.
 */
export function resolveStudyProgressMetrics(
  input: StudyProgressMetricsInput,
): StudyProgressMetrics {
  const overallTotal = clampInteger(input.overallTotal, 0, Number.MAX_SAFE_INTEGER);
  const currentRoundTotal = clampInteger(input.currentRoundTotal, 0, Number.MAX_SAFE_INTEGER);
  const roundPosition = currentRoundTotal === 0
    ? 0
    : clampInteger(input.currentIndex + 1, 0, currentRoundTotal);

  const overallCompleted = input.mode === "mastery"
    ? clampInteger(input.masteredTotal ?? 0, 0, overallTotal)
    : clampInteger(roundPosition, 0, overallTotal);

  return {
    overallCompleted,
    overallRemaining: Math.max(0, overallTotal - overallCompleted),
    overallPercent: percent(overallCompleted, overallTotal),
    roundPosition,
    roundPercent: percent(roundPosition, currentRoundTotal),
  };
}
