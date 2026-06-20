import { lazy, Suspense, type ComponentProps } from "react";
import { StudyCardDeck } from "./StudyCardDeck";

const LazyUnscrambleStudyView = lazy(() =>
  import("./UnscrambleStudyView.impl").then((module) => ({ default: module.UnscrambleStudyView }))
);

type UnscrambleStudyViewProps = ComponentProps<typeof LazyUnscrambleStudyView>;

export const UnscrambleStudyView = (props: UnscrambleStudyViewProps) => (
  <StudyCardDeck
    cardKey={props.flashcardId || `${props.front}:${props.back}`}
    density="compact"
  >
    <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Preparando organizar palavras...</div>}>
      <LazyUnscrambleStudyView {...props} />
    </Suspense>
  </StudyCardDeck>
);
