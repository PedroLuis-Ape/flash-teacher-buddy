import { useLayoutEffect, useSyncExternalStore } from "react";
import {
  getCurrentDetailedExplanation,
  setCurrentDetailedExplanation,
  subscribeCurrentDetailedExplanation,
} from "@/features/study/lib/currentDetailedExplanation";
import { UnifiedDetailedExplanationPanel } from "./UnifiedDetailedExplanationPanel";

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
  const liveValue = useSyncExternalStore(
    subscribeCurrentDetailedExplanation,
    getCurrentDetailedExplanation,
    getCurrentDetailedExplanation,
  );

  // Card navigation remains authoritative: when the visible card changes, its
  // persisted fields refresh the shared snapshot. In-game editing can update
  // the same snapshot immediately without rebuilding the study deck/session.
  useLayoutEffect(() => {
    setCurrentDetailedExplanation({ explanation, usageNotes, commonMistakes });
  }, [explanation, usageNotes, commonMistakes]);

  return (
    <UnifiedDetailedExplanationPanel
      explanation={liveValue.explanation}
      usageNotes={liveValue.usageNotes}
      commonMistakes={liveValue.commonMistakes}
    />
  );
}
