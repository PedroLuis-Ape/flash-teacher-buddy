import { useLayoutEffect, useSyncExternalStore } from "react";
import { setCurrentDetailedExplanation } from "@/features/study/lib/currentDetailedExplanation";
import {
  getCurrentStudyCardIdentity,
  subscribeCurrentStudyCardIdentity,
} from "@/features/study/lib/currentStudyCardIdentity";

interface DetailedExplanationPanelProps {
  explanation?: string | null;
  usageNotes?: string | null;
  commonMistakes?: string | null;
}

/**
 * Single-source bridge for the current card's rich explanation fields.
 *
 * Rendering is intentionally owned by StudyToolsMenu -> HintModal on every
 * viewport. This component only publishes the current card's canonical rich
 * fields into the shared snapshot so there is never a second explanation UI
 * competing with the same data.
 */
export function DetailedExplanationPanel({
  explanation,
  usageNotes,
  commonMistakes,
}: DetailedExplanationPanelProps) {
  const cardIdentity = useSyncExternalStore(
    subscribeCurrentStudyCardIdentity,
    getCurrentStudyCardIdentity,
    getCurrentStudyCardIdentity,
  );

  // Card/layer identity remains part of the synchronization boundary. Two
  // consecutive cards may both have null note props, and the identity change
  // must still clear any transient explanation edited on the previous card.
  useLayoutEffect(() => {
    setCurrentDetailedExplanation({ explanation, usageNotes, commonMistakes });
  }, [
    cardIdentity.cardId,
    cardIdentity.layerIndex,
    explanation,
    usageNotes,
    commonMistakes,
  ]);

  return null;
}
