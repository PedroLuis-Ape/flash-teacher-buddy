/**
 * ====================================================================
 * GAME CORE — MÓDULO PROTEGIDO
 * ====================================================================
 *
 * ⚠️  NÃO ALTERAR este arquivo sem aprovação explícita.
 *     Qualquer mudança DEVE ser acompanhada de atualização nos testes
 *     em gameCore.test.ts.
 *
 * Este módulo contém TODA a lógica pura (sem side-effects) do jogo:
 *   - Resolução de lados (prompt / answer)
 *   - Embaralhamento imutável
 *   - Cálculo de rodadas (spaced repetition lite)
 *   - Cálculo de estatísticas
 *   - Geração de opções de múltipla escolha
 *   - Direção determinística para modo "any"
 *
 * CONTRATO:
 *   - Todas as funções são PURAS (sem I/O, sem mutação).
 *   - Nenhuma função acessa banco, localStorage, ou DOM.
 *   - Os dados de entrada nunca são mutados.
 *   - Retornos são sempre objetos/arrays NOVOS.
 *
 * INVARIANTES:
 *   1. O campo `term` do card original NUNCA é reescrito.
 *   2. O campo `translation` do card original NUNCA é reescrito.
 *   3. O embaralhamento SEMPRE opera sobre cópias.
 *   4. A inversão (swap) é aplicada APENAS na direção, não nos dados.
 *   5. Estatísticas são derivadas dos resultados, nunca de estado mutável.
 * ====================================================================
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface CardData {
  readonly id: string;
  readonly term: string;
  readonly translation: string;
  readonly hint?: string | null;
  readonly accepted_answers_en?: readonly string[];
  readonly accepted_answers_pt?: readonly string[];
}

export interface StudySide {
  readonly text: string;
  readonly lang: string;
  readonly label: string;
  readonly acceptedAnswers?: readonly string[];
}

export interface ResolvedSides {
  readonly promptSide: StudySide;
  readonly answerSide: StudySide;
  readonly isAFirst: boolean;
}

export interface StudyResult {
  readonly flashcardId: string;
  readonly correct: boolean;
  readonly skipped: boolean;
  readonly attempts: number;
}

export interface RoundPlan {
  readonly cardIds: readonly string[];
  readonly roundNumber: number;
}

export interface SessionStats {
  readonly correctCount: number;
  readonly errorCount: number;
  readonly skippedCount: number;
  readonly totalAnswered: number;
  readonly accuracy: number; // 0-1
}

export type Direction = "pt-en" | "en-pt" | "any";

// ─── Pure Functions ──────────────────────────────────────────────────

/**
 * Deterministic hash for "any" direction — same card always gets same side.
 * NÃO ALTERAR: garante consistência entre renders.
 */
export function hashToBool(seed: string): boolean {
  const hash = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return hash % 2 === 0;
}

/**
 * Resolve qual lado é prompt e qual é answer, dada uma direção.
 *
 * @param sideA  — dados do lado A (term / front)
 * @param sideB  — dados do lado B (translation / back)
 * @param direction — "pt-en" | "en-pt" | "any"
 * @param cardSeed  — string estável por card (id ou texto)
 *
 * NÃO ALTERAR: esta é a fonte única de verdade para todos os modos.
 */
export function resolveStudySides(
  sideA: StudySide,
  sideB: StudySide,
  direction: Direction,
  cardSeed: string = ""
): ResolvedSides {
  let isAFirst: boolean;

  if (direction === "en-pt") {
    isAFirst = true;
  } else if (direction === "pt-en") {
    isAFirst = false;
  } else {
    isAFirst = hashToBool(cardSeed);
  }

  return {
    promptSide: isAFirst ? sideA : sideB,
    answerSide: isAFirst ? sideB : sideA,
    isAFirst,
  };
}

/**
 * Aplica swap visual invertendo APENAS a direção — nunca os dados.
 *
 * NÃO ALTERAR: garante que swap é sempre na camada de renderização.
 */
export function applySwap(
  direction: Direction,
  isSwapped: boolean
): Direction {
  if (!isSwapped) return direction;
  if (direction === "any") return "any"; // "any" permanece "any" com swap
  return direction === "pt-en" ? "en-pt" : "pt-en";
}

/**
 * Resolve direção para um card específico, incluindo swap.
 * Combina decideDirection + applySwap em uma operação atômica.
 */
export function resolveDirection(
  baseDirection: Direction,
  isSwapped: boolean,
  cardIndex: number
): "pt-en" | "en-pt" {
  let dir = baseDirection;
  // Apply swap first (inverts the base direction)
  if (isSwapped && dir !== "any") {
    dir = dir === "pt-en" ? "en-pt" : "pt-en";
  }
  // Resolve "any" to deterministic per-index
  if (dir === "any") {
    const resolved = cardIndex % 2 === 0 ? "pt-en" : "en-pt";
    // If swapped, invert the resolved "any" direction too
    return isSwapped ? (resolved === "pt-en" ? "en-pt" : "pt-en") : resolved;
  }
  return dir as "pt-en" | "en-pt";
}

/**
 * Embaralhamento Fisher-Yates IMUTÁVEL.
 * NUNCA muta o array original.
 *
 * NÃO ALTERAR.
 */
