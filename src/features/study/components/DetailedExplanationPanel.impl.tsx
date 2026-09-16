import { useLayoutEffect, useSyncExternalStore } from "react";
import {
  getCurrentDetailedExplanation,
  setCurrentDetailedExplanation,
  subscribeCurrentDetailedExplanation,
} from "@/features/study/lib/currentDetailedExplanation";
import {
  getCurrentStudyCardIdentity,
  subscribeCurrentStudyCardIdentity,
} from "@/features/study/lib/currentStudyCardIdentity";
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
  const cardIdentity = useSyncExternalStore(
    subscribeCurrentStudyCardIdentity,
    getCurrentStudyCardIdentity,
    getCurrentStudyCardIdentity,
  );

  // Card navigation remains authoritative. The explicit card/layer identity is
  // part of this boundary because two consecutive cards can legitimately have
  // identical persisted note props (most often null). Without identity here,
  // an explanation edited on card A could remain in the transient live store
  // and be rendered on card B even though only A was persisted in the database.
  // In-game editing can still update the live snapshot immediately without
  // rebuilding the study deck/session.
  useLayoutEffect(() => {
    setCurrentDetailedExplanation({ explanation, usageNotes, commonMistakes });
  }, [
    cardIdentity.cardId,
    cardIdentity.layerIndex,
    explanation,
    usageNotes,
    commonMistakes,
  ]);

  return (
    <UnifiedDetailedExplanationPanel
      explanation={liveValue.explanation}
      usageNotes={liveValue.usageNotes}
      commonMistakes={liveValue.commonMistakes}
    />
  );
}
