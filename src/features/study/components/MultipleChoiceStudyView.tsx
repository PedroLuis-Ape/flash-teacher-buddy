import { lazy, Suspense, type ComponentProps } from "react";
import { StudyCardDeck } from "./StudyCardDeck";

const LazyMultipleChoiceStudyView = lazy(() =>
  import("./MultipleChoiceStudyView.impl").then((module) => ({ default: module.MultipleChoiceStudyView }))
);

type MultipleChoiceStudyViewProps = ComponentProps<typeof LazyMultipleChoiceStudyView>;

export const MultipleChoiceStudyView = (props: MultipleChoiceStudyViewProps) => (
  <StudyCardDeck
    cardKey={props.currentCard.id || `${props.currentCard.term}:${props.currentCard.translation}`}
    density="compact"
  >
    <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Preparando múltipla escolha...</div>}>
      <LazyMultipleChoiceStudyView {...props} />
    </Suspense>
  </StudyCardDeck>
);
