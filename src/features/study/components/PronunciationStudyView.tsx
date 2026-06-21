import { lazy, Suspense, type ComponentProps } from "react";
import { StudyCardDeck } from "./StudyCardDeck";

const LazyPronunciationStudyView = lazy(() =>
  import("./PronunciationStudyView.impl").then((module) => ({ default: module.PronunciationStudyView }))
);

type PronunciationStudyViewProps = ComponentProps<typeof LazyPronunciationStudyView>;

export const PronunciationStudyView = (props: PronunciationStudyViewProps) => (
  <StudyCardDeck cardKey={`${props.front}:${props.back}:${props.direction}`} density="compact">
    <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Preparando pronúncia...</div>}>
      <LazyPronunciationStudyView {...props} />
    </Suspense>
  </StudyCardDeck>
);
