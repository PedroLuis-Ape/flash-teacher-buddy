import { lazy, Suspense, type ComponentProps } from "react";
import { StudyCardDeck } from "./StudyCardDeck";
import {
  getBalancedDirection,
  getMixedMultipleSlotMode,
  isMixedStudySession,
  type RuntimeDirection,
} from "@/features/study/lib/runtimeStudySchedule";

const LazyMultipleChoiceStudyView = lazy(() =>
  import("./MultipleChoiceStudyView.impl").then((module) => ({ default: module.MultipleChoiceStudyView }))
);
const LazyWriteStudyView = lazy(() =>
  import("./WriteStudyView.impl").then((module) => ({ default: module.WriteStudyView }))
);

type MultipleChoiceStudyViewProps = ComponentProps<typeof LazyMultipleChoiceStudyView>;

export const MultipleChoiceStudyView = (props: MultipleChoiceStudyViewProps) => {
  const cardKey = props.currentCard.id || `${props.currentCard.term}:${props.currentCard.translation}`;
  const direction = getBalancedDirection(cardKey, props.direction as RuntimeDirection);
  const renderWrite = isMixedStudySession() && getMixedMultipleSlotMode(cardKey) === "write";
  void LazyWriteStudyView;
  void renderWrite;

  return (
    <StudyCardDeck cardKey={cardKey} density="compact">
      <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Preparando múltipla escolha...</div>}>
        <LazyMultipleChoiceStudyView {...props} direction={direction} />
      </Suspense>
    </StudyCardDeck>
  );
};
