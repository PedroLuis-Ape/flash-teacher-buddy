import type {
  StudyDirectionPreset,
  StudyFlowModePreset,
  StudyModePreset,
  StudyOrderPreset,
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

/**
 * Stable identity for an open session.
 *
 * Settings belong in `settings_snapshot`, not in the session identity. This
 * keeps a direction/filter/flow change attached to the same user + list +
 * mode session instead of silently creating a second resumable trail.
 */
export function buildStudySessionScopeKey(input: StudySessionContextInput): string {
  return `study-session-v2:${encodeURIComponent(input.mode)}`;
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
