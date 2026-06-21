import { lazy, Suspense, useMemo, type ComponentProps } from "react";
import { listIdFromPath, isPublicListPath } from "@/lib/listRoute";
import { useListPrimarySide } from "@/lib/useListPrimarySide";
import { primarySideToDirection } from "@/lib/primarySideDirection";
import { getMixedFlipSlotMode, isMixedStudySession } from "@/features/study/lib/runtimeStudySchedule";
import { StudyCardDeck } from "./StudyCardDeck";
import { MixedSlotActivity } from "./MixedSlotActivity";

const LazyFlipStudyView = lazy(() =>
  import("./FlipStudyView.impl").then((module) => ({ default: module.FlipStudyView }))
);

type FlipStudyViewProps = ComponentProps<typeof LazyFlipStudyView>;

function StudyModeFallback() {
  return (
    <div className="flex min-h-64 w-full items-center justify-center text-sm text-muted-foreground">
      Preparando modo Flip...
    </div>
  );
}

export const FlipStudyView = (props: FlipStudyViewProps) => {
  const listId = useMemo(() => listIdFromPath(window.location.pathname), []);
  const publicRoute = useMemo(() => isPublicListPath(window.location.pathname), []);
  const { side } = useListPrimarySide(listId, publicRoute);
  const cardKey = props.flashcardId || `${props.front}:${props.back}`;
  const mixedSlotMode = isMixedStudySession() ? getMixedFlipSlotMode(cardKey) : null;

  if (mixedSlotMode) {
    return (
      <MixedSlotActivity
        mode={mixedSlotMode}
        front={props.front}
        back={props.back}
        hint={props.hint}
        direction={props.direction}
        flashcardId={props.flashcardId}
        wordHintsA={props.wordHintsA}
        mergedHintsA={props.mergedHintsA}
        mergedHintsB={props.mergedHintsB}
        langA={props.langA}
        langB={props.langB}
        labelA={props.labelA}
        labelB={props.labelB}
        isFavorite={props.isFavorite}
        isRedListed={props.isRedListed}
        onToggleFavorite={props.onToggleFavorite}
        onToggleRedList={props.onToggleRedList}
        isSpecial={props.isSpecial}
        onToggleSpecial={props.onToggleSpecial}
        onCorrect={props.onKnew}
        onIncorrect={props.onDidntKnow}
      />
    );
  }

  const deck = (
    <StudyCardDeck
      cardKey={cardKey}
      density={props.fastMode ? "regular" : "tall"}
      swipeNavigation={
        props.fastMode
          ? {
              onNext: props.onNext,
              onPrevious: props.onPrevious,
              canGoNext: props.canGoNext,
              canGoPrevious: props.canGoPrevious,
            }
          : undefined
      }
    >
      <Suspense fallback={<StudyModeFallback />}>
        <LazyFlipStudyView {...props} />
      </Suspense>
    </StudyCardDeck>
  );

  if (!listId) return deck;

  const primaryLabel = side === "b" ? props.labelB : props.labelA;
  const sessionLabel = props.direction === "b-a" ? props.labelB : props.direction === "a-b" ? props.labelA : "Misto";
  const followsPrimary = props.direction === primarySideToDirection(side);

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap justify-center gap-2 text-[11px]">
        <span className="rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary">
          Principal: {primaryLabel}
        </span>
        {!followsPrimary && (
          <span className="rounded-full bg-amber-500/10 px-2 py-1 font-medium text-amber-700 dark:text-amber-300">
            Primeiro nesta sessão: {sessionLabel}
          </span>
        )}
      </div>
      {deck}
    </div>
  );
};
