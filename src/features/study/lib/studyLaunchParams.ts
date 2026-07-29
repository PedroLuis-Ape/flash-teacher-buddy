import {
  normalizeStudyMode,
  studyModeToUrlParam,
  type StudyMode,
} from "@/features/study/lib/studyMode";
import type { StudyFlowModePreset } from "@/features/study/preferences/studyPreset";

export type StudyLaunchMode = StudyMode | "multiple";

export function resolveStudyLaunchRoute(
  rawMode: StudyLaunchMode,
  flowMode: StudyFlowModePreset,
): "study" | "mixed-study" {
  const mode = normalizeStudyMode(rawMode);
  return mode === "mixed" && flowMode === "mastery_rounds"
    ? "mixed-study"
    : "study";
}

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
  flowMode?: StudyFlowModePreset,
): URLSearchParams {
  const mode = normalizeStudyMode(rawMode);
  const params = new URLSearchParams({ mode: studyModeToUrlParam(mode) });

  if (turmaId) params.set("turma", turmaId);
  if (flowMode) params.set("flow", flowMode);

  return params;
}
