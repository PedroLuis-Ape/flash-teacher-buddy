import type {
  StudyDirectionPreset,
  StudyFlowModePreset,
  StudyModePreset,
  StudyOrderPreset,
  StudyPresetOverride,
  StudyScopePreset,
  StudyWriteActivityModePreset,
  StudyWriteCorrectionModePreset,
  StudyWriteRewriteSidePreset,
} from "@/features/study/preferences/studyPreset";

export interface StudySessionSettingsSnapshot {
  version: 1;
  mode: StudyModePreset | string;
  subset: StudyScopePreset;
  order: StudyOrderPreset;
  redFocus: boolean;
  fastMode: boolean;
  direction: StudyDirectionPreset;
  studyFlowMode: StudyFlowModePreset;
  writeActivityMode?: StudyWriteActivityModePreset;
  writeRewriteSide?: StudyWriteRewriteSidePreset;
  writeCorrectionMode?: StudyWriteCorrectionModePreset;
}

export interface StudySessionContextInput {
  mode: StudyModePreset | string;
  subset?: StudyScopePreset;
  order?: StudyOrderPreset;
  redFocus?: boolean;
  fastMode?: boolean;
  direction?: StudyDirectionPreset;
  studyFlowMode?: StudyFlowModePreset;
  writeActivityMode?: StudyWriteActivityModePreset;
  writeRewriteSide?: StudyWriteRewriteSidePreset;
  writeCorrectionMode?: StudyWriteCorrectionModePreset;
}

export function buildStudySessionSettingsSnapshot(
  input: StudySessionContextInput,
): StudySessionSettingsSnapshot {
  return {
    version: 1,
    mode: input.mode,
    subset: input.subset ?? "all",
    order: input.order ?? "random",
    redFocus: input.redFocus ?? false,
    fastMode: input.fastMode ?? false,
    direction: input.direction ?? "any",
    studyFlowMode: input.studyFlowMode ?? "continuous",
    ...(input.writeActivityMode ? { writeActivityMode: input.writeActivityMode } : {}),
    ...(input.writeRewriteSide ? { writeRewriteSide: input.writeRewriteSide } : {}),
    ...(input.writeCorrectionMode ? { writeCorrectionMode: input.writeCorrectionMode } : {}),
  };
}

export type StudyDeckScopeToken = "all" | "favorites" | "red-focus";

/**
 * Escopo canônico do deck. Foco Vermelho é um deck próprio, distinto de
 * Todos e de Favoritos.
 */
export function resolveStudyDeckScopeToken(
  input: Pick<StudySessionContextInput, "subset" | "redFocus">,
): StudyDeckScopeToken {
  if (input.redFocus) return "red-focus";
  return input.subset === "favorites" ? "favorites" : "all";
}

function resolveFlowToken(input: StudySessionContextInput): StudyFlowModePreset {
  return input.studyFlowMode === "mastery_rounds" ? "mastery_rounds" : "continuous";
}

/**
 * Identidade estável de uma sessão aberta (v3).
 *
 * Inclui modo + escopo canônico do deck + formato (gamificado/extenso), pois
 * esses três campos definem decks/filas incompatíveis entre si. Uma sessão de
 * "Todos" nunca pode controlar "Favoritos" e uma sessão gamificada nunca pode
 * controlar a extensa. Os demais ajustes (direção, ordem, fast mode) seguem
 * no `settings_snapshot` e não fragmentam a sessão.
 */
export function buildStudySessionScopeKey(input: StudySessionContextInput): string {
  const mode = encodeURIComponent(String(input.mode ?? "flip"));
  const scope = resolveStudyDeckScopeToken(input);
  const flow = resolveFlowToken(input);
  return `study-session-v3:${mode}:${scope}:${flow}`;
}

/**
 * Decide se uma sessão persistida pode assumir o contexto atual.
 *
 * - Chave v3: precisa ser exatamente igual.
 * - Chave legada (v1/v2): só é aceita quando o `settings_snapshot` comprova
 *   mesmo modo, mesmo escopo de deck (subset + redFocus) e mesmo fluxo.
 *   Interseção de fila NUNCA é suficiente.
 */
export function isPersistedStudySessionCompatible(input: {
  expected: StudySessionContextInput;
  sessionScopeKey: unknown;
  settingsSnapshot?: unknown;
}): boolean {
  const expectedKey = buildStudySessionScopeKey(input.expected);
  const key = typeof input.sessionScopeKey === "string" ? input.sessionScopeKey : "";
  if (key === expectedKey) return true;
  if (key.startsWith("study-session-v3:")) return false;
  if (!key.startsWith("study-session-v1:") && !key.startsWith("study-session-v2:")) return false;

  const snapshot = input.settingsSnapshot;
  if (!snapshot || typeof snapshot !== "object") return false;
  const row = snapshot as Record<string, unknown>;
  if (String(row.mode ?? "") !== String(input.expected.mode)) return false;

  const snapshotScope = resolveStudyDeckScopeToken({
    subset: (row.scope ?? row.subset) === "favorites" ? "favorites" : "all",
    redFocus: row.redFocus === true,
  });
  if (snapshotScope !== resolveStudyDeckScopeToken(input.expected)) return false;

  const snapshotFlow = row.studyFlowMode === "mastery_rounds" ? "mastery_rounds" : "continuous";
  return snapshotFlow === resolveFlowToken(input.expected);
}

/**
 * Compatibility key for rows written before the stable session identity was
 * introduced. Callers may read it during a bounded migration window, but all
 * new writes use `buildStudySessionScopeKey`.
 */
export function buildLegacyStudySessionScopeKey(input: StudySessionContextInput): string {
  return `study-session-v1:${encodeURIComponent(JSON.stringify(buildStudySessionSettingsSnapshot(input)))}`;
}

export function isStudySessionSettingsSnapshot(value: unknown): value is StudySessionSettingsSnapshot {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<StudySessionSettingsSnapshot>;
  return row.version === 1
    && typeof row.mode === "string"
    && (row.subset === "all" || row.subset === "favorites")
    && (row.order === "random" || row.order === "sequential")
    && typeof row.redFocus === "boolean"
    && typeof row.fastMode === "boolean"
    && (row.direction === "a-b" || row.direction === "b-a" || row.direction === "any")
    && (row.studyFlowMode === "mastery_rounds" || row.studyFlowMode === "continuous");
}

/**
 * Converts a durable session snapshot into ephemeral preference overrides.
 *
 * A resumed session must win over the current preset, but restoring it must
 * not rewrite the user's saved list/global preset. Callers therefore apply
 * this result through the preference hook's session-override channel.
 */
export function studySessionSettingsToPresetOverride(
  value: unknown,
): StudyPresetOverride | null {
  if (!isStudySessionSettingsSnapshot(value)) return null;

  return {
    direction: value.direction,
    order: value.order,
    scope: value.subset,
    fastMode: value.fastMode,
    studyFlowMode: value.studyFlowMode,
    ...(value.writeActivityMode ? { writeActivityMode: value.writeActivityMode } : {}),
    ...(value.writeRewriteSide ? { writeRewriteSide: value.writeRewriteSide } : {}),
    ...(value.writeCorrectionMode ? { writeCorrectionMode: value.writeCorrectionMode } : {}),
  };
}
