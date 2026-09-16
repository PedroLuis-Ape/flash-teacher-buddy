import { hashToBool, normalizeDirection, type Direction } from "@/features/study/lib/gameCore";

export type WriteActivityMode = "translate" | "rewrite";
export type WriteRewriteSide = "a" | "b" | "alternating";
/**
 * COMO o card é apresentado quando a atividade é "rewrite".
 *
 * - "visible": a frase-alvo fica visível desde o início (reescrita visual);
 * - "listening": o aluno ouve e reconstrói sem ver a frase (ditado).
 *
 * São DUAS atividades irmãs: o ditado nunca é uma fase obrigatória da
 * reescrita, e a reescrita visual nunca esconde a frase do aluno.
 */
export type WriteRewritePromptMode = "visible" | "listening";
export type WriteActivityGameMode = "write" | "mixed";

/**
 * Dados antigos (preset sem o campo) são tratados como reescrita visual, que
 * era a funcionalidade original substituída pelo ditado.
 */
export const DEFAULT_WRITE_REWRITE_PROMPT_MODE: WriteRewritePromptMode = "visible";

export function isWriteRewritePromptMode(value: unknown): value is WriteRewritePromptMode {
  return value === "visible" || value === "listening";
}

export function resolveWriteRewritePromptMode(value: unknown): WriteRewritePromptMode {
  return isWriteRewritePromptMode(value) ? value : DEFAULT_WRITE_REWRITE_PROMPT_MODE;
}

/**
 * Identidade do snapshot da tentativa de reescrita.
 *
 * Reescrita visual e ditado NÃO compartilham snapshot: cada modalidade tem a
 * própria identidade de card, então um rascunho de ditado nunca reaparece na
 * reescrita visual — nem o estado LISTENING vaza de uma para a outra.
 */
export function buildRewriteCardIdentity(
  cardIdentity: string,
  promptMode: WriteRewritePromptMode,
  resolvedSide: "a" | "b",
): string {
  return `${cardIdentity}:rewrite-${promptMode}-${resolvedSide}`;
}

/**
 * Identidade LEGADA (gravada antes da separação). Aquelas tentativas eram
 * sempre de ditado, então só podem alimentar a modalidade "listening".
 */
export function buildLegacyRewriteCardIdentity(
  cardIdentity: string,
  resolvedSide: "a" | "b",
): string {
  return `${cardIdentity}:rewrite-${resolvedSide}`;
}

export interface WriteActivityPreference {
  mode: WriteActivityMode;
  rewriteSide: WriteRewriteSide;
}

export interface WriteActivityPreferenceChangedDetail {
  gameMode: WriteActivityGameMode;
  preference: WriteActivityPreference;
}

export const WRITE_ACTIVITY_PREFERENCE_STORAGE_KEY = "ape.writeActivityPreference.v1";
export const WRITE_ACTIVITY_PREFERENCE_CHANGED_EVENT = "ape:writeActivityPreferenceChanged";

