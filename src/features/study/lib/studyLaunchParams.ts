import {
  normalizeStudyMode,
  studyModeToUrlParam,
  type StudyMode,
} from "@/features/study/lib/studyMode";

export type StudyLaunchMode = StudyMode | "multiple";

/**
 * Builds the URL for a new study session without copying saved preferences into
 * query parameters. Direction, order, favorites and fast mode are restored by
 * useStudyPreferences for the selected game mode.
 *
 * Keeping those fields out of the URL is intentional: URL parameters have
 * session-override priority and previously replaced the Write/Mixed presets
 * with the Flip preset every time the user reopened a game.
 */
export function buildStudyLaunchSearchParams(
  rawMode: StudyLaunchMode,
  turmaId?: string | null,
): URLSearchParams {
  const mode = normalizeStudyMode(rawMode);
  const params = new URLSearchParams({ mode: studyModeToUrlParam(mode) });

  if (turmaId) params.set("turma", turmaId);

  return params;
}
