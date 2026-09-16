import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listIdFromPath, isPublicListPath } from "@/lib/listRoute";
import { useListPrimarySide } from "@/lib/useListPrimarySide";
import { primarySideToDirection } from "@/lib/primarySideDirection";
import { getMixedFlipSlotMode, isMixedStudySession } from "@/features/study/lib/runtimeStudySchedule";
import {
  readFlipEntryAudioPreference,
  writeFlipEntryAudioPreference,
} from "@/features/study/lib/flipEntryAudioPreference";
import { StudyCardDeck } from "./StudyCardDeck";
import { MixedSlotActivity } from "./MixedSlotActivity";
import type { WriteSessionSettings } from "@/features/study/lib/writeActivityMode";

const LazyFlipStudyView = lazy(() =>
  import("./FlipStudyView.impl").then((module) => ({ default: module.FlipStudyView }))
);

type FlipStudyViewProps = ComponentProps<typeof LazyFlipStudyView> & {
  /** Configurações de escrita para o slot "write" das sessões mistas. */
  writeSettings?: WriteSessionSettings;
};

type FeedDirection = "next" | "previous";

const FEED_COMMIT_DISTANCE_PX = 82;
const FEED_COMMIT_VELOCITY_PX_MS = 0.42;
const FEED_SETTLE_MS = 190;
const FEED_MAX_DRAG_PX = 560;
const FEED_WHEEL_COMMIT_PX = 92;
const FEED_WHEEL_RESET_MS = 150;

function StudyModeFallback() {
  return (
    <div className="flex min-h-64 w-full items-center justify-center text-sm text-muted-foreground">
      Preparando modo Flip...
    </div>
  );
}

function isFeedInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(
    "button, a, input, textarea, select, [role='button'], [contenteditable='true'], [data-no-card-swipe='true']",
  ));
}

