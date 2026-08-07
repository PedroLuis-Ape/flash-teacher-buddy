import { lazy, Suspense, useEffect, useRef, type ComponentProps } from "react";
import { StudyCardDeck } from "./StudyCardDeck";
import { WriteStudyView } from "./WriteStudyView";
import {
  getBalancedDirection,
  getMixedMultipleSlotMode,
  isMixedStudySession,
  type RuntimeDirection,
} from "@/features/study/lib/runtimeStudySchedule";
import { useResolvedStudyGlossaryHints } from "@/features/study/hooks/useResolvedStudyGlossaryHints";
import {
  DEFAULT_WRITE_SESSION_SETTINGS,
  type WriteSessionSettings,
} from "@/features/study/lib/writeActivityMode";

const LazyMultipleChoiceStudyView = lazy(() =>
  import("./MultipleChoiceStudyView.impl").then((module) => ({ default: module.MultipleChoiceStudyView }))
);

type MultipleChoiceStudyViewProps = ComponentProps<typeof LazyMultipleChoiceStudyView> & {
  /** Configurações de escrita para o slot "write" das sessões mistas. */
  writeSettings?: WriteSessionSettings;
};

export const MultipleChoiceStudyView = (props: MultipleChoiceStudyViewProps) => {
  const cardKey = props.currentCard.id || `${props.currentCard.term}:${props.currentCard.translation}`;
  const direction = getBalancedDirection(cardKey, props.direction as RuntimeDirection);
  const renderWrite = isMixedStudySession() && getMixedMultipleSlotMode(cardKey) === "write";
  const navigationLockedRef = useRef(false);
  const glossaryHints = useResolvedStudyGlossaryHints({
    front: props.currentCard.term,
    back: props.currentCard.translation,
    wordHints: props.currentCard.word_hints,
    mergedHintsA: props.mergedHintsA,
    mergedHintsB: props.mergedHintsB,
    langA: props.langA,
    langB: props.langB,
  });

  useEffect(() => {
    navigationLockedRef.current = false;
  }, [cardKey, direction, renderWrite]);

  const runOnce = (action: () => void) => {
    if (navigationLockedRef.current) return;
    navigationLockedRef.current = true;
    action();
  };

  const onCorrect = () => runOnce(props.onCorrect);
  const onIncorrect = () => runOnce(props.onIncorrect);
  const onSkip = props.onSkip ? () => runOnce(props.onSkip!) : undefined;

  if (glossaryHints.isLoading) {
    return (
      <StudyCardDeck cardKey={cardKey} density="compact">
        <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
          Carregando glossário da pasta...
        </div>
      </StudyCardDeck>
    );
  }

  if (renderWrite) {
    return (
      <WriteStudyView
        front={props.currentCard.term}
        back={props.currentCard.translation}
        hint={props.currentCard.hint}
        flashcardId={props.currentCard.id}
        wordHintsA={props.currentCard.word_hints}
        mergedHintsA={glossaryHints.mergedHintsA}
        mergedHintsB={glossaryHints.mergedHintsB}
        direction={direction}
        {...(props.writeSettings ?? DEFAULT_WRITE_SESSION_SETTINGS)}
        langA={props.langA}
        langB={props.langB}
        isFavorite={props.isFavorite}
        isRedListed={props.isRedListed}
        onToggleFavorite={props.onToggleFavorite}
        onToggleRedList={props.onToggleRedList}
        isSpecial={props.isSpecial}
        onToggleSpecial={props.onToggleSpecial}
        onCorrect={onCorrect}
        onIncorrect={onIncorrect}
        onSkip={onSkip ?? onIncorrect}
      />
    );
  }

  return (
    <StudyCardDeck cardKey={cardKey} density="compact">
      <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Preparando atividade...</div>}>
        <LazyMultipleChoiceStudyView
          {...props}
          mergedHintsA={glossaryHints.mergedHintsA}
          mergedHintsB={glossaryHints.mergedHintsB}
          direction={direction}
           onCorrect={onCorrect}
           onIncorrect={onIncorrect}
           onSkip={onSkip}
         />
      </Suspense>
    </StudyCardDeck>
  );
};