export const DEFAULT_WRITE_ACTIVITY_PREFERENCE: WriteActivityPreference = Object.freeze({
  mode: "translate",
  rewriteSide: "alternating",
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMode(value: unknown): value is WriteActivityMode {
  return value === "translate" || value === "rewrite";
}

function isRewriteSide(value: unknown): value is WriteRewriteSide {
  return value === "a" || value === "b" || value === "alternating";
}

/**
 * MAPEAMENTO CANÔNICO entre direção de estudo e lado da reescrita.
 *
 *   writeRewriteSide "a"           <-> direction "b-a"  (responder no lado A)
 *   writeRewriteSide "b"           <-> direction "a-b"  (responder no lado B)
 *   writeRewriteSide "alternating" <-> direction "any"
 */
export function rewriteSideToDirection(side: unknown): Direction {
  if (side === "a") return "b-a";
  if (side === "b") return "a-b";
  return "any";
}

export function directionToRewriteSide(direction: unknown): WriteRewriteSide {
  const normalized = normalizeDirection(typeof direction === "string" ? direction : "any");
  if (normalized === "b-a") return "a";
  if (normalized === "a-b") return "b";
  return "alternating";
}

/**
 * Bloco de configurações de escrita transportado do controlador único
 * (Study/MixedStudy) até a view. Nenhuma view pode hidratar isso sozinha.
 */
export interface WriteSessionSettings {
  writeActivityMode: WriteActivityMode;
  writeRewriteSide: WriteRewriteSide;
  /** Reescrita visual ("visible") x ditado ("listening"). */
  writeRewritePromptMode: WriteRewritePromptMode;
  writeCorrectionMode: "flexible" | "hard";
  studyFlowMode: "mastery_rounds" | "continuous";
}

export const DEFAULT_WRITE_SESSION_SETTINGS: WriteSessionSettings = Object.freeze({
  writeActivityMode: "translate",
  writeRewriteSide: "alternating",
  writeRewritePromptMode: DEFAULT_WRITE_REWRITE_PROMPT_MODE,
  writeCorrectionMode: "flexible",
  studyFlowMode: "mastery_rounds",
});

export function resolveWriteActivityGameMode(explicit?: string): WriteActivityGameMode {
  if (explicit === "mixed" || explicit === "write") return explicit;
  if (typeof window === "undefined") return "write";
  try {
    return new URLSearchParams(window.location.search).get("mode") === "mixed" ? "mixed" : "write";
  } catch {
    return "write";
  }
}

export function buildWriteActivityPreferenceStorageKey(gameMode?: string): string {
  return `${WRITE_ACTIVITY_PREFERENCE_STORAGE_KEY}:${resolveWriteActivityGameMode(gameMode)}`;
}

export function normalizeWriteActivityPreference(value: unknown): WriteActivityPreference {
  const input = isRecord(value) ? value : {};
  return {
    mode: isMode(input.mode) ? input.mode : DEFAULT_WRITE_ACTIVITY_PREFERENCE.mode,
    rewriteSide: isRewriteSide(input.rewriteSide)
      ? input.rewriteSide
      : DEFAULT_WRITE_ACTIVITY_PREFERENCE.rewriteSide,
  };
}

export function readWriteActivityPreference(gameMode?: string): WriteActivityPreference {
  if (typeof window === "undefined") return { ...DEFAULT_WRITE_ACTIVITY_PREFERENCE };
  try {
    const stored = window.localStorage.getItem(buildWriteActivityPreferenceStorageKey(gameMode));
    return stored ? normalizeWriteActivityPreference(JSON.parse(stored)) : { ...DEFAULT_WRITE_ACTIVITY_PREFERENCE };
  } catch {
    return { ...DEFAULT_WRITE_ACTIVITY_PREFERENCE };
  }
}

export function writeWriteActivityPreference(
  preference: WriteActivityPreference,
  gameMode?: string,
): void {
  if (typeof window === "undefined") return;
  const resolvedGameMode = resolveWriteActivityGameMode(gameMode);
  const normalized = normalizeWriteActivityPreference(preference);
  try {
    window.localStorage.setItem(
      buildWriteActivityPreferenceStorageKey(resolvedGameMode),
      JSON.stringify(normalized),
    );
    window.dispatchEvent(new CustomEvent<WriteActivityPreferenceChangedDetail>(
      WRITE_ACTIVITY_PREFERENCE_CHANGED_EVENT,
      { detail: { gameMode: resolvedGameMode, preference: normalized } },
    ));
  } catch {
    // Local storage may be blocked. The current screen still keeps its in-memory state.
  }
}

/**
 * Lado da reescrita para um card. Determinístico: lados fixos permanecem fixos e
 * "alternating" usa o mesmo hash do motor ("any" direction), portanto o mesmo
 * card resolve o mesmo lado em rerenders, rodadas e retomadas.
 */
export function resolveRewriteSideForCard(
  cardKey: string,
  preference: WriteRewriteSide,
): "a" | "b" {
  if (preference === "a" || preference === "b") return preference;
  // hashToBool true => direction "a-b" (responder no lado B).
  return hashToBool(cardKey) ? "b" : "a";
}

/** Mantido por compatibilidade: não há mais estado global para limpar. */
export function resetRewriteSideAssignmentsForTests(): void {
  // no-op
}