export const FlipStudyView = (props: FlipStudyViewProps) => {
  const listId = useMemo(() => listIdFromPath(window.location.pathname), []);
  const publicRoute = useMemo(() => isPublicListPath(window.location.pathname), []);
  const { side } = useListPrimarySide(listId, publicRoute);
  const cardKey = props.flashcardId || `${props.front}:${props.back}`;
  const mixedSlotMode = isMixedStudySession() ? getMixedFlipSlotMode(cardKey) : null;
  const [autoSpeakOnCardChange, setAutoSpeakOnCardChange] = useState(readFlipEntryAudioPreference);
  const scheduledCardRef = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Flip is intentionally the only study mode with a vertical, feed-like
  // navigation gesture. The current card follows the finger/wheel while a
  // second card-shaped surface rises from below (or above when going back).
  // Navigation itself still calls the existing onNext/onPrevious contracts, so
  // persistence, card order, layers and game rules remain owned by Study.
  const feedStartRef = useRef<{ x: number; y: number; t: number; pointerId: number } | null>(null);
  const feedConsumedRef = useRef(false);
  const feedNavigationTimerRef = useRef<number | null>(null);
  const feedWheelResetTimerRef = useRef<number | null>(null);
  const feedWheelAccumRef = useRef(0);
  const [feedOffset, setFeedOffset] = useState(0);
  const [feedDragging, setFeedDragging] = useState(false);
  const [feedSettling, setFeedSettling] = useState<FeedDirection | null>(null);

  const canFeedNext = Boolean(props.onNext && props.canGoNext !== false);
  const canFeedPrevious = Boolean(props.onPrevious && props.canGoPrevious !== false);

  const clearFeedTimers = useCallback(() => {
    if (feedNavigationTimerRef.current !== null) {
      window.clearTimeout(feedNavigationTimerRef.current);
      feedNavigationTimerRef.current = null;
    }
    if (feedWheelResetTimerRef.current !== null) {
      window.clearTimeout(feedWheelResetTimerRef.current);
      feedWheelResetTimerRef.current = null;
    }
  }, []);

  const resetFeedVisual = useCallback(() => {
    setFeedDragging(false);
    setFeedSettling(null);
    setFeedOffset(0);
    feedWheelAccumRef.current = 0;
  }, []);

  const commitFeedNavigation = useCallback((direction: FeedDirection) => {
    if (feedSettling) return;
    if (direction === "next" && !canFeedNext) {
      resetFeedVisual();
      return;
    }
    if (direction === "previous" && !canFeedPrevious) {
      resetFeedVisual();
      return;
    }

    clearFeedTimers();
    feedConsumedRef.current = true;
    setFeedDragging(false);
    setFeedSettling(direction);
    const travel = Math.min(
      FEED_MAX_DRAG_PX,
      Math.max(360, typeof window === "undefined" ? 480 : window.innerHeight * 0.62),
    );
    setFeedOffset(direction === "next" ? -travel : travel);

    feedNavigationTimerRef.current = window.setTimeout(() => {
      if (direction === "next") props.onNext?.();
      else props.onPrevious?.();
      resetFeedVisual();
      feedNavigationTimerRef.current = null;
    }, FEED_SETTLE_MS);
  }, [
    canFeedNext,
    canFeedPrevious,
    clearFeedTimers,
    feedSettling,
    props.onNext,
    props.onPrevious,
    resetFeedVisual,
  ]);

  useEffect(() => {
    scheduledCardRef.current = cardKey;
    clearFeedTimers();
    resetFeedVisual();
  }, [cardKey, clearFeedTimers, resetFeedVisual]);

  useEffect(() => () => clearFeedTimers(), [clearFeedTimers]);

  const handleFeedPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (feedSettling || isFeedInteractiveTarget(event.target)) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    feedStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      t: performance.now(),
      pointerId: event.pointerId,
    };
    feedConsumedRef.current = false;
    setFeedDragging(false);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleFeedPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = feedStartRef.current;
    if (!start || start.pointerId !== event.pointerId || feedSettling) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absY < 7) return;
    if (absX > absY * 0.92) return;

    event.preventDefault();
    feedConsumedRef.current = true;
    setFeedDragging(true);

    const directionAllowed = dy < 0 ? canFeedNext : canFeedPrevious;
    const resisted = directionAllowed ? dy : dy * 0.18;
    const clamped = Math.max(-FEED_MAX_DRAG_PX, Math.min(FEED_MAX_DRAG_PX, resisted));
    setFeedOffset(clamped);
  };

  const finishFeedPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = feedStartRef.current;
    feedStartRef.current = null;
    if (!start || start.pointerId !== event.pointerId || feedSettling) return;

    const dy = event.clientY - start.y;
    const dx = event.clientX - start.x;
    const elapsed = Math.max(performance.now() - start.t, 1);
    const velocity = Math.abs(dy) / elapsed;
    const verticalGesture = Math.abs(dy) > Math.abs(dx) * 1.08 && Math.abs(dy) >= 18;

    setFeedDragging(false);
    if (!verticalGesture) {
      setFeedOffset(0);
      return;
    }

    feedConsumedRef.current = true;
    const committed = Math.abs(dy) >= FEED_COMMIT_DISTANCE_PX || velocity >= FEED_COMMIT_VELOCITY_PX_MS;
    if (committed && dy < 0 && canFeedNext) {
      commitFeedNavigation("next");
      return;
    }
    if (committed && dy > 0 && canFeedPrevious) {
      commitFeedNavigation("previous");
      return;
    }
    setFeedOffset(0);
  };

  const handleFeedClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!feedConsumedRef.current) return;
    feedConsumedRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleFeedWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (feedSettling || isFeedInteractiveTarget(event.target)) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    const direction: FeedDirection = event.deltaY > 0 ? "next" : "previous";
    const allowed = direction === "next" ? canFeedNext : canFeedPrevious;
    if (!allowed) return;

    event.preventDefault();
    feedConsumedRef.current = true;
    if (feedWheelResetTimerRef.current !== null) {
      window.clearTimeout(feedWheelResetTimerRef.current);
    }

    // A mudança de sinal começa uma nova intenção de scroll.
    if (Math.sign(feedWheelAccumRef.current) !== Math.sign(event.deltaY)) {
      feedWheelAccumRef.current = 0;
    }
    feedWheelAccumRef.current += event.deltaY;
    const visual = Math.min(76, Math.abs(feedWheelAccumRef.current));
    setFeedDragging(true);
    setFeedOffset(direction === "next" ? -visual : visual);

    if (Math.abs(feedWheelAccumRef.current) >= FEED_WHEEL_COMMIT_PX) {
      commitFeedNavigation(direction);
      return;
    }

    feedWheelResetTimerRef.current = window.setTimeout(() => {
      feedWheelAccumRef.current = 0;
      setFeedDragging(false);
      setFeedOffset(0);
      feedWheelResetTimerRef.current = null;
    }, FEED_WHEEL_RESET_MS);
  };

  const toggleAutoSpeak = () => {
    const next = !autoSpeakOnCardChange;
    setAutoSpeakOnCardChange(next);
    writeFlipEntryAudioPreference(next);
  };

  if (mixedSlotMode) {
    return (
      <MixedSlotActivity
        mode={mixedSlotMode}
        front={props.front}
        back={props.back}
        hint={props.hint}
        direction={props.direction}
        writeSettings={props.writeSettings}
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
        isDifficult={props.isDifficult}
        onToggleDifficulty={props.onToggleDifficulty}
        difficultyPending={props.difficultyPending}
        onCorrect={props.onKnew}
        onIncorrect={props.onDidntKnow}
        onPrevious={props.onPrevious}
        canGoPrevious={props.canGoPrevious}
        layerCount={props.layerCount}
        layersVisitedCount={props.layersVisitedCount}
        onOpenLayers={props.onOpenLayers}
      />
    );
  }

  const feedStyle = {
    "--flip-feed-offset": `${feedOffset}px`,
  } as CSSProperties;

  const deck = (
    <div
      className="flip-vertical-feed-viewport"
      data-feed-dragging={feedDragging ? "true" : undefined}
      data-feed-settling={feedSettling ?? undefined}
      data-can-feed-next={canFeedNext ? "true" : "false"}
      data-can-feed-previous={canFeedPrevious ? "true" : "false"}
      style={feedStyle}
      onPointerDown={handleFeedPointerDown}
      onPointerMove={handleFeedPointerMove}
      onPointerUp={finishFeedPointer}
      onPointerCancel={finishFeedPointer}
      onClickCapture={handleFeedClickCapture}
      onWheel={handleFeedWheel}
      aria-label="Modo Flip com navegação vertical"
    >
      <div className="flip-vertical-feed-preview flip-vertical-feed-preview--previous" aria-hidden="true">
        <div className="flip-vertical-feed-preview-card">
          <span>Card anterior</span>
        </div>
      </div>
      <div className="flip-vertical-feed-preview flip-vertical-feed-preview--next" aria-hidden="true">
        <div className="flip-vertical-feed-preview-card">
          <span>Próximo card</span>
        </div>
      </div>
      <div className="flip-vertical-feed-current">
        <StudyCardDeck
          cardKey={cardKey}
          density={props.fastMode ? "regular" : "tall"}
        >
          <Suspense fallback={<StudyModeFallback />}>
            <LazyFlipStudyView
              {...props}
              autoSpeakOnCardChange={autoSpeakOnCardChange && !mixedSlotMode}
            />
          </Suspense>
        </StudyCardDeck>
      </div>
      <p className="sr-only">Arraste para cima para o próximo card e para baixo para voltar.</p>
    </div>
  );

  const primaryLabel = side === "b" ? props.labelB : props.labelA;
  const sessionLabel = props.direction === "b-a" ? props.labelB : props.direction === "a-b" ? props.labelA : "Misto";
  const followsPrimary = props.direction === primarySideToDirection(side);
  const audioAvailable = props.ttsEnabled !== false;

  return (
    <div ref={rootRef} className="w-full space-y-2">
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
          title={audioAvailable ? "Reproduzir o lado visível ao trocar de card" : "Áudio desativado nesta lista"}
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
