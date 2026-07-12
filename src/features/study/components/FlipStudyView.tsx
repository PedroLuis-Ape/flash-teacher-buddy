import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listIdFromPath, isPublicListPath } from "@/lib/listRoute";
import { useListPrimarySide } from "@/lib/useListPrimarySide";
import { primarySideToDirection } from "@/lib/primarySideDirection";
import { getMixedFlipSlotMode, isMixedStudySession } from "@/features/study/lib/runtimeStudySchedule";
import { resolveStudySides, toBCP47 } from "@/features/study/lib/resolveStudySides";
import { useTTS } from "@/features/study/hooks/useTTS";
import { readFlipAutoPlayState } from "@/features/study/lib/flipAutoPlayState";
import {
  FLIP_ENTRY_AUDIO_DELAY_MS,
  readFlipEntryAudioPreference,
  writeFlipEntryAudioPreference,
} from "@/features/study/lib/flipEntryAudioPreference";
import { getSpeechRate } from "./SpeechRateControl";
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
  const [autoSpeakOnCardChange, setAutoSpeakOnCardChange] = useState(readFlipEntryAudioPreference);
  const scheduledCardRef = useRef<string | null>(null);
  const { speak, stop } = useTTS();

  const entrySpeech = useMemo(() => {
    const sideA = {
      text: props.front,
      lang: props.langA || "en",
      label: props.labelA || "Termo",
    };
    const sideB = {
      text: props.back,
      lang: props.langB || "pt",
      label: props.labelB || "Definição",
    };
    const { promptSide } = resolveStudySides(sideA, sideB, props.direction, cardKey);
    return {
      text: promptSide.text,
      lang: toBCP47(promptSide.lang),
    };
  }, [cardKey, props.back, props.direction, props.front, props.labelA, props.labelB, props.langA, props.langB]);

  useEffect(() => {
    if (scheduledCardRef.current === cardKey) return;
    scheduledCardRef.current = cardKey;

    if (!autoSpeakOnCardChange || props.ttsEnabled === false || mixedSlotMode) return;

    const timer = window.setTimeout(() => {
      if (readFlipAutoPlayState().enabled) return;
      if (window.speechSynthesis?.speaking || window.speechSynthesis?.pending) return;

      void speak(entrySpeech.text, {
        langOverride: entrySpeech.lang,
        rate: getSpeechRate(),
      });
    }, FLIP_ENTRY_AUDIO_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [autoSpeakOnCardChange, cardKey, entrySpeech.lang, entrySpeech.text, mixedSlotMode, props.ttsEnabled, speak, stop]);

  const toggleAutoSpeak = () => {
    const next = !autoSpeakOnCardChange;
    setAutoSpeakOnCardChange(next);
    writeFlipEntryAudioPreference(next);
    if (!next) stop();
  };

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

  const primaryLabel = side === "b" ? props.labelB : props.labelA;
  const sessionLabel = props.direction === "b-a" ? props.labelB : props.direction === "a-b" ? props.labelA : "Misto";
  const followsPrimary = props.direction === primarySideToDirection(side);
  const audioAvailable = props.ttsEnabled !== false;

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap justify-center gap-2 text-[11px]">
        {listId && (
          <>
            <span className="rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary">
              Principal: {primaryLabel}
            </span>
            {!followsPrimary && (
              <span className="rounded-full bg-amber-500/10 px-2 py-1 font-medium text-amber-700 dark:text-amber-300">
                Primeiro nesta sessão: {sessionLabel}
              </span>
            )}
          </>
        )}
        <Button
          type="button"
          variant={autoSpeakOnCardChange && audioAvailable ? "secondary" : "outline"}
          size="sm"
          className="h-7 gap-1.5 rounded-full px-2.5 text-[11px]"
          onClick={toggleAutoSpeak}
          disabled={!audioAvailable}
          aria-pressed={autoSpeakOnCardChange && audioAvailable}
          title={audioAvailable ? "Reproduzir o lado visível um segundo após trocar de card" : "Áudio desativado nesta lista"}
        >
          {autoSpeakOnCardChange && audioAvailable
            ? <Volume2 className="h-3.5 w-3.5" />
            : <VolumeX className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">Áudio ao trocar:</span>
          <span>{autoSpeakOnCardChange && audioAvailable ? "ligado" : "desligado"}</span>
        </Button>
      </div>
      {deck}
    </div>
  );
};
