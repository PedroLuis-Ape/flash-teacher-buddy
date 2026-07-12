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

export type StudyModePreset = (typeof STUDY_PRESET_MODES)[number];
export type StudyDirectionPreset = (typeof STUDY_PRESET_DIRECTIONS)[number];
export type StudyOrderPreset = (typeof STUDY_PRESET_ORDERS)[number];
export type StudyScopePreset = (typeof STUDY_PRESET_SCOPES)[number];

export type StudyPreset = {
  mode: StudyModePreset;
  direction: StudyDirectionPreset;
  order: StudyOrderPreset;
  scope: StudyScopePreset;
  fastMode: boolean;
};

export type StudyPresetOverride = Partial<StudyPreset>;
export type StudySessionOverrides = StudyPresetOverride;

export const DEFAULT_STUDY_PRESET: StudyPreset = Object.freeze({
  mode: "flip",
  direction: "any",
  order: "random",
  scope: "all",
  fastMode: false,
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
