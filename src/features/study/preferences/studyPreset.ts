export const STUDY_PRESET_MODES = [
  "flip",
  "write",
  "multiple-choice",
  "unscramble",
  "mixed",
  "pronunciation",
] as const;

export const STUDY_PRESET_DIRECTIONS = ["a-b", "b-a", "any"] as const;
export const STUDY_PRESET_ORDERS = ["random", "sequential"] as const;
export const STUDY_PRESET_SCOPES = ["all", "favorites"] as const;
export const STUDY_PRESET_PLAY_MODES = ["both", "single"] as const;
export const STUDY_PRESET_PLAY_SIDES = ["a", "b"] as const;
export const STUDY_PRESET_FLOW_MODES = ["mastery_rounds", "continuous"] as const;
export const STUDY_PRESET_WRITE_ACTIVITY_MODES = ["translate", "rewrite"] as const;
export const STUDY_PRESET_WRITE_REWRITE_SIDES = ["a", "b", "alternating"] as const;
export const STUDY_PRESET_WRITE_CORRECTION_MODES = ["flexible", "hard"] as const;

export type StudyModePreset = (typeof STUDY_PRESET_MODES)[number];
export type StudyDirectionPreset = (typeof STUDY_PRESET_DIRECTIONS)[number];
export type StudyOrderPreset = (typeof STUDY_PRESET_ORDERS)[number];
export type StudyScopePreset = (typeof STUDY_PRESET_SCOPES)[number];
export type StudyPlayModePreset = (typeof STUDY_PRESET_PLAY_MODES)[number];
export type StudyPlaySidePreset = (typeof STUDY_PRESET_PLAY_SIDES)[number];
export type StudyFlowModePreset = (typeof STUDY_PRESET_FLOW_MODES)[number];
export type StudyWriteActivityModePreset = (typeof STUDY_PRESET_WRITE_ACTIVITY_MODES)[number];
export type StudyWriteRewriteSidePreset = (typeof STUDY_PRESET_WRITE_REWRITE_SIDES)[number];
export type StudyWriteCorrectionModePreset = (typeof STUDY_PRESET_WRITE_CORRECTION_MODES)[number];

export type StudyPreset = {
  mode: StudyModePreset;
  direction: StudyDirectionPreset;
  order: StudyOrderPreset;
  scope: StudyScopePreset;
  fastMode: boolean;
  playMode: StudyPlayModePreset;
  playSide: StudyPlaySidePreset;
  studyFlowMode: StudyFlowModePreset;
  writeActivityMode: StudyWriteActivityModePreset;
  writeRewriteSide: StudyWriteRewriteSidePreset;
  writeCorrectionMode: StudyWriteCorrectionModePreset;
};

export type StudyPresetOverride = Partial<StudyPreset>;
export type StudySessionOverrides = StudyPresetOverride;