export function shuffleArray<T>(array: readonly T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Calcula estatísticas de sessão a partir dos resultados.
 *
 * NÃO ALTERAR: usado para tela de resumo em todos os modos.
 */
export function computeStats(results: readonly StudyResult[]): SessionStats {
  const correctCount = results.filter((r) => r.correct && !r.skipped).length;
  const errorCount = results.filter((r) => !r.correct && !r.skipped).length;
  const skippedCount = results.filter((r) => r.skipped).length;
  const totalAnswered = correctCount + errorCount;

  return {
    correctCount,
    errorCount,
    skippedCount,
    totalAnswered,
    accuracy: totalAnswered > 0 ? correctCount / totalAnswered : 0,
  };
}

/**
 * Calcula progresso como percentual (0-100).
 */
export function computeProgress(
  currentIndex: number,
  totalCards: number
): number {
  if (totalCards <= 0) return 0;
  return ((currentIndex + 1) / totalCards) * 100;
}

/**
 * Gera a próxima rodada usando algoritmo Priority A + B.
 *   Priority A: cards errados em rodadas anteriores
 *   Priority B: cards ainda não vistos
 *
 * NÃO ALTERAR: algoritmo de spaced repetition lite.
 */
export function generateNextRound(
  missedCardIds: readonly string[],
  unseenCardIds: readonly string[],
  batchSize: number = 10
): { roundCards: string[]; remainingUnseen: string[] } {
  const nextRound: string[] = [];

  // Priority A: missed cards first
  const missedToAdd = [...missedCardIds].slice(0, batchSize);
  nextRound.push(...missedToAdd);

  // Priority B: fill remaining with unseen
  const slotsRemaining = batchSize - nextRound.length;
  const unseenToAdd = [...unseenCardIds].slice(0, Math.max(0, slotsRemaining));
  nextRound.push(...unseenToAdd);

  // Remaining unseen after this round
  const remainingUnseen = unseenCardIds.filter(
    (id) => !unseenToAdd.includes(id)
  );

  return {
    roundCards: shuffleArray(nextRound),
    remainingUnseen,
  };
}

/**
 * Gera opções para múltipla escolha.
 * Retorna array embaralhado com a resposta correta + 3 distratores.
 *
 * NÃO ALTERAR: garante que opções são sempre novas e nunca mutam allCards.
 */
export function generateMultipleChoiceOptions(
  correctAnswer: string,
  allAnswers: readonly string[],
  numDistractors: number = 3
): { options: string[]; correctIndex: number } {
  // Filter out duplicates and correct answer
  const distractors = [...new Set(allAnswers)]
    .filter((a) => a !== correctAnswer)
    .sort(() => Math.random() - 0.5)
    .slice(0, numDistractors);

  const options = shuffleArray([...distractors, correctAnswer]);
  const correctIndex = options.indexOf(correctAnswer);

  return { options, correctIndex };
}

/**
 * Registra resultado de forma imutável.
 * Se o card já existe nos resultados, atualiza (imutavelmente).
 *
 * NÃO ALTERAR.
 */
export function recordResultImmutable(
  results: readonly StudyResult[],
  flashcardId: string,
  correct: boolean,
  skipped: boolean = false
): StudyResult[] {
  const existing = results.find((r) => r.flashcardId === flashcardId);
  if (existing) {
    return results.map((r) =>
      r.flashcardId === flashcardId
        ? { ...r, correct, skipped, attempts: r.attempts + 1 }
        : r
    );
  }
  return [...results, { flashcardId, correct, skipped, attempts: 1 }];
}

/**
 * Atualiza lista de cards errados de forma imutável.
 *
 * NÃO ALTERAR.
 */
export function updateMissedCards(
  missedCards: readonly string[],
  flashcardId: string,
  correct: boolean,
  skipped: boolean
): string[] {
  if (!correct && !skipped) {
    return missedCards.includes(flashcardId)
      ? [...missedCards]
      : [...missedCards, flashcardId];
  }
  if (correct) {
    return missedCards.filter((id) => id !== flashcardId);
  }
  return [...missedCards];
}

/**
 * Modo misto: retorna o modo de estudo para um dado índice.
 *
 * NÃO ALTERAR.
 */
const MODES_CYCLE = ["flip", "write", "multiple-choice", "unscramble"] as const;

export function getMixedMode(
  cardIndex: number
): "flip" | "write" | "multiple-choice" | "unscramble" {
  return MODES_CYCLE[cardIndex % MODES_CYCLE.length];
}

// ─── BCP-47 Mapping (shared) ────────────────────────────────────────

const BCP47_MAP: Record<string, string> = {
  en: "en-US", pt: "pt-BR", es: "es-ES", fr: "fr-FR",
  de: "de-DE", it: "it-IT", ja: "ja-JP", zh: "zh-CN",
  ko: "ko-KR", ru: "ru-RU", ar: "ar-SA", hi: "hi-IN",
};

export function toBCP47(code: string): string {
  return BCP47_MAP[code] || code;
}

const LANG_LABELS: Record<string, string> = {
  en: "English", pt: "Português", es: "Español", fr: "Français",
  de: "Deutsch", it: "Italiano", ja: "日本語", zh: "中文",
  ko: "한국어", ru: "Русский", ar: "العربية", hi: "हिन्दी",
};

export function getLangLabel(code: string): string {
  return LANG_LABELS[code] || code.toUpperCase();
}
