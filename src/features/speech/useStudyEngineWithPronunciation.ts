import { useCallback } from "react";
import { useStudyEngine as useBaseStudyEngine } from "../study/hooks/useStudyEngine";
import { takePronunciationOutcome } from "./pronunciationResultHandoff";

export function useStudyEngine(...args: Parameters<typeof useBaseStudyEngine>) {
  const engine = useBaseStudyEngine(...args);
  const baseRecordResult = engine.recordResult;

  const recordResult = useCallback((flashcardId: string, correct: boolean, skipped = false) => {
    const assessed = takePronunciationOutcome(flashcardId);
    return baseRecordResult(
      flashcardId,
      assessed?.correct ?? correct,
      assessed?.skipped ?? skipped,
    );
  }, [baseRecordResult]);

  return {
    ...engine,
    recordResult,
  };
}
