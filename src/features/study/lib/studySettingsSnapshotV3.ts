/**
 * Contrato único e versionado de TODAS as configurações ajustáveis na janela
 * "Configurações da Sessão".
 *
 * Regra: nenhum campo pode existir apenas no preset ou apenas na sessão. O
 * preset da lista/modo e o `settings_snapshot` da sessão usam este mesmo
 * formato, e a migração de snapshots v1/v2 é explícita.
 *
 * V3 (2026-09-14) — AUTORIDADE ÚNICA DE LADOS:
 * `direction` é a ÚNICA autoridade sobre qual lado é pergunta e qual é resposta.
 * Áudio/exibição não escolhe mais idioma físico A/B: o campo semântico é
 * `playTarget` (`both | prompt | answer`), sempre resolvido em cima do
 * prompt/answer que o resolver canônico produziu para o card. Os campos v2
 * `playMode`/`playSide` foram REMOVIDOS do contrato e migram automaticamente
 * (ver `legacyPlayToTarget`).
 */
import {
  DEFAULT_STUDY_PRESET,
  STUDY_PRESET_DIRECTIONS,
  STUDY_PRESET_FLOW_MODES,
  STUDY_PRESET_ORDERS,
  STUDY_PRESET_PLAY_TARGETS,
  legacyPlayToTarget,
  STUDY_PRESET_SCOPES,
  STUDY_PRESET_WRITE_ACTIVITY_MODES,
  STUDY_PRESET_WRITE_CORRECTION_MODES,
  STUDY_PRESET_WRITE_REWRITE_SIDES,
  type StudyDirectionPreset,
  type StudyFlowModePreset,
  type StudyOrderPreset,
  type StudyPlayTargetPreset,
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

export const STUDY_SETTINGS_SNAPSHOT_VERSION = 3 as const;

export interface StudySettingsSnapshotV2 {
  version: 3;
  direction: StudyDirectionPreset;
  order: StudyOrderPreset;
  scope: StudyScopePreset;
  redFocus: boolean;
  fastMode: boolean;
  /** Semântico: o que o Play fala/mostra — nunca um lado físico A/B. */
  playTarget: StudyPlayTargetPreset;
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
  playTarget: DEFAULT_STUDY_PRESET.playTarget,
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
    playTarget,
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
  return applyStudySettingsConstraints(
    normalizeStudySettingsSnapshotV2({
      ...preset,
      redFocus: extra.redFocus ?? false,
    }),
  );
}

/**
 * Campos que o Foco Vermelho controla enquanto está ativo.
 *
 * O Foco Vermelho é uma restrição TEMPORÁRIA de fila, não uma preferência:
 * enquanto ativo, o estado EFETIVO é `order = sequential` +
 * `studyFlowMode = continuous`, e a UI e o motor leem o mesmo estado. O preset
 * base do usuário (com a ordem/formato que ele escolheu) fica intocado, então
 * desligar o Foco Vermelho restaura o estado anterior sem guardar nada extra e
 * sem sobrescrever a preferência salva — ver [06] em [[01-CURRENT-STATE]].
 */
export const RED_FOCUS_CONSTRAINED_SETTINGS = ["order", "studyFlowMode"] as const;

export function applyStudySettingsConstraints(
  snapshot: StudySettingsSnapshotV2,
): StudySettingsSnapshotV2 {
  if (!snapshot.redFocus) return snapshot;
  if (snapshot.order === "sequential" && snapshot.studyFlowMode === "continuous") return snapshot;
  return { ...snapshot, order: "sequential", studyFlowMode: "continuous" };
}

/**
 * Ao SAIR do Foco Vermelho, ordem e formato voltam para a preferência base do
 * usuário (preset da lista/modo). É o único lugar que precisa conhecer o base:
 * a restrição nunca foi gravada como preferência, então basta reaplicá-la.
 */
export function releaseRedFocusConstraints(
  next: StudySettingsSnapshotV2,
  basePreset: Pick<StudyPreset, "order" | "studyFlowMode">,
): StudySettingsSnapshotV2 {
  if (next.redFocus) return next;
  if (next.order === basePreset.order && next.studyFlowMode === basePreset.studyFlowMode) return next;
  return { ...next, order: basePreset.order, studyFlowMode: basePreset.studyFlowMode };
}

/**
 * Override do preset que contém SOMENTE as decisões do usuário.
 *
 * O runtime recebe o snapshot efetivo completo, mas a persistência registra
 * apenas o que o usuário mudou de fato. Campos derivados de restrição ativa
 * (Foco Vermelho) são descartados: persistir a restrição como se fosse escolha
 * do usuário é exatamente o que fazia o preset normal ser sobrescrito.
 */
export function studySettingsSemanticOverride(
  next: StudySettingsSnapshotV2,
  requested: StudySettingsPatchV2,
): StudyPresetOverride {
  const full = studySettingsToPresetOverride(next);
  const interested = new Set<keyof StudyPresetOverride>();

  (Object.keys(requested) as (keyof StudySettingsPatchV2)[]).forEach((key) => {
    if (key === "redFocus") return;
    interested.add(key as keyof StudyPresetOverride);
    // Direção e lado da reescrita são a MESMA decisão (sincronização atômica).
    if (key === "direction" || key === "writeRewriteSide") {
      interested.add("direction");
      interested.add("writeRewriteSide");
    }
  });

  if (next.redFocus) {
    RED_FOCUS_CONSTRAINED_SETTINGS.forEach((key) => interested.delete(key));
  }
  if (isDirectionLockedByFlowMode(next.studyFlowMode)) {
    MASTERY_ROUNDS_CONSTRAINED_SETTINGS.forEach((key) => interested.delete(key));
  }

  const override: Record<string, unknown> = {};
  interested.forEach((key) => {
    if (full[key] !== undefined) override[key] = full[key];
  });
  return override as StudyPresetOverride;
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
    playTarget: snapshot.playTarget,
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
  // Foco Vermelho usa fila única e sequencial, no formato extenso; o Modo
  // gamificado força direção automática.
  return applyStudySettingsConstraints(merged);
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
