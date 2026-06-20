import { lazy, Suspense, useMemo, type ComponentProps } from "react";
import { listIdFromPath, isPublicListPath } from "@/lib/listRoute";
import { useListPrimarySide } from "@/lib/useListPrimarySide";
import { primarySideToDirection } from "@/lib/primarySideDirection";
import { StudyCardDeck } from "./StudyCardDeck";
import { useDeckNavigationTransition } from "./useDeckNavigationTransition";

const LazyFlipStudyView = lazy(() =>
  import("./FlipStudyView.impl").then((module) => ({ default: module.FlipStudyView }))
);

type BaseFlipStudyViewProps = ComponentProps<typeof LazyFlipStudyView>;

export interface FlipCardPreview {
  id: string;
  front: string;
  back: string;
  direction: "a-b" | "b-a";
  imageUrlA?: string | null;
  imageUrlB?: string | null;
  labelA?: string;
  labelB?: string;
}

type FlipStudyViewProps = BaseFlipStudyViewProps & {
  nextCardPreview?: FlipCardPreview | null;
  previousCardPreview?: FlipCardPreview | null;
};

function StudyModeFallback() {
  return (
    <div className="flex min-h-64 w-full items-center justify-center text-sm text-muted-foreground">
      Preparando modo Flip...
    </div>
  );
}

function PassiveFlipCardPreview({ preview }: { preview: FlipCardPreview }) {
  const showA = preview.direction === "a-b";
  const text = showA ? preview.front : preview.back;
  const label = showA ? preview.labelA : preview.labelB;
  const imageUrl = showA ? preview.imageUrlA : preview.imageUrlB;

  return (
    <div className="study-card-deck-preview">
      {label && <span className="study-card-deck-preview__label">{label}</span>}
      {imageUrl && (
        <img
          className="study-card-deck-preview__image"
          src={imageUrl}
          alt=""
          draggable={false}
        />
      )}
      <span className="study-card-deck-preview__text">{text}</span>
    </div>
  );
}

export const FlipStudyView = ({
  nextCardPreview,
  previousCardPreview,
  ...props
}: FlipStudyViewProps) => {
  const listId = useMemo(() => listIdFromPath(window.location.pathname), []);
  const publicRoute = useMemo(() => isPublicListPath(window.location.pathname), []);
  const { side } = useListPrimarySide(listId, publicRoute);
  const cardKey = props.flashcardId || `${props.front}:${props.back}`;
  const transition = useDeckNavigationTransition(cardKey);

  const activePreview = transition.direction === "previous"
    ? previousCardPreview
    : nextCardPreview;

  const animatedNext = () => transition.next(props.onNext);
  const animatedPrevious = () => transition.previous(props.onPrevious);
  const animatedKnew = () => transition.next(props.onKnew);
  const animatedDidntKnow = () => transition.next(props.onDidntKnow);

  const deck = (
    <StudyCardDeck
      cardKey={cardKey}
      density={props.fastMode ? "regular" : "tall"}
      transitionPhase={transition.phase}
      preloadedCard={activePreview ? <PassiveFlipCardPreview preview={activePreview} /> : undefined}
      swipeNavigation={
        props.fastMode
          ? {
              onNext: animatedNext,
              onPrevious: animatedPrevious,
              canGoNext: props.canGoNext,
              canGoPrevious: props.canGoPrevious,
            }
          : undefined
      }
    >
      <Suspense fallback={<StudyModeFallback />}>
        <LazyFlipStudyView
          {...props}
          onNext={animatedNext}
          onPrevious={animatedPrevious}
          onKnew={animatedKnew}
          onDidntKnow={animatedDidntKnow}
        />
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
