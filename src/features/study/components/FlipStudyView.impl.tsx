import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useShortcutMap } from "@/hooks/useKeyboardShortcuts";
import { cn } from "@/lib/utils";
import { playCorrect, playWrong } from "@/lib/sfx";
import { normalizeKey, isTypingTarget } from "@/features/study/lib/keyboardShortcuts";
import { useTTS } from "@/features/study/hooks/useTTS";
import { resolveStudySides, toBCP47 } from "@/features/study/lib/resolveStudySides";
import { readFlipAutoPlayState, writeFlipAutoPlayState, type FlipAutoPlaySide } from "@/features/study/lib/flipAutoPlayState";
import { getSpeechRate } from "./SpeechRateControl";
import { StudyToolsMenu } from "./StudyToolsMenu";
import { ImageCard } from "./ImageCard";
import { InteractiveText } from "./InteractiveText";
import { getRedListCardClass } from "./RedListIndicator";
import type { MergedHint } from "@/features/study/lib/glossaryMerge";
import "./flipStudyMobileCompact.css";

const AUTO_PLAY_DELAY_MS = 5000;

function oppositeAutoPlaySide(side: FlipAutoPlaySide): FlipAutoPlaySide {
  return side === "a" ? "b" : "a";
}

type ResolvedSide = { text: string; lang: string; label: string };
type RenderedSide = "first" | "second";

interface SidePanelProps {
  side: ResolvedSide;
  imageUrl?: string | null;
  wordHints?: unknown;
  mergedHints?: MergedHint[];
  speakLang: string;
  ttsEnabled: boolean;
  onPlay: () => void;
  accent?: boolean;
  compact?: boolean;
  showRevealHint?: boolean;
}

function SidePanel({
  side,
  imageUrl,
  wordHints,
  mergedHints,
  speakLang,
  ttsEnabled,
  onPlay,
  accent = false,
  compact = false,
  showRevealHint = false,
}: SidePanelProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center overflow-auto p-3 sm:p-6",
        accent ? "bg-gradient-to-br from-primary/10 to-accent/10" : "bg-gradient-to-br from-card to-muted/20",
      )}
    >
      <div className="mb-1 flex items-center gap-2 sm:mb-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-sm">{side.label}</p>
        {ttsEnabled && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(event) => {
              event.stopPropagation();
              onPlay();
            }}
            className="h-7 w-7"
            title="Ouvir áudio"
          >
            <Volume2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {imageUrl && (
        <ImageCard src={imageUrl} alt={side.text} className="mb-2 sm:mb-3" maxHeight={compact ? "80px" : "100px"} />
      )}

      <ScrollArea className={compact ? "max-h-24 w-full sm:max-h-32" : "max-h-full w-full"}>
        <p
          className={cn(
            "px-2 text-center font-semibold leading-relaxed sm:px-4",
            compact ? "text-xl sm:text-2xl" : "text-lg sm:text-3xl",
            accent && "text-primary",
          )}
          style={{ wordBreak: "normal", overflowWrap: "normal" }}
        >
          <InteractiveText
            text={side.text}
            wordHints={wordHints}
            mergedHints={mergedHints}
            speakOnHintClick={ttsEnabled}
            speakLang={speakLang}
          />
        </p>
      </ScrollArea>

      {showRevealHint && <p className="mt-3 text-[10px] text-muted-foreground/70 sm:mt-4 sm:text-xs">Clique para revelar</p>}
    </div>
  );
}

interface FlipStudyViewProps {
  front: string;
  back: string;
  hint?: string | null;
  flashcardId?: string;
  imageUrlA?: string | null;
  imageUrlB?: string | null;
  wordHintsA?: unknown;
  wordHintsB?: unknown;
  mergedHintsA?: MergedHint[];
  mergedHintsB?: MergedHint[];
  onKnew: () => void;
  onDidntKnow: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  direction: string;
  fastMode?: boolean;
  ttsEnabled?: boolean;
  labelA?: string;
  labelB?: string;
  langA?: string;
  langB?: string;
  isFavorite?: boolean;
  isRedListed?: boolean;
  onToggleFavorite?: () => void;
  onToggleRedList?: () => void;
  isSpecial?: boolean;
  onToggleSpecial?: () => void;
}

