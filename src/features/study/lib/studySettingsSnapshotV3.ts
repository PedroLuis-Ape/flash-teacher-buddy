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

export interface StudySettingsSnapshotV3 {
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

export type StudySettingsPatchV3 = Partial<Omit<StudySettingsSnapshotV3, "version">>;

export const DEFAULT_STUDY_SETTINGS_SNAPSHOT: StudySettingsSnapshotV3 = Object.freeze({
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
 * Normaliza e migra qualquer snapshot conhecido (v1, v2 ou v3) para o contrato
 * v3. v1 não possuía configuração de Play; v2 possuía `playMode`/`playSide`
 * (lado físico), convertidos para `playTarget` semântico com a direção do
 * próprio snapshot.
 */
export function normalizeStudySettingsSnapshotV3(
  value: unknown,
  fallback: StudySettingsSnapshotV3 = DEFAULT_STUDY_SETTINGS_SNAPSHOT,
  options: { syncRewriteDirection?: boolean } = {},
): StudySettingsSnapshotV3 {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  // v1 chamava o escopo de `subset`.
  const scopeValue = raw.scope ?? raw.subset;
  const direction = pick(STUDY_PRESET_DIRECTIONS, raw.direction, fallback.direction);
  // Migração v2 → v3: lado físico + direção viram alvo semântico.
  const playTarget = (STUDY_PRESET_PLAY_TARGETS as readonly string[]).includes(raw.playTarget as string)
    ? (raw.playTarget as StudyPlayTargetPreset)
    : (raw.playMode !== undefined || raw.playSide !== undefined)
      ? legacyPlayToTarget(raw.playMode, raw.playSide, direction)
      : fallback.playTarget;
  const snapshot: StudySettingsSnapshotV3 = {
    version: STUDY_SETTINGS_SNAPSHOT_VERSION,
    direction,
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

export function isStudySettingsSnapshotV3(value: unknown): value is StudySettingsSnapshotV3 {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (row.version !== STUDY_SETTINGS_SNAPSHOT_VERSION) return false;
  const normalized = normalizeStudySettingsSnapshotV3(row);
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
): StudySettingsSnapshotV3 {
  return applyStudySettingsConstraints(
    normalizeStudySettingsSnapshotV3({
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

/**
 * Campos que o Modo gamificado (`mastery_rounds`) controla enquanto ativo.
 *
 * Regra de produto: no gamificado a DIREÇÃO EFETIVA é sempre automática (`any`)
 * em TODOS os modos de jogo, porque as rodadas alternam os lados por card. É
 * restrição efetiva temporária, do mesmo tipo do Foco Vermelho: a preferência
 * base do usuário nunca é destruída nem persistida como `any`.
 */
export const MASTERY_ROUNDS_CONSTRAINED_SETTINGS = ["direction", "writeRewriteSide"] as const;

export function isDirectionLockedByFlowMode(studyFlowMode: StudyFlowModePreset): boolean {
  return studyFlowMode === "mastery_rounds";
}

/** Direção EFETIVA — única função que a UI e o motor devem consultar. */
export function resolveEffectiveStudyDirection(
  baseDirection: StudyDirectionPreset,
  studyFlowMode: StudyFlowModePreset,
): StudyDirectionPreset {
  return isDirectionLockedByFlowMode(studyFlowMode) ? "any" : baseDirection;
}

export function applyStudySettingsConstraints(
  snapshot: StudySettingsSnapshotV3,
): StudySettingsSnapshotV3 {
  let next = snapshot;

  if (next.redFocus && !(next.order === "sequential" && next.studyFlowMode === "continuous")) {
    next = { ...next, order: "sequential", studyFlowMode: "continuous" };
  }

  if (isDirectionLockedByFlowMode(next.studyFlowMode)
    && !(next.direction === "any" && next.writeRewriteSide === "alternating")) {
    next = { ...next, direction: "any", writeRewriteSide: "alternating" };
  }

  return next;
}

/**
 * Ao SAIR do Modo gamificado, a direção volta para a preferência base: entrar no
 * gamificado com base `a-b` produz `any` efetivo, e sair devolve `a-b`.
 */
export function releaseMasteryRoundsConstraints(
  next: StudySettingsSnapshotV3,
  basePreset: Pick<StudyPreset, "direction" | "writeRewriteSide">,
): StudySettingsSnapshotV3 {
  if (isDirectionLockedByFlowMode(next.studyFlowMode)) return next;
  if (next.direction === basePreset.direction) return next;
  return {
    ...next,
    direction: basePreset.direction,
    writeRewriteSide: next.writeActivityMode === "rewrite"
      ? directionToRewriteSide(basePreset.direction) as typeof next.writeRewriteSide
      : basePreset.writeRewriteSide,
  };
}

/**
 * Ao SAIR do Foco Vermelho, ordem e formato voltam para a preferência base do
 * usuário (preset da lista/modo). É o único lugar que precisa conhecer o base:
 * a restrição nunca foi gravada como preferência, então basta reaplicá-la.
 */
export function releaseRedFocusConstraints(
  next: StudySettingsSnapshotV3,
  basePreset: Pick<StudyPreset, "order" | "studyFlowMode">,
): StudySettingsSnapshotV3 {
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
  next: StudySettingsSnapshotV3,
  requested: StudySettingsPatchV3,
): StudyPresetOverride {
  const full = studySettingsToPresetOverride(next);
  const interested = new Set<keyof StudyPresetOverride>();

  (Object.keys(requested) as (keyof StudySettingsPatchV3)[]).forEach((key) => {
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
  snapshot: StudySettingsSnapshotV3,
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
] as const satisfies readonly (keyof StudySettingsPatchV3)[];

export function patchAffectsQueue(patch: StudySettingsPatchV3): boolean {
  return QUEUE_AFFECTING_SETTINGS.some((key) => patch[key] !== undefined);
}

export function applyStudySettingsPatch(
  current: StudySettingsSnapshotV3,
  patch: StudySettingsPatchV3,
): StudySettingsSnapshotV3 {
  const requested: StudySettingsPatchV3 = { ...patch };
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

  const merged = normalizeStudySettingsSnapshotV3(
    { ...current, ...requested },
    current,
    { syncRewriteDirection: false },
  );
  // Foco Vermelho usa fila única e sequencial, no formato extenso; o Modo
  // gamificado força direção automática.
  return applyStudySettingsConstraints(merged);
}

export function diffStudySettings(
  before: StudySettingsSnapshotV3,
  after: StudySettingsSnapshotV3,
): StudySettingsPatchV3 {
  const patch: Record<string, unknown> = {};
  (Object.keys(DEFAULT_STUDY_SETTINGS_SNAPSHOT) as (keyof StudySettingsSnapshotV3)[])
    .filter((key) => key !== "version")
    .forEach((key) => {
      if (before[key] !== after[key]) patch[key] = after[key];
    });
  return patch as StudySettingsPatchV3;
}
