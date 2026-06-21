import { lazy, Suspense, type ComponentProps } from "react";
import { StudyCardDeck } from "./StudyCardDeck";
import { getBalancedDirection, type RuntimeDirection } from "@/features/study/lib/runtimeStudySchedule";

const LazyWriteStudyView = lazy(() =>
  import("./WriteStudyView.impl").then((module) => ({ default: module.WriteStudyView }))
);

type WriteStudyViewProps = ComponentProps<typeof LazyWriteStudyView>;

export const WriteStudyView = (props: WriteStudyViewProps) => {
  const cardKey = props.flashcardId || `${props.front}:${props.back}`;
  const direction = getBalancedDirection(cardKey, props.direction as RuntimeDirection);

  return (
    <StudyCardDeck cardKey={cardKey} density="compact">
      <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Preparando modo Escrita...</div>}>
        <LazyWriteStudyView {...props} direction={direction} />
      </Suspense>
    </StudyCardDeck>
  );
};