export const FlipStudyView = ({
  front,
  back,
  hint,
  flashcardId,
  imageUrlA,
  imageUrlB,
  wordHintsA,
  wordHintsB,
  mergedHintsA,
  mergedHintsB,
  onKnew,
  onDidntKnow,
  onNext,
  onPrevious,
  canGoPrevious = true,
  canGoNext = true,
  direction,
  fastMode = false,
  ttsEnabled = true,
  labelA,
  labelB,
  langA = "en",
  langB = "pt",
  isFavorite = false,
  isRedListed = false,
  onToggleFavorite,
  onToggleRedList,
  isSpecial = false,
  onToggleSpecial,
}: FlipStudyViewProps) => {
  const restoredAutoPlay = useRef(readFlipAutoPlayState());
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(restoredAutoPlay.current.enabled);
  const [autoPlaySide, setAutoPlaySide] = useState<FlipAutoPlaySide>(restoredAutoPlay.current.side);
  const [autoPlayCurrentSide, setAutoPlayCurrentSide] = useState<FlipAutoPlaySide>(restoredAutoPlay.current.side);
  const autoPlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const swipeConsumedRef = useRef(false);
  const { speak, stop } = useTTS();

  const sideA = { text: front, lang: langA, label: labelA || "Termo" };
  const sideB = { text: back, lang: langB, label: labelB || "Definição" };
  const { promptSide: firstSide, answerSide: secondSide, isAFirst } = resolveStudySides(sideA, sideB, direction, flashcardId || front);

  const firstSideImage = isAFirst ? imageUrlA : imageUrlB;
  const secondSideImage = isAFirst ? imageUrlB : imageUrlA;
  const firstSideHints = isAFirst ? wordHintsA : wordHintsB;
  const secondSideHints = isAFirst ? wordHintsB : wordHintsA;
  const firstSideMergedHints = isAFirst ? mergedHintsA : mergedHintsB;
  const secondSideMergedHints = isAFirst ? mergedHintsB : mergedHintsA;
  const firstSideLang = toBCP47(firstSide.lang);
  const secondSideLang = toBCP47(secondSide.lang);

  const fixedSideToRenderedSide = useCallback((side: FlipAutoPlaySide): RenderedSide => {
    if (side === "a") return isAFirst ? "first" : "second";
    return isAFirst ? "second" : "first";
  }, [isAFirst]);

  const clearAutoPlayTimeout = useCallback(() => {
    if (!autoPlayTimeoutRef.current) return;
    clearTimeout(autoPlayTimeoutRef.current);
    autoPlayTimeoutRef.current = null;
  }, []);

  const speakSide = useCallback((side: FlipAutoPlaySide) => {
    const rate = getSpeechRate();
    const fixedSide = side === "a" ? sideA : sideB;
    if (!fastMode) setIsFlipped(fixedSideToRenderedSide(side) === "second");
    if (ttsEnabled) speak(fixedSide.text, { langOverride: toBCP47(fixedSide.lang), rate });
    else stop();
  }, [fastMode, fixedSideToRenderedSide, sideA.text, sideA.lang, sideB.text, sideB.lang, speak, stop, ttsEnabled]);

  const handlePlayTop = () => speakSide(isAFirst ? "a" : "b");
  const handlePlayBottom = () => speakSide(isAFirst ? "b" : "a");

  const handleFlip = () => {
    if (fastMode) return;
    setIsFlipped((value) => !value);
  };

  const handleCardClick = () => {
    if (swipeConsumedRef.current) {
      swipeConsumedRef.current = false;
      return;
    }
    handleFlip();
  };

  const handleKnew = () => {
    playCorrect();
    onKnew();
  };

  const handleDidntKnow = () => {
    playWrong();
    onDidntKnow();
  };

  const handleToggleAutoPlay = () => {
    const next = !isAutoPlaying;
    setIsAutoPlaying(next);
    writeFlipAutoPlayState(next, autoPlaySide);
    if (next) {
      setAutoPlayCurrentSide(autoPlaySide);
      if (!fastMode) setIsFlipped(fixedSideToRenderedSide(autoPlaySide) === "second");
    } else {
      clearAutoPlayTimeout();
      stop();
    }
  };

  const handleAutoPlaySideChange = (side: FlipAutoPlaySide) => {
    setAutoPlaySide(side);
    setAutoPlayCurrentSide(side);
    writeFlipAutoPlayState(isAutoPlaying, side);
    if (!fastMode) setIsFlipped(fixedSideToRenderedSide(side) === "second");
  };

  const onCardTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    swipeConsumedRef.current = false;
  };

  const onCardTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const elapsed = Date.now() - start.t;
    if (Math.abs(dx) < 60 || Math.abs(dy) > 80 || elapsed > 800) return;
    swipeConsumedRef.current = true;
    if (dx < 0) {
      if (onNext && canGoNext) onNext();
    } else if (onPrevious && canGoPrevious) {
      onPrevious();
    }
  };

  useEffect(() => {
    setAutoPlayCurrentSide(autoPlaySide);
    setIsFlipped(isAutoPlaying && fixedSideToRenderedSide(autoPlaySide) === "second");
  }, [front, back, isAutoPlaying, autoPlaySide, fixedSideToRenderedSide]);

  useEffect(() => {
    writeFlipAutoPlayState(isAutoPlaying, autoPlaySide);
  }, [isAutoPlaying, autoPlaySide]);

  useEffect(() => {
    if (!isAutoPlaying) {
      clearAutoPlayTimeout();
      return;
    }

    clearAutoPlayTimeout();
    speakSide(autoPlayCurrentSide);

    autoPlayTimeoutRef.current = setTimeout(() => {
      if (autoPlayCurrentSide === autoPlaySide) {
        setAutoPlayCurrentSide(oppositeAutoPlaySide(autoPlaySide));
        return;
      }

      writeFlipAutoPlayState(true, autoPlaySide);
      if (onNext && canGoNext) {
        onNext();
        return;
      }
      setIsAutoPlaying(false);
      writeFlipAutoPlayState(false, autoPlaySide);
      stop();
    }, AUTO_PLAY_DELAY_MS);

    return clearAutoPlayTimeout;
  }, [autoPlayCurrentSide, autoPlaySide, canGoNext, clearAutoPlayTimeout, flashcardId, front, back, isAutoPlaying, onNext, speakSide, stop]);

  useEffect(() => () => clearAutoPlayTimeout(), [clearAutoPlayTimeout]);

  const shortcuts = useShortcutMap();
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const k = normalizeKey(e.key);
      const flipKey = normalizeKey(shortcuts.flip);
      const knewKey = normalizeKey(shortcuts.knew);
      const didntKey = normalizeKey(shortcuts.didntKnow);
      const audioKey = normalizeKey(shortcuts.playAudio);
      const nextKey = normalizeKey(shortcuts.nextCard);
      const prevKey = normalizeKey(shortcuts.prevCard);

      if (k === flipKey) {
        e.preventDefault();
        if (fastMode) handleKnew();
        else if (!isFlipped) handleFlip();
        else handleKnew();
        return;
      }
      if (k === knewKey) {
        e.preventDefault();
        handleKnew();
        return;
      }
      if (k === didntKey) {
        e.preventDefault();
        handleDidntKnow();
        return;
      }
      if (k === audioKey && ttsEnabled) {
        e.preventDefault();
        if (fastMode || !isFlipped) handlePlayTop();
        else handlePlayBottom();
        return;
      }
      if (k === nextKey && onNext && canGoNext) {
        e.preventDefault();
        onNext();
        return;
      }
      if (k === prevKey && onPrevious && canGoPrevious) {
        e.preventDefault();
        onPrevious();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcuts, isFlipped, fastMode, onNext, onPrevious, canGoNext, canGoPrevious, ttsEnabled]);

  const autoPlayControls = (
    <div className="flip-autoplay-controls w-full rounded-xl border bg-card/80 p-2 shadow-sm sm:rounded-2xl sm:p-3" data-no-card-swipe="true">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <Button
          type="button"
          variant={isAutoPlaying ? "secondary" : "default"}
          size="sm"
          onClick={handleToggleAutoPlay}
          className="h-10 w-full font-semibold sm:h-11 sm:w-auto sm:min-w-[132px]"
          aria-pressed={isAutoPlaying}
        >
          {isAutoPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
          {isAutoPlaying ? "Pausar" : "Play"}
        </Button>
        <div className="grid w-full grid-cols-2 gap-1.5 sm:w-auto sm:min-w-[260px] sm:gap-2" data-autoplay-side-options="true">
          <Button
            type="button"
            variant={autoPlaySide === "a" ? "default" : "outline"}
            size="sm"
            onClick={() => handleAutoPlaySideChange("a")}
            className="h-9 min-w-0 px-2 text-[11px] sm:h-10 sm:text-sm"
          >
            <span className="truncate">Começar em {sideA.label}</span>
          </Button>
          <Button
            type="button"
            variant={autoPlaySide === "b" ? "default" : "outline"}
            size="sm"
            onClick={() => handleAutoPlaySideChange("b")}
            className="h-9 min-w-0 px-2 text-[11px] sm:h-10 sm:text-sm"
          >
            <span className="truncate">Começar em {sideB.label}</span>
          </Button>
        </div>
      </div>
    </div>
  );

  const toolsButton = (
    <StudyToolsMenu
      hint={hint}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      isRedListed={isRedListed}
      onToggleRedList={onToggleRedList}
      isSpecial={isSpecial}
      onToggleSpecial={onToggleSpecial}
    />
  );

  const actionButtons = (
    <div className="flip-action-buttons flex w-full flex-row flex-wrap justify-center gap-2 sm:gap-3">
      <Button variant="destructive" size="lg" onClick={handleDidntKnow} className="min-w-[120px] flex-1 text-sm sm:min-w-[140px] sm:text-base">
        <RotateCcw className="mr-2 h-5 w-5" />
        Não Sabia
      </Button>
      <Button variant="default" size="lg" onClick={handleKnew} className="min-w-[120px] flex-1 text-sm sm:min-w-[140px] sm:text-base">
        <Check className="mr-2 h-5 w-5" />
        Sabia
      </Button>
    </div>
  );

  const navigationButtons = (
    <div className="flip-navigation-buttons flex items-center justify-center gap-5 sm:gap-8">
      <Button variant="ghost" size="icon" onClick={onPrevious} disabled={!canGoPrevious} className="h-10 w-10 sm:h-12 sm:w-12" title="Card anterior (←)">
        <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onNext} disabled={!canGoNext} className="h-10 w-10 sm:h-12 sm:w-12" title="Próximo card (→)">
        <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>
    </div>
  );

  if (fastMode) {
    return (
      <div className="flip-study-mobile-compact mx-auto flex w-full max-w-2xl flex-col items-center gap-3 sm:gap-4">
        {autoPlayControls}
        <Card className={cn("relative w-full overflow-hidden", getRedListCardClass(isRedListed))}>
          <div className="absolute right-2 top-2 z-10">{toolsButton}</div>
          <div className="border-b border-border">
            <SidePanel side={firstSide} imageUrl={firstSideImage} wordHints={firstSideHints} mergedHints={firstSideMergedHints} speakLang={firstSideLang} ttsEnabled={ttsEnabled} onPlay={handlePlayTop} compact />
          </div>
          <SidePanel side={secondSide} imageUrl={secondSideImage} wordHints={secondSideHints} mergedHints={secondSideMergedHints} speakLang={secondSideLang} ttsEnabled={ttsEnabled} onPlay={handlePlayBottom} compact accent />
        </Card>
        {navigationButtons}
        {actionButtons}
        <p className="hidden text-center text-xs text-muted-foreground sm:block">← → navegar • Espaço avançar • Enter ouvir áudio</p>
      </div>
    );
  }

  return (
    <div className="flip-study-mobile-compact mx-auto flex w-full max-w-2xl flex-col items-center gap-3 sm:gap-6">
      {autoPlayControls}
      <div
        className={cn("flip-card relative h-60 w-full cursor-pointer sm:h-80", getRedListCardClass(isRedListed) && "rounded-xl " + getRedListCardClass(isRedListed))}
        onClick={handleCardClick}
        onTouchStart={onCardTouchStart}
        onTouchEnd={onCardTouchEnd}
        style={{ touchAction: "pan-y" }}
      >
        <div className="absolute right-2 top-2 z-20" onClick={(e) => e.stopPropagation()}>{toolsButton}</div>
        <div className={`flip-card-inner ${isFlipped ? "flipped" : ""}`}>
          <div className="flip-card-front">
            <Card className="h-full w-full overflow-hidden">
              <SidePanel side={firstSide} imageUrl={firstSideImage} wordHints={firstSideHints} mergedHints={firstSideMergedHints} speakLang={firstSideLang} ttsEnabled={ttsEnabled} onPlay={handlePlayTop} showRevealHint />
            </Card>
          </div>
          <div className="flip-card-back">
            <Card className="h-full w-full overflow-hidden">
              <SidePanel side={secondSide} imageUrl={secondSideImage} wordHints={secondSideHints} mergedHints={secondSideMergedHints} speakLang={secondSideLang} ttsEnabled={ttsEnabled} onPlay={handlePlayBottom} accent />
            </Card>
          </div>
        </div>
      </div>
      {navigationButtons}
      {isFlipped && <div className="w-full animate-fade-in">{actionButtons}</div>}
      <p className="hidden text-center text-xs text-muted-foreground sm:block">← → navegar • Espaço virar/confirmar • Enter ouvir áudio</p>
    </div>
  );
};
