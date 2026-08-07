/**
 * Contrato único e versionado de TODAS as configurações ajustáveis na janela
 * "Configurações da Sessão".
 *
 * Regra: nenhum campo pode existir apenas no preset ou apenas na sessão. O
 * preset da lista/modo e o `settings_snapshot` da sessão usam este mesmo
 * formato, e a migração de snapshots v1 é explícita.
 */
import {
  DEFAULT_STUDY_PRESET,
  STUDY_PRESET_DIRECTIONS,
  STUDY_PRESET_FLOW_MODES,
  STUDY_PRESET_ORDERS,
  STUDY_PRESET_PLAY_MODES,
  STUDY_PRESET_PLAY_SIDES,
  STUDY_PRESET_SCOPES,
  STUDY_PRESET_WRITE_ACTIVITY_MODES,
  STUDY_PRESET_WRITE_CORRECTION_MODES,
  STUDY_PRESET_WRITE_REWRITE_SIDES,
  type StudyDirectionPreset,
  type StudyFlowModePreset,
  type StudyOrderPreset,
  type StudyPlayModePreset,
  type StudyPlaySidePreset,
  type StudyPreset,
  type StudyPresetOverride,
  type StudyScopePreset,
  type StudyWriteActivityModePreset,
  type StudyWriteCorrectionModePreset,
  type StudyWriteRewriteSidePreset,
} from "@/features/study/preferences/studyPreset";
import {
  directionToRewriteSide,
  rewriteSideToDirection,
} from "@/features/study/lib/writeActivityMode";

export const STUDY_SETTINGS_SNAPSHOT_VERSION = 2 as const;

export interface StudySettingsSnapshotV2 {
  version: 2;
  direction: StudyDirectionPreset;
  order: StudyOrderPreset;
  scope: StudyScopePreset;
  redFocus: boolean;
  fastMode: boolean;
  playMode: StudyPlayModePreset;
  playSide: StudyPlaySidePreset;
  studyFlowMode: StudyFlowModePreset;
  writeActivityMode: StudyWriteActivityModePreset;
  writeRewriteSide: StudyWriteRewriteSidePreset;
  writeCorrectionMode: StudyWriteCorrectionModePreset;
}

export type StudySettingsPatchV2 = Partial<Omit<StudySettingsSnapshotV2, "version">>;

export const DEFAULT_STUDY_SETTINGS_SNAPSHOT: StudySettingsSnapshotV2 = Object.freeze({
  version: STUDY_SETTINGS_SNAPSHOT_VERSION,
  direction: DEFAULT_STUDY_PRESET.direction,
  order: DEFAULT_STUDY_PRESET.order,
  scope: DEFAULT_STUDY_PRESET.scope,
  redFocus: false,
  fastMode: DEFAULT_STUDY_PRESET.fastMode,
  playMode: DEFAULT_STUDY_PRESET.playMode,
  playSide: DEFAULT_STUDY_PRESET.playSide,
  studyFlowMode: DEFAULT_STUDY_PRESET.studyFlowMode,
  writeActivityMode: DEFAULT_STUDY_PRESET.writeActivityMode,
  writeRewriteSide: DEFAULT_STUDY_PRESET.writeRewriteSide,
  writeCorrectionMode: DEFAULT_STUDY_PRESET.writeCorrectionMode,
});

function pick<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return (allowed as readonly string[]).includes(value as string) ? (value as T) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Normaliza e migra qualquer snapshot conhecido (v1 ou v2) para o contrato v2.
 * v1 não possuía `playMode`/`playSide`; os campos são preenchidos a partir do
 * fallback informado (normalmente o preset atual da lista/modo).
 */
export function normalizeStudySettingsSnapshotV2(
  value: unknown,
  fallback: StudySettingsSnapshotV2 = DEFAULT_STUDY_SETTINGS_SNAPSHOT,
  options: { syncRewriteDirection?: boolean } = {},
): StudySettingsSnapshotV2 {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  // v1 chamava o escopo de `subset`.
  const scopeValue = raw.scope ?? raw.subset;
  const snapshot: StudySettingsSnapshotV2 = {
    version: STUDY_SETTINGS_SNAPSHOT_VERSION,
    direction: pick(STUDY_PRESET_DIRECTIONS, raw.direction, fallback.direction),
    order: pick(STUDY_PRESET_ORDERS, raw.order, fallback.order),
    scope: pick(STUDY_PRESET_SCOPES, scopeValue, fallback.scope),
    redFocus: bool(raw.redFocus, fallback.redFocus),
    fastMode: bool(raw.fastMode, fallback.fastMode),
    playMode: pick(STUDY_PRESET_PLAY_MODES, raw.playMode, fallback.playMode),
    playSide: pick(STUDY_PRESET_PLAY_SIDES, raw.playSide, fallback.playSide),
    studyFlowMode: pick(STUDY_PRESET_FLOW_MODES, raw.studyFlowMode, fallback.studyFlowMode),
    writeActivityMode: pick(
      STUDY_PRESET_WRITE_ACTIVITY_MODES,
      raw.writeActivityMode,
      fallback.writeActivityMode,
    ),
    writeRewriteSide: pick(
      STUDY_PRESET_WRITE_REWRITE_SIDES,
      raw.writeRewriteSide,
      fallback.writeRewriteSide,
    ),
    writeCorrectionMode: pick(
      STUDY_PRESET_WRITE_CORRECTION_MODES,
      raw.writeCorrectionMode,
      fallback.writeCorrectionMode,
    ),
  };

  // No modo Reescrever, direção e lado são a MESMA decisão. Snapshots antigos
  // ou dessincronizados são reparados a partir do lado persistido.
  if (options.syncRewriteDirection !== false && snapshot.writeActivityMode === "rewrite") {
    snapshot.direction = rewriteSideToDirection(snapshot.writeRewriteSide) as typeof snapshot.direction;
  }

  return snapshot;
}

