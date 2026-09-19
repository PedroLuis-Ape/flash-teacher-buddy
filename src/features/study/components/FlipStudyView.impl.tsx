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
import {
  getNextFlipAutoPlayStep,
  readFlipAutoPlayState,
  writeFlipAutoPlayState,
  type FlipAutoPlaySide,
} from "@/features/study/lib/flipAutoPlayState";
import { setPlayPresetRuntime } from "@/features/study/lib/playPresetRuntime";
import type { StudyPlayTargetPreset } from "@/features/study/preferences/studyPreset";
import { getSpeechRate } from "./SpeechRateControl";
import { StudyToolsMenu } from "./StudyToolsMenu";
import { ImageCard } from "./ImageCard";
import { InteractiveText } from "./InteractiveText";
import { getRedListCardClass } from "./RedListIndicator";
import { StudyReviewFlagButton } from "./StudyReviewFlagButton";
import type { MergedHint } from "@/features/study/lib/glossaryMerge";
import "./flipStudyMobileCompact.css";

/**
 * Autoplay é EVENT-DRIVEN: a duração da fala vem do `onend` real do TTS
 * (`useTTS` resolve a promessa com geração/token própria). Estes valores são
 * apenas pausa de UI entre passos e o tempo de leitura quando NÃO há fala
 * (TTS desligado, sem suporte ou texto vazio). Nunca são relógio da fala.
 */
const AUTO_PLAY_UI_GAP_MS = 600;
const AUTO_PLAY_SILENT_READ_MS = 3000;
/** Failsafe: só usado se a promessa de fala nunca resolver. */
const AUTO_PLAY_FAILSAFE_MS = 20000;

const MOUSE_DRAG_THRESHOLD_PX = 6;

type ManualFlipAnswer = "knew" | "didntKnow" | null;

function hasActiveTextSelection(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.getSelection()?.toString().trim());
}

type ResolvedSide = { text: string; lang: string; label: string };
type RenderedSide = "first" | "second";

