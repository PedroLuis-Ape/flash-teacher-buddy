import { useLayoutEffect } from "react";
import { setCurrentDetailedExplanation } from "@/features/study/lib/currentDetailedExplanation";
import { DesktopDetailedExplanationPanel } from "./DesktopDetailedExplanationPanel";

interface DetailedExplanationPanelProps {
  explanation?: string | null;
  usageNotes?: string | null;
  commonMistakes?: string | null;
}

/**
 * Keeps the enriched explanation available to the existing hint tool and adds
 * the optional desktop side panel without changing the mobile study flow.
 */
export function DetailedExplanationPanel({
  explanation,
  usageNotes,
  commonMistakes,
}: DetailedExplanationPanelProps) {
  useLayoutEffect(() => {
    setCurrentDetailedExplanation({ explanation, usageNotes, commonMistakes });
  }, [explanation, usageNotes, commonMistakes]);

  return (
    <DesktopDetailedExplanationPanel
      explanation={explanation}
      usageNotes={usageNotes}
      commonMistakes={commonMistakes}
    />
  );
}