export function isStudySettingsSnapshotV2(value: unknown): value is StudySettingsSnapshotV2 {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (row.version !== STUDY_SETTINGS_SNAPSHOT_VERSION) return false;
  const normalized = normalizeStudySettingsSnapshotV2(row);
  return JSON.stringify(normalized) === JSON.stringify({
    ...normalized,
    ...row,
    version: STUDY_SETTINGS_SNAPSHOT_VERSION,
  });
}

/** Snapshot derivado do preset persistido + estado de fila (redFocus). */
export function studySettingsFromPreset(
  preset: StudyPreset,
  extra: { redFocus?: boolean } = {},
): StudySettingsSnapshotV2 {
  return normalizeStudySettingsSnapshotV2({
    ...preset,
    redFocus: extra.redFocus ?? false,
  });
}

/** Overrides efêmeros aplicados quando uma sessão salva vence o preset atual. */
export function studySettingsToPresetOverride(
  snapshot: StudySettingsSnapshotV2,
): StudyPresetOverride {
  return {
    direction: snapshot.direction,
    order: snapshot.order,
    scope: snapshot.scope,
    fastMode: snapshot.fastMode,
    playMode: snapshot.playMode,
    playSide: snapshot.playSide,
    studyFlowMode: snapshot.studyFlowMode,
    writeActivityMode: snapshot.writeActivityMode,
    writeRewriteSide: snapshot.writeRewriteSide,
    writeCorrectionMode: snapshot.writeCorrectionMode,
  };
}

/**
 * Campos que reconstroem a fila de cards. Uma mudança neles exige política
 * explícita de reconciliação — nunca um reinício silencioso.
 */
export const QUEUE_AFFECTING_SETTINGS = [
  "order",
  "scope",
  "redFocus",
  "studyFlowMode",
] as const satisfies readonly (keyof StudySettingsPatchV2)[];

export function patchAffectsQueue(patch: StudySettingsPatchV2): boolean {
  return QUEUE_AFFECTING_SETTINGS.some((key) => patch[key] !== undefined);
}

export function applyStudySettingsPatch(
  current: StudySettingsSnapshotV2,
  patch: StudySettingsPatchV2,
): StudySettingsSnapshotV2 {
  const requested: StudySettingsPatchV2 = { ...patch };
  const nextActivityMode = requested.writeActivityMode ?? current.writeActivityMode;
  const enteringRewrite = requested.writeActivityMode === "rewrite"
    && current.writeActivityMode !== "rewrite";

  // Sincronização atômica: uma única ação altera os dois campos, nunca um só.
  if (requested.writeRewriteSide !== undefined) {
    requested.direction = rewriteSideToDirection(requested.writeRewriteSide) as typeof current.direction;
  } else if (requested.direction !== undefined && nextActivityMode === "rewrite") {
    requested.writeRewriteSide = directionToRewriteSide(requested.direction) as typeof current.writeRewriteSide;
  } else if (enteringRewrite) {
    requested.writeRewriteSide = directionToRewriteSide(current.direction) as typeof current.writeRewriteSide;
  }

  const merged = normalizeStudySettingsSnapshotV2(
    { ...current, ...requested },
    current,
    { syncRewriteDirection: false },
  );
  // Foco Vermelho usa fila única e sequencial.
  if (merged.redFocus) merged.order = "sequential";
  return merged;
}

export function diffStudySettings(
  before: StudySettingsSnapshotV2,
  after: StudySettingsSnapshotV2,
): StudySettingsPatchV2 {
  const patch: Record<string, unknown> = {};
  (Object.keys(DEFAULT_STUDY_SETTINGS_SNAPSHOT) as (keyof StudySettingsSnapshotV2)[])
    .filter((key) => key !== "version")
    .forEach((key) => {
      if (before[key] !== after[key]) patch[key] = after[key];
    });
  return patch as StudySettingsPatchV2;
}
