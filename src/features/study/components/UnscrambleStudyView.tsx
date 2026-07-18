import { lazy, Suspense, type ComponentProps } from "react";
import { StudyCardDeck } from "./StudyCardDeck";
import { getBalancedDirection, type RuntimeDirection } from "@/features/study/lib/runtimeStudySchedule";
import { useResolvedStudyGlossaryHints } from "@/features/study/hooks/useResolvedStudyGlossaryHints";

const LazyUnscrambleStudyView = lazy(() =>
  import("./UnscrambleStudyView.impl").then((module) => ({ default: module.UnscrambleStudyView }))
);

type UnscrambleStudyViewProps = ComponentProps<typeof LazyUnscrambleStudyView>;

export const UnscrambleStudyView = (props: UnscrambleStudyViewProps) => {
  const cardKey = props.flashcardId || `${props.front}:${props.back}`;
  const direction = getBalancedDirection(cardKey, props.direction as RuntimeDirection);
  const glossaryHints = useResolvedStudyGlossaryHints({
    front: props.front,
    back: props.back,
    wordHints: props.wordHintsA,
    mergedHintsA: props.mergedHintsA,
    mergedHintsB: props.mergedHintsB,
    langA: props.langA,
    langB: props.langB,
  });

  if (glossaryHints.isLoading) {
    return (
      <StudyCardDeck cardKey={cardKey} density="compact">
        <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
          Carregando glossário da pasta...
        </div>
      </StudyCardDeck>
    );
  }

  return (
    <StudyCardDeck cardKey={cardKey} density="compact">
      <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Preparando organizar palavras...</div>}>
        <LazyUnscrambleStudyView
          {...props}
          mergedHintsA={glossaryHints.mergedHintsA}
          mergedHintsB={glossaryHints.mergedHintsB}
          direction={direction}
        />
      </Suspense>
    </StudyCardDeck>
  );
};