export const DEFAULT_STUDY_PRESET: StudyPreset = Object.freeze({
  mode: "flip",
  direction: "any",
  order: "random",
  scope: "all",
  fastMode: false,
  playMode: "both",
  playSide: "a",
  studyFlowMode: "mastery_rounds",
  writeActivityMode: "translate",
  writeRewriteSide: "alternating",
  writeCorrectionMode: "flexible",
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isOneOf<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

export function normalizeStudyPreset(value: unknown): StudyPreset {
  const input = isRecord(value) ? value : {};
  return {
    mode: isOneOf(input.mode, STUDY_PRESET_MODES) ? input.mode : DEFAULT_STUDY_PRESET.mode,
    direction: isOneOf(input.direction, STUDY_PRESET_DIRECTIONS)
      ? input.direction
      : DEFAULT_STUDY_PRESET.direction,
    order: isOneOf(input.order, STUDY_PRESET_ORDERS) ? input.order : DEFAULT_STUDY_PRESET.order,
    scope: isOneOf(input.scope, STUDY_PRESET_SCOPES) ? input.scope : DEFAULT_STUDY_PRESET.scope,
    fastMode: typeof input.fastMode === "boolean" ? input.fastMode : DEFAULT_STUDY_PRESET.fastMode,
    playMode: isOneOf(input.playMode, STUDY_PRESET_PLAY_MODES)
      ? input.playMode
      : DEFAULT_STUDY_PRESET.playMode,
    playSide: isOneOf(input.playSide, STUDY_PRESET_PLAY_SIDES)
      ? input.playSide
      : DEFAULT_STUDY_PRESET.playSide,
    studyFlowMode: isOneOf(input.studyFlowMode, STUDY_PRESET_FLOW_MODES)
      ? input.studyFlowMode
      : DEFAULT_STUDY_PRESET.studyFlowMode,
    writeActivityMode: isOneOf(input.writeActivityMode, STUDY_PRESET_WRITE_ACTIVITY_MODES)
      ? input.writeActivityMode
      : DEFAULT_STUDY_PRESET.writeActivityMode,
    writeRewriteSide: isOneOf(input.writeRewriteSide, STUDY_PRESET_WRITE_REWRITE_SIDES)
      ? input.writeRewriteSide
      : DEFAULT_STUDY_PRESET.writeRewriteSide,
    writeCorrectionMode: isOneOf(input.writeCorrectionMode, STUDY_PRESET_WRITE_CORRECTION_MODES)
      ? input.writeCorrectionMode
      : DEFAULT_STUDY_PRESET.writeCorrectionMode,
  };
}

export function normalizeStudyPresetOverride(value: unknown): StudyPresetOverride {
  if (!isRecord(value)) return {};
  const result: StudyPresetOverride = {};

  if (isOneOf(value.mode, STUDY_PRESET_MODES)) result.mode = value.mode;
  if (isOneOf(value.direction, STUDY_PRESET_DIRECTIONS)) result.direction = value.direction;
  if (isOneOf(value.order, STUDY_PRESET_ORDERS)) result.order = value.order;
  if (isOneOf(value.scope, STUDY_PRESET_SCOPES)) result.scope = value.scope;
  if (typeof value.fastMode === "boolean") result.fastMode = value.fastMode;
  if (isOneOf(value.playMode, STUDY_PRESET_PLAY_MODES)) result.playMode = value.playMode;
  if (isOneOf(value.playSide, STUDY_PRESET_PLAY_SIDES)) result.playSide = value.playSide;
  if (isOneOf(value.studyFlowMode, STUDY_PRESET_FLOW_MODES)) result.studyFlowMode = value.studyFlowMode;
  if (isOneOf(value.writeActivityMode, STUDY_PRESET_WRITE_ACTIVITY_MODES)) result.writeActivityMode = value.writeActivityMode;
  if (isOneOf(value.writeRewriteSide, STUDY_PRESET_WRITE_REWRITE_SIDES)) result.writeRewriteSide = value.writeRewriteSide;
  if (isOneOf(value.writeCorrectionMode, STUDY_PRESET_WRITE_CORRECTION_MODES)) result.writeCorrectionMode = value.writeCorrectionMode;

  return result;
}

export function resolveStudyPreset(input: {
  globalPreset?: StudyPreset | null;
  listOverride?: StudyPresetOverride | null;
  sessionOverrides?: StudySessionOverrides | null;
}): StudyPreset {
  const globalPreset = input.globalPreset
    ? normalizeStudyPreset(input.globalPreset)
    : DEFAULT_STUDY_PRESET;
  const listOverride = normalizeStudyPresetOverride(input.listOverride);
  const sessionOverrides = normalizeStudyPresetOverride(input.sessionOverrides);

  return normalizeStudyPreset({
    ...DEFAULT_STUDY_PRESET,
    ...globalPreset,
    ...listOverride,
    ...sessionOverrides,
  });
}

export function diffStudyPreset(value: StudyPreset, globalPreset: StudyPreset): StudyPresetOverride {
  const normalizedValue = normalizeStudyPreset(value);
  const normalizedGlobal = normalizeStudyPreset(globalPreset);
  const result: StudyPresetOverride = {};

  (Object.keys(DEFAULT_STUDY_PRESET) as Array<keyof StudyPreset>).forEach((key) => {
    if (normalizedValue[key] !== normalizedGlobal[key]) {
      (result as Record<keyof StudyPreset, StudyPreset[keyof StudyPreset]>)[key] = normalizedValue[key];
    }
  });

  return result;
}

export function isEmptyStudyPresetOverride(value: StudyPresetOverride | null | undefined): boolean {
  return Object.keys(normalizeStudyPresetOverride(value)).length === 0;
}
