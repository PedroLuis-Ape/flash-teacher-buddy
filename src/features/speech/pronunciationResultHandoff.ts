import type { PronunciationResultKind } from "./types";

type PendingOutcome = {
  cardId?: string;
  value: PronunciationResultKind;
  validUntil: number;
};

let nextOutcome: PendingOutcome | null = null;

export function savePronunciationOutcome(value: PronunciationResultKind, cardId?: string): void {
  nextOutcome = { cardId, value, validUntil: Date.now() + 5000 };
}

export function takePronunciationOutcome(cardId: string): { correct: boolean; skipped: boolean } | null {
  const outcome = nextOutcome;
  nextOutcome = null;
  if (!outcome || outcome.validUntil < Date.now()) return null;
  if (outcome.cardId && outcome.cardId !== cardId) return null;
  return {
    correct: outcome.value === "correct",
    skipped: outcome.value === "skipped",
  };
}
