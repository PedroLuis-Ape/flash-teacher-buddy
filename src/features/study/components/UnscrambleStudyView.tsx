import { lazy, Suspense, type ComponentProps } from "react";
import { StudyCardDeck } from "./StudyCardDeck";
import { getBalancedDirection, type RuntimeDirection } from "@/features/study/lib/runtimeStudySchedule";

const LazyUnscrambleStudyView = lazy(() =>
  import("./UnscrambleStudyView.impl").then((module) => ({ default: module.UnscrambleStudyView }))
);

type UnscrambleStudyViewProps = ComponentProps<typeof LazyUnscrambleStudyView>;

export const UnscrambleStudyView = (props: UnscrambleStudyViewProps) => {
  const cardKey = props.flashcardId || `${props.front}:${props.back}`;
  const direction = getBalancedDirection(cardKey, props.direction as RuntimeDirection);

  return (
    <StudyCardDeck cardKey={cardKey} density="compact">
      <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Preparando organizar palavras...</div>}>
        <LazyUnscrambleStudyView {...props} direction={direction} />
      </Suspense>
    </StudyCardDeck>
  );
};
