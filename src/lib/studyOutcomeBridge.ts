import { useCallback } from "react";
import { useStudyEngine as useBaseStudyEngine } from "@/features/study/hooks/useStudyEngine";

const STORAGE_KEY = "app-piteco:pending-pronunciation-outcome";

type PendingOutcome = {
  cardId?: string;
  value: "correct" | "almost" | "incorrect" | "skipped";
  validUntil: number;
};

export function saveStudyPronunciationOutcome(value: PendingOutcome["value"], cardId?: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ cardId, value, validUntil: Date.now() + 5000 } satisfies PendingOutcome));
}

function takeStudyPronunciationOutcome(cardId: string): { correct: boolean; skipped: boolean } | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const outcome = JSON.parse(raw) as PendingOutcome;
    if (outcome.validUntil < Date.now()) return null;
    if (outcome.cardId && outcome.cardId !== cardId) return null;
    return { correct: outcome.value === "correct", skipped: outcome.value === "skipped" };
  } catch {
    return null;
  }
}

export function useStudyEngine(...args: Parameters<typeof useBaseStudyEngine>) {
  const engine = useBaseStudyEngine(...args);
  const baseRecordResult = engine.recordResult;
  const recordResult = useCallback((flashcardId: string, correct: boolean, skipped = false) => {
    const assessed = takeStudyPronunciationOutcome(flashcardId);
    return baseRecordResult(flashcardId, assessed?.correct ?? correct, assessed?.skipped ?? skipped);
  }, [baseRecordResult]);
  return { ...engine, recordResult };
}
