/**
 * Advance Gate — pure decision engine for "can this card advance?".
 *
 * A card must reach one of the finalized statuses below before the study
 * runtime is allowed to move to the next card (in evaluative modes).
 * Flip mode is intentionally exempt: flip cards never require a typed or
 * scored answer.
 */

export type CardCompletionStatus =
  | "unanswered"
  | "correct"
  | "incorrect"
  | "accepted_with_corrections"
  | "revealed"
  | "skipped";

export type AdvanceSource =
  | "next_button"
  | "keyboard"
  | "swipe"
  | "auto_advance"
  | "round_transition"
  | "mode_transition";

export type StudyRuntimeMode =
  | "flip"
  | "write"
  | "mixed"
  | "multiple-choice"
  | "unscramble"
  | "pronunciation";

export interface AdvanceRequest {
  source: AdvanceSource;
}

export type AdvanceDecision =
  | { kind: "advance" }
  | { kind: "confirm-skip" }
  | { kind: "blocked"; reason: string };

const FINALIZED: ReadonlySet<CardCompletionStatus> = new Set([
  "correct",
  "incorrect",
  "accepted_with_corrections",
  "revealed",
  "skipped",
]);

export function isFinalized(status: CardCompletionStatus): boolean {
  return FINALIZED.has(status);
}

/**
 * Evaluative modes require a finalized status before advancing.
 * Flip is the only mode that bypasses the gate.
 */
export function requiresCompletion(mode: StudyRuntimeMode): boolean {
  return mode !== "flip";
}

export function decideAdvance(
  status: CardCompletionStatus,
  _request: AdvanceRequest,
  mode: StudyRuntimeMode,
): AdvanceDecision {
  if (!requiresCompletion(mode)) return { kind: "advance" };
  if (isFinalized(status)) return { kind: "advance" };
  return { kind: "confirm-skip" };
}

/**
 * Copy variants for the skip confirmation dialog based on flow mode.
 */
export type StudyFlowMode = "mastery_rounds" | "continuous";

export interface SkipDialogCopy {
  title: string;
  description: string;
  cancelLabel: string;
  knownLabel: string;
  unknownLabel: string;
}

export function skipDialogCopyFor(flowMode: StudyFlowMode): SkipDialogCopy {
  return {
    title: "Você ainda não respondeu este card",
    description:
      flowMode === "continuous"
        ? "Confirme o motivo do pulo para que o progresso fique correto. Se você já sabia, o card não será repetido; se não sabia, ele não voltará automaticamente."
        : "Confirme o motivo do pulo para que o progresso fique correto nas Rodadas de Domínio. Se você não sabia, o card voltará em uma próxima rodada.",
    cancelLabel: "Voltar e responder",
    knownLabel: "Eu sabia",
    unknownLabel: "Eu não sabia",
  };
}