interface SidePanelProps {
  side: ResolvedSide;
  glossarySide: "A" | "B";
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
  glossarySide,
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
            side={glossarySide}
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
  /**
   * CONTRATO DE AVALIAÇÃO DO FLIP (P1 2026-09-15):
   * - `mastery_rounds` (Gamificado): Sabia/Não Sabia existem e governam o avanço;
   * - `continuous` (Extenso): NÃO existe julgamento. Nada de Sabia/Não Sabia na
   *   tela nem no teclado; navegação livre para frente e para trás.
   */
  studyFlowMode?: "continuous" | "mastery_rounds";
  /** Alvo semântico do Play: both | prompt | answer (nunca lado físico). */
  playTarget?: StudyPlayTargetPreset;
  /** Fala o lado visível ao trocar de card (sem clique no DOM, sem delay). */
  autoSpeakOnCardChange?: boolean;
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
  /** “Revisar cards”: QA de conteúdo do flashcard — domínio separado do Ponto de atenção. */
  isReviewFlagged?: boolean;
  reviewFlagPending?: boolean;
  onToggleReviewFlag?: () => void;
  isDifficult?: boolean;
  onToggleDifficulty?: () => void;
  difficultyPending?: boolean;
  layerCount?: number;
  layersVisitedCount?: number;
  onOpenLayers?: () => void;
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
  studyFlowMode = "mastery_rounds",
  playTarget = "both",
  autoSpeakOnCardChange = false,
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
  isReviewFlagged = false,
  reviewFlagPending = false,
  onToggleReviewFlag,
  isDifficult = false,
  onToggleDifficulty,
  difficultyPending = false,
}: FlipStudyViewProps) => {
  // Único dono da decisão "existe avaliação neste Flip?".
  const assessmentEnabled = studyFlowMode === "mastery_rounds";
  const restoredAutoPlay = useRef(readFlipAutoPlayState());
  const [isFlipped, setIsFlipped] = useState(false);
  const [manualAnswer, setManualAnswer] = useState<ManualFlipAnswer>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(restoredAutoPlay.current.enabled);
  const [autoPlayCurrentSide, setAutoPlayCurrentSide] = useState<FlipAutoPlaySide>(restoredAutoPlay.current.side);
  const autoPlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const swipeConsumedRef = useRef(false);
  const mouseDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextCardClickRef = useRef(false);
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

  // O Play é SEMÂNTICO: `prompt`/`answer` seguem o que o resolver canônico
  // decidiu para este card. Nada aqui escolhe lado físico A/B por conta própria.
  const playModeEffective: "both" | "single" = playTarget === "both" ? "both" : "single";
  const playFixedSide: FlipAutoPlaySide = playTarget === "answer"
    ? (isAFirst ? "b" : "a")
    : (isAFirst ? "a" : "b");

  const fixedSideToRenderedSide = useCallback((side: FlipAutoPlaySide): RenderedSide => {
    if (side === "a") return isAFirst ? "first" : "second";
    return isAFirst ? "second" : "first";
  }, [isAFirst]);

  const clearAutoPlayTimeout = useCallback(() => {
    if (!autoPlayTimeoutRef.current) return;
    clearTimeout(autoPlayTimeoutRef.current);
    autoPlayTimeoutRef.current = null;
  }, []);

  const pauseAutoPlay = useCallback(() => {
    if (!isAutoPlaying) return;
    setIsAutoPlaying(false);
    writeFlipAutoPlayState(false, playFixedSide);
    clearAutoPlayTimeout();
    stop();
  }, [clearAutoPlayTimeout, isAutoPlaying, playFixedSide, stop]);

  const speakSide = useCallback((side: FlipAutoPlaySide) => {
    const rate = getSpeechRate();
    const fixedText = side === "a" ? sideA.text : sideB.text;
    const fixedLang = side === "a" ? sideA.lang : sideB.lang;
    if (!fastMode || (isAutoPlaying && playModeEffective === "single")) {
      setIsFlipped(fixedSideToRenderedSide(side) === "second");
    }
    if (!ttsEnabled) {
      stop();
      return Promise.resolve(null);
    }
    return speak(fixedText, { langOverride: toBCP47(fixedLang), rate });
  }, [fastMode, fixedSideToRenderedSide, isAutoPlaying, playModeEffective, sideA.text, sideA.lang, sideB.text, sideB.lang, speak, stop, ttsEnabled]);


  const handlePlayTop = () => {
    pauseAutoPlay();
    speakSide(isAFirst ? "a" : "b");
  };

  const handlePlayBottom = () => {
    pauseAutoPlay();
    speakSide(isAFirst ? "b" : "a");
  };

  const handleFlip = () => {
    pauseAutoPlay();
    if (fastMode) return;
    setIsFlipped((value) => !value);
  };

  const handleCardMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    mouseDragStartRef.current = { x: event.clientX, y: event.clientY };
    suppressNextCardClickRef.current = false;
  };

  const handleCardMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    const start = mouseDragStartRef.current;
    mouseDragStartRef.current = null;
    if (!start) return;

    const dx = Math.abs(event.clientX - start.x);
    const dy = Math.abs(event.clientY - start.y);
    if (dx > MOUSE_DRAG_THRESHOLD_PX || dy > MOUSE_DRAG_THRESHOLD_PX || hasActiveTextSelection()) {
      suppressNextCardClickRef.current = true;
    }
  };

  const handleCardMouseLeave = () => {
    if (mouseDragStartRef.current) suppressNextCardClickRef.current = true;
    mouseDragStartRef.current = null;
  };

  const handleCardClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement | null)?.closest("button, a, input, textarea, select, [role='button'], [contenteditable='true']")) return;

    if (swipeConsumedRef.current) {
      swipeConsumedRef.current = false;
      return;
    }

    if (suppressNextCardClickRef.current || hasActiveTextSelection()) {
      suppressNextCardClickRef.current = false;
      return;
    }

    handleFlip();
  };

  const handleKnew = () => {
    if (!assessmentEnabled) return;
    pauseAutoPlay();
    playCorrect();
    setManualAnswer("knew");
    onKnew();
  };

  const handleDidntKnow = () => {
    if (!assessmentEnabled) return;
    pauseAutoPlay();
    playWrong();
    setManualAnswer("didntKnow");
    onDidntKnow();
  };

  const handleToggleAutoPlay = () => {
    const next = !isAutoPlaying;
    setIsAutoPlaying(next);
    writeFlipAutoPlayState(next, playFixedSide);
    if (next) {
      setAutoPlayCurrentSide(playFixedSide);
      setIsFlipped(fixedSideToRenderedSide(playFixedSide) === "second");
    } else {
      clearAutoPlayTimeout();
      stop();
    }
  };

  const handleNextCard = () => {
    pauseAutoPlay();
    if (onNext && canGoNext) onNext();
  };

  const handlePreviousCard = () => {
    pauseAutoPlay();
    if (onPrevious && canGoPrevious) onPrevious();
  };

  const handleToolInteraction = (action?: () => void) => {
    pauseAutoPlay();
    action?.();
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
    // DONO ÚNICO DE SWIPE: a navegação por gesto pertence ao StudyCardDeck.
    // Aqui apenas evitamos que o gesto vire o card e pausamos o áudio, para
    // que um único swipe nunca produza duas navegações.
    swipeConsumedRef.current = true;
    pauseAutoPlay();
  };

  useEffect(() => {
    setPlayPresetRuntime({ labelA: sideA.label, labelB: sideB.label });
  }, [sideA.label, sideB.label]);

  useEffect(() => {
    setAutoPlayCurrentSide(playFixedSide);
    setIsFlipped(isAutoPlaying && fixedSideToRenderedSide(playFixedSide) === "second");
    setManualAnswer(null);
  }, [front, back, flashcardId, isAutoPlaying, playModeEffective, playFixedSide, fixedSideToRenderedSide]);

  useEffect(() => {
    writeFlipAutoPlayState(isAutoPlaying, playFixedSide);
  }, [isAutoPlaying, playFixedSide]);

  // Áudio ao trocar de card: chamada direta ao contrato de TTS, sem procurar
  // botão no DOM e sem espera artificial. O autoplay contínuo tem prioridade.
  const autoSpokenCardRef = useRef<string | null>(null);
  useEffect(() => {
    const cardKey = flashcardId || `${front}:${back}`;
    if (autoSpokenCardRef.current === cardKey) return;
    autoSpokenCardRef.current = cardKey;
    if (!autoSpeakOnCardChange || !ttsEnabled || isAutoPlaying) return;
    speakSide(isAFirst ? "a" : "b");
  }, [autoSpeakOnCardChange, back, flashcardId, front, isAFirst, isAutoPlaying, speakSide, ttsEnabled]);

  // Passo do autoplay: fala -> onend REAL -> pausa curta de UI -> próximo passo.
  // Uma geração por passo garante que uma fala antiga não avance nem cancele
  // um passo iniciado depois.
  const autoPlayGenerationRef = useRef(0);
  useEffect(() => {
    autoPlayGenerationRef.current += 1;
    const generation = autoPlayGenerationRef.current;
    clearAutoPlayTimeout();
    if (!isAutoPlaying) return;

    const advance = () => {
      if (autoPlayGenerationRef.current !== generation) return;
      const step = getNextFlipAutoPlayStep({
        mode: playModeEffective,
        configuredSide: playFixedSide,
        currentSide: autoPlayCurrentSide,
      });

      if (step.action === "switch") {
        setAutoPlayCurrentSide(step.side);
        return;
      }

      writeFlipAutoPlayState(true, playFixedSide);
      if (onNext && canGoNext) {
        onNext();
        return;
      }
      setIsAutoPlaying(false);
      writeFlipAutoPlayState(false, playFixedSide);
      stop();
    };

    const scheduleAdvance = (delay: number) => {
      if (autoPlayGenerationRef.current !== generation) return;
      clearAutoPlayTimeout();
      autoPlayTimeoutRef.current = setTimeout(advance, delay);
    };

    // Failsafe: nunca é o relógio da fala, só protege contra promessa pendente.
    autoPlayTimeoutRef.current = setTimeout(advance, AUTO_PLAY_FAILSAFE_MS);

    void Promise.resolve(speakSide(autoPlayCurrentSide)).then((result) => {
      if (autoPlayGenerationRef.current !== generation) return;
      // Fala cancelada por troca de card/pausa: quem cancelou decide o próximo
      // passo, este passo apenas encerra.
      if (result && result.reason === "cancelled") return;
      const spoke = Boolean(result && result.reason === "completed" && result.startedAt !== null);
      scheduleAdvance(spoke ? AUTO_PLAY_UI_GAP_MS : AUTO_PLAY_SILENT_READ_MS);
    });

    return () => {
      autoPlayGenerationRef.current += 1;
      clearAutoPlayTimeout();
    };
  }, [autoPlayCurrentSide, canGoNext, clearAutoPlayTimeout, flashcardId, front, back, isAutoPlaying, onNext, playModeEffective, playFixedSide, speakSide, stop]);


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

      if (k === flipKey) {
        e.preventDefault();
        // Extenso: virar o card NUNCA marca "sabia".
        if (!assessmentEnabled) {
          handleFlip();
          return;
        }
        if (fastMode) handleKnew();
        else if (!isFlipped) handleFlip();
        else handleKnew();
        return;
      }
      if (k === knewKey) {
        if (!assessmentEnabled) return;
        e.preventDefault();
        handleKnew();
        return;
      }
      if (k === didntKey) {
        if (!assessmentEnabled) return;
        e.preventDefault();
        handleDidntKnow();
        return;
      }
      if (k === audioKey && ttsEnabled) {
        e.preventDefault();
        if (fastMode || !isFlipped) handlePlayTop();
        else handlePlayBottom();
      }
      // DONO ÚNICO DE next/prev: o roteador global de teclado em Study.tsx.
      // Um segundo dono aqui produzia duas navegações pela mesma seta.
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcuts, isFlipped, fastMode, assessmentEnabled, ttsEnabled]);

  const autoPlayControls = (
    <div className="flip-autoplay-controls w-full rounded-xl border bg-card/80 p-2 shadow-sm sm:rounded-2xl sm:p-3" data-no-card-swipe="true">
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
    </div>
  );

  const toolsButton = (
    <StudyToolsMenu
      hint={hint}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite ? () => handleToolInteraction(onToggleFavorite) : undefined}
      isRedListed={isRedListed}
      onToggleRedList={onToggleRedList ? () => handleToolInteraction(onToggleRedList) : undefined}
      isSpecial={isSpecial}
      onToggleSpecial={onToggleSpecial ? () => handleToolInteraction(onToggleSpecial) : undefined}
      isDifficult={isDifficult}
      onToggleDifficulty={onToggleDifficulty ? () => handleToolInteraction(onToggleDifficulty) : undefined}
      difficultyPending={difficultyPending}
    />
  );

  const actionButtons = !assessmentEnabled ? null : (
    <div className="flip-action-buttons flex w-full flex-row flex-wrap justify-center gap-2 sm:gap-3">
      <Button
        variant="destructive"
        size="lg"
        onClick={handleDidntKnow}
        className={cn(
          "min-w-[120px] flex-1 text-sm sm:min-w-[140px] sm:text-base",
          manualAnswer === "didntKnow" && "ring-2 ring-destructive/70 ring-offset-2 ring-offset-background",
        )}
        aria-pressed={manualAnswer === "didntKnow"}
      >
        <RotateCcw className="mr-2 h-5 w-5" />
        Não Sabia
      </Button>
      <Button
        variant="default"
        size="lg"
        onClick={handleKnew}
        className={cn(
          "min-w-[120px] flex-1 text-sm sm:min-w-[140px] sm:text-base",
          manualAnswer === "knew" && "ring-2 ring-primary/70 ring-offset-2 ring-offset-background",
        )}
        aria-pressed={manualAnswer === "knew"}
      >
        <Check className="mr-2 h-5 w-5" />
        Sabia
      </Button>
    </div>
  );

  const navigationButtons = (
    <div className="flip-navigation-buttons flex items-center justify-center gap-5 sm:gap-8">
      <Button variant="ghost" size="icon" onClick={handlePreviousCard} disabled={!canGoPrevious} className="h-10 w-10 sm:h-12 sm:w-12" title="Card anterior (←)">
        <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>
      <Button variant="ghost" size="icon" onClick={handleNextCard} disabled={!canGoNext} className="h-10 w-10 sm:h-12 sm:w-12" title="Próximo card (→)">
        <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>
    </div>
  );

  if (fastMode) {
    const singleSidePlay = isAutoPlaying && playModeEffective === "single";
    const selectedSide = playFixedSide === "a" ? sideA : sideB;
    const selectedImage = playFixedSide === "a" ? imageUrlA : imageUrlB;
    const selectedHints = playFixedSide === "a" ? wordHintsA : wordHintsB;
    const selectedMergedHints = playFixedSide === "a" ? mergedHintsA : mergedHintsB;
    const selectedLang = toBCP47(selectedSide.lang);

    return (
      <div className="flip-study-mobile-compact mx-auto flex w-full max-w-2xl flex-col items-center gap-3 sm:gap-4">
        {autoPlayControls}
        <Card className={cn("relative w-full overflow-hidden", getRedListCardClass(isRedListed))}>
          {onToggleReviewFlag && (
            <StudyReviewFlagButton
              isFlagged={isReviewFlagged}
              isPending={reviewFlagPending}
              onToggle={onToggleReviewFlag}
              className="right-14 top-2"
            />
          )}
          <div className="absolute right-2 top-2 z-10">{toolsButton}</div>
          {singleSidePlay ? (
            <SidePanel
              side={selectedSide}
              glossarySide={playFixedSide === "a" ? "A" : "B"}
              imageUrl={selectedImage}
              wordHints={selectedHints}
              mergedHints={selectedMergedHints}
              speakLang={selectedLang}
              ttsEnabled={ttsEnabled}
              onPlay={() => speakSide(playFixedSide)}
              compact
            />
          ) : (
            <>
              <div className="border-b border-border">
                <SidePanel side={firstSide} glossarySide={isAFirst ? "A" : "B"} imageUrl={firstSideImage} wordHints={firstSideHints} mergedHints={firstSideMergedHints} speakLang={firstSideLang} ttsEnabled={ttsEnabled} onPlay={handlePlayTop} compact />
              </div>
                <SidePanel side={secondSide} glossarySide={isAFirst ? "B" : "A"} imageUrl={secondSideImage} wordHints={secondSideHints} mergedHints={secondSideMergedHints} speakLang={secondSideLang} ttsEnabled={ttsEnabled} onPlay={handlePlayBottom} compact accent />
            </>
          )}
        </Card>
        {navigationButtons}
        {actionButtons}
        <p className="hidden text-center text-xs text-muted-foreground sm:block">
          {assessmentEnabled ? "← → navegar • Espaço marcar como sabia • Enter ouvir áudio" : "← → navegar • Enter ouvir áudio"}
        </p>
      </div>
    );
  }

  return (
    <div className="flip-study-mobile-compact mx-auto flex w-full max-w-2xl flex-col items-center gap-3 sm:gap-6">
      {autoPlayControls}
      <div
        className={cn("flip-card relative h-60 w-full cursor-pointer sm:h-80", getRedListCardClass(isRedListed) && "rounded-xl " + getRedListCardClass(isRedListed))}
        onClick={handleCardClick}
        onMouseDown={handleCardMouseDown}
        onMouseUp={handleCardMouseUp}
        onMouseLeave={handleCardMouseLeave}
        onTouchStart={onCardTouchStart}
        onTouchEnd={onCardTouchEnd}
        style={{ touchAction: "pan-y" }}
      >
        <div className="absolute right-2 top-2 z-20" onClick={(e) => e.stopPropagation()}>{toolsButton}</div>
        <div className={`flip-card-inner ${isFlipped ? "flipped" : ""}`}>
          <div className="flip-card-front">
            <Card className="h-full w-full overflow-hidden">
              <SidePanel side={firstSide} glossarySide={isAFirst ? "A" : "B"} imageUrl={firstSideImage} wordHints={firstSideHints} mergedHints={firstSideMergedHints} speakLang={firstSideLang} ttsEnabled={ttsEnabled} onPlay={handlePlayTop} showRevealHint />
            </Card>
          </div>
          <div className="flip-card-back">
            <Card className="h-full w-full overflow-hidden">
              <SidePanel side={secondSide} glossarySide={isAFirst ? "B" : "A"} imageUrl={secondSideImage} wordHints={secondSideHints} mergedHints={secondSideMergedHints} speakLang={secondSideLang} ttsEnabled={ttsEnabled} onPlay={handlePlayBottom} accent />
            </Card>
          </div>
        </div>
      </div>
      {navigationButtons}
      {actionButtons && <div className="w-full animate-fade-in">{actionButtons}</div>}
      <p className="hidden text-center text-xs text-muted-foreground sm:block">
        {assessmentEnabled ? "← → navegar • Espaço virar/marcar • Enter ouvir áudio" : "← → navegar • Espaço virar o card • Enter ouvir áudio"}
      </p>
    </div>
  );
};
