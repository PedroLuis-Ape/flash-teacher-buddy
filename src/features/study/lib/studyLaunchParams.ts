import {
  normalizeStudyMode,
  studyModeToUrlParam,
  type StudyMode,
} from "@/features/study/lib/studyMode";

export type StudyLaunchMode = StudyMode | "multiple";

export interface StudyLaunchIntent {
  /** Deck visível no Hub no momento do clique. */
  scope?: "all" | "favorites";
  /** Formato pedido explicitamente (gamificado/extenso). */
  studyFlowMode?: "mastery_rounds" | "continuous";
}

/**
 * Builds the URL for a new study session without copying saved preferences into
 * query parameters. Direction, order, favorites and fast mode are restored by
 * useStudyPreferences for the selected game mode.
 *
 * Keeping those fields out of the URL is intentional: URL parameters have
 * session-override priority and previously replaced the Write/Mixed presets
 * with the Flip preset every time the user reopened a game.
 *
 * Exceção deliberada: o escopo do deck (Todos/Favoritos) e, quando informado,
 * o formato são transportados como LAUNCH INTENT explícito. O usuário escolhe o
 * deck no Hub antes de clicar no tile, então essa intenção precisa vencer o
 * preset antigo do modo clicado.
 */
export function buildStudyLaunchSearchParams(
  rawMode: StudyLaunchMode,
  turmaId?: string | null,
  intent?: StudyLaunchIntent,
): URLSearchParams {
  const mode = normalizeStudyMode(rawMode);
  const params = new URLSearchParams({ mode: studyModeToUrlParam(mode) });

  if (turmaId) params.set("turma", turmaId);
  if (intent?.scope === "favorites" || intent?.scope === "all") {
    params.set("favorites", intent.scope === "favorites" ? "true" : "false");
  }
  if (intent?.studyFlowMode === "mastery_rounds" || intent?.studyFlowMode === "continuous") {
    params.set("flow", intent.studyFlowMode);
  }

  return params;
}
