import { useLayoutEffect } from "react";
import { setCurrentDetailedExplanation } from "@/features/study/lib/currentDetailedExplanation";

interface DetailedExplanationPanelProps {
  explanation?: string | null;
  usageNotes?: string | null;
  commonMistakes?: string | null;
}

export function DetailedExplanationPanel({
  explanation,
  usageNotes,
  commonMistakes,
}: DetailedExplanationPanelProps) {
  useLayoutEffect(() => {
    setCurrentDetailedExplanation({ explanation, usageNotes, commonMistakes });
  }, [explanation, usageNotes, commonMistakes]);

  return null;
}
