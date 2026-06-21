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

  const activity = renderWrite ? (
    <LazyWriteStudyView
      front={props.currentCard.term}
      back={props.currentCard.translation}
      hint={props.currentCard.hint}
      flashcardId={props.currentCard.id}
      wordHintsA={props.currentCard.word_hints}
      mergedHintsA={props.mergedHintsA}
      mergedHintsB={props.mergedHintsB}
      direction={direction}
      langA={props.langA}
      langB={props.langB}
      isFavorite={props.isFavorite}
      isRedListed={props.isRedListed}
      onToggleFavorite={props.onToggleFavorite}
      onToggleRedList={props.onToggleRedList}
      isSpecial={props.isSpecial}
      onToggleSpecial={props.onToggleSpecial}
      onCorrect={props.onCorrect}
      onIncorrect={props.onIncorrect}
      onSkip={props.onIncorrect}
    />
  ) : (
    <LazyMultipleChoiceStudyView {...props} direction={direction} />
  );

  return (
    <StudyCardDeck cardKey={cardKey} density="compact">
      <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Preparando atividade...</div>}>
        {activity}
      </Suspense>
    </StudyCardDeck>
  );
};
