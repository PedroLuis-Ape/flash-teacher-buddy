import { lazy, Suspense, type ComponentProps } from "react";
import { StudyCardDeck } from "./StudyCardDeck";

const LazyWriteStudyView = lazy(() =>
  import("./WriteStudyView.impl").then((module) => ({ default: module.WriteStudyView }))
);

type WriteStudyViewProps = ComponentProps<typeof LazyWriteStudyView>;

export const WriteStudyView = (props: WriteStudyViewProps) => (
  <StudyCardDeck
    cardKey={props.flashcardId || `${props.front}:${props.back}`}
    density="compact"
  >
    <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Preparando modo Escrita...</div>}>
      <LazyWriteStudyView {...props} />
    </Suspense>
  </StudyCardDeck>
);
