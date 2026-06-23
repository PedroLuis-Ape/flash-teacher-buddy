import { useLayoutEffect } from "react";
import { setCurrentDetailedExplanation } from "@/features/study/lib/currentDetailedExplanation";

interface DetailedExplanationPanelProps {
  explanation?: string | null;
  usageNotes?: string | null;
  commonMistakes?: string | null;
}

/**
 * Keeps the current card's enriched explanation available to the existing hint
 * tool. The old standalone panel was removed because it duplicated the hint
 * experience and broke the mobile layout.
 */
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
