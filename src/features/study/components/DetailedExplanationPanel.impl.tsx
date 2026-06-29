import { useLayoutEffect } from "react";
import { setCurrentDetailedExplanation } from "@/features/study/lib/currentDetailedExplanation";
import { DesktopExplanationPlaceholder } from "./DesktopExplanationPlaceholder";
import "./desktop-explanation.css";

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

  return (
    <DesktopExplanationPlaceholder
      explanation={explanation}
      usageNotes={usageNotes}
      commonMistakes={commonMistakes}
    />
  );
}
