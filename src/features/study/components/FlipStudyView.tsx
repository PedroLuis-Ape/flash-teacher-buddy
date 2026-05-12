import { useState, useEffect } from "react";
import { useShortcutMap } from "@/hooks/useKeyboardShortcuts";
import { normalizeKey, isTypingTarget } from "@/features/study/lib/keyboardShortcuts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Volume2, ChevronLeft, ChevronRight, Check, Star } from "lucide-react";
import { useTTS } from "@/features/study/hooks/useTTS";
import { resolveStudySides, toBCP47 } from "@/features/study/lib/resolveStudySides";
import { SpeechRateControl, getSpeechRate } from "./SpeechRateControl";
import { HintButton } from "./HintButton";
import { awardPoints, REWARD_AMOUNTS } from "@/lib/rewardEngine";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { playCorrect, playWrong } from "@/lib/sfx";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ImageCard } from "./ImageCard";
import { InteractiveText } from "./InteractiveText";
import type { MergedHint } from "@/features/study/lib/glossaryMerge";
import { RedListIndicator, getRedListCardClass } from "./RedListIndicator";

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
}: FlipStudyViewProps) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const { speak } = useTTS();
  
  const handleKnew = async () => {
    playCorrect();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await awardPoints(session.user.id, REWARD_AMOUNTS.CORRECT_ANSWER, 'flashcard_correct');
    }
    onKnew();
  };

  const handleDidntKnow = () => {
    playWrong();
    onDidntKnow();
  };

  // --- Centralized Side Resolution ---
  const sideA = { text: front, lang: langA, label: labelA || "Termo" };
  const sideB = { text: back, lang: langB, label: labelB || "Definição" };
  const { promptSide: firstSide, answerSide: secondSide, isAFirst } = resolveStudySides(sideA, sideB, direction, flashcardId || front);

  // Resolve images and word hints based on which side is prompt vs answer
  const firstSideImage = isAFirst ? imageUrlA : imageUrlB;
  const secondSideImage = isAFirst ? imageUrlB : imageUrlA;
  const firstSideHints = isAFirst ? wordHintsA : wordHintsB;
  const secondSideHints = isAFirst ? wordHintsB : wordHintsA;
  const firstSideMergedHints = isAFirst ? mergedHintsA : mergedHintsB;
  const secondSideMergedHints = isAFirst ? mergedHintsB : mergedHintsA;

  const firstSideLang = toBCP47(firstSide.lang);
  const secondSideLang = toBCP47(secondSide.lang);

  // Reset flip state when card changes
  useEffect(() => {
    setIsFlipped(false);
  }, [front, back]);

  const handleFlip = () => {
    if (fastMode) return; // No flip in fast mode
    setIsFlipped(!isFlipped);
  };

  const handlePlayTop = () => {
    const rate = getSpeechRate();
    speak(firstSide.text, { langOverride: firstSideLang, rate });
  };

  const handlePlayBottom = () => {
    const rate = getSpeechRate();
    speak(secondSide.text, { langOverride: secondSideLang, rate });
  };

  // Reactive shortcut map — updates immediately when user remaps in settings.
  const shortcuts = useShortcutMap();

  // Keyboard navigation — keys are now configurable via the settings page.
  // Defaults preserve previous behavior (Space=flip/confirm, Enter=audio,
  // ArrowLeft/Right=prev/next), so existing users see no change.
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

      if (fastMode) {
        // Fast mode shows both sides; the flip key advances as "knew".
        if (k === flipKey) {
          e.preventDefault();
          handleKnew();
          return;
        }
      } else {
        if (k === flipKey) {
          e.preventDefault();
          if (!isFlipped) handleFlip();
          else handleKnew();
          return;
        }
      }

      if (k === knewKey) {
        e.preventDefault();
        handleKnew();
        return;
      }
      if (k === didntKey) {
        e.preventDefault();
        handleDidntKnow?.();
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
        return;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcuts, isFlipped, fastMode, onNext, onPrevious, canGoNext, canGoPrevious, ttsEnabled]);

  // Fast Mode UI - two stacked panels
  if (fastMode) {
    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-2xl mx-auto">
        {/* Controls row */}
        <div className="w-full flex justify-between items-center mb-2">
          <HintButton hint={hint} />
          <div className="flex items-center gap-2">
            {onToggleFavorite && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleFavorite}
                className={cn(
                  "transition-colors",
                  isFavorite ? "text-yellow-500 hover:text-yellow-600" : "text-muted-foreground hover:text-yellow-500"
                )}
                title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              >
                <Star className={cn("h-5 w-5", isFavorite && "fill-current")} />
              </Button>
            )}
            <RedListIndicator isRedListed={isRedListed} isFavorite={isFavorite} onToggleRedList={onToggleRedList} size="sm" />
            <SpeechRateControl />
          </div>
        </div>

        {/* Fast Mode Card - Two panels stacked */}
        <Card className={cn("w-full overflow-hidden", getRedListCardClass(isRedListed))}>
          {/* Top panel (question/origin) */}
          <div className="border-b border-border bg-gradient-to-br from-card to-muted/20 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{firstSide.label}</p>
              {ttsEnabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePlayTop}
                  className="h-8 px-2"
                >
                  <Volume2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            {firstSideImage && (
              <ImageCard src={firstSideImage} alt={firstSide.text} className="mb-2" maxHeight="80px" />
            )}
            <ScrollArea className="max-h-24 sm:max-h-32">
              <p className="text-xl sm:text-2xl font-semibold text-center leading-relaxed" style={{ wordBreak: 'normal', overflowWrap: 'normal' }}>
                <InteractiveText text={firstSide.text} wordHints={firstSideHints} mergedHints={firstSideMergedHints} speakOnHintClick={ttsEnabled} speakLang={firstSideLang} />
              </p>
            </ScrollArea>
          </div>

          {/* Bottom panel (answer/destination) */}
          <div className="bg-gradient-to-br from-primary/5 to-accent/10 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{secondSide.label}</p>
              {ttsEnabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePlayBottom}
                  className="h-8 px-2"
                >
                  <Volume2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            {secondSideImage && (
              <ImageCard src={secondSideImage} alt={secondSide.text} className="mb-2" maxHeight="80px" />
            )}
            <ScrollArea className="max-h-24 sm:max-h-32">
              <p className="text-xl sm:text-2xl font-semibold text-center leading-relaxed text-primary" style={{ wordBreak: 'normal', overflowWrap: 'normal' }}>
                <InteractiveText text={secondSide.text} wordHints={secondSideHints} mergedHints={secondSideMergedHints} speakOnHintClick={ttsEnabled} speakLang={secondSideLang} />
              </p>
            </ScrollArea>
          </div>
        </Card>

        {/* Navigation arrows */}
        <div className="flex items-center justify-center gap-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrevious}
            disabled={!canGoPrevious}
            className="h-12 w-12"
            title="Card anterior (←)"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            disabled={!canGoNext}
            className="h-12 w-12"
            title="Próximo card (→)"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>

        {/* Action buttons - always visible in fast mode */}
        <div className="flex flex-row flex-wrap gap-3 justify-center w-full">
          <Button 
            variant="destructive" 
            size="lg" 
            onClick={handleDidntKnow}
            className="flex-1 min-w-[140px]"
          >
            <RotateCcw className="mr-2 h-5 w-5" />
            Não Sabia
          </Button>
          <Button 
            variant="default" 
            size="lg" 
            onClick={handleKnew}
            className="flex-1 min-w-[140px]"
          >
            <Check className="mr-2 h-5 w-5" />
            Sabia
          </Button>
        </div>
        
      {/* Instructions */}
      <p className="text-xs text-muted-foreground text-center">
        ← → navegar • Espaço avançar • Enter ouvir áudio
      </p>
      </div>
    );
  }

  // Normal Flip Mode UI
  return (
    <div className="flex flex-col items-center gap-4 sm:gap-6 w-full max-w-2xl mx-auto">
      {/* Controls row */}
      <div className="w-full flex justify-between items-center mb-2">
        <HintButton hint={hint} />
        <div className="flex items-center gap-2">
          {/* Favorite button in-game */}
          {onToggleFavorite && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleFavorite}
              className={cn(
                "transition-colors",
                isFavorite ? "text-yellow-500 hover:text-yellow-600" : "text-muted-foreground hover:text-yellow-500"
              )}
              title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            >
              <Star className={cn("h-5 w-5", isFavorite && "fill-current")} />
            </Button>
          )}
          <RedListIndicator isRedListed={isRedListed} isFavorite={isFavorite} onToggleRedList={onToggleRedList} size="sm" />
          <SpeechRateControl />
        </div>
      </div>
      
      {/* Flip card - can be flipped infinitely */}
      <div
        className={cn("flip-card w-full h-64 sm:h-80 cursor-pointer", getRedListCardClass(isRedListed) && "rounded-xl " + getRedListCardClass(isRedListed))}
        onClick={handleFlip}
      >
        <div className={`flip-card-inner ${isFlipped ? "flipped" : ""}`}>
          {/* Front side */}
          <div className="flip-card-front">
           <Card className="w-full h-full flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-card to-muted/20 overflow-auto">
              <p className="text-xs sm:text-sm text-muted-foreground mb-2">{firstSide.label}</p>
              {firstSideImage && (
                <ImageCard src={firstSideImage} alt={firstSide.text} className="mb-2 sm:mb-3" maxHeight="100px" />
              )}
              <p className="text-xl sm:text-3xl font-semibold text-center leading-relaxed px-2 sm:px-4" style={{ wordBreak: 'normal', overflowWrap: 'normal' }}>
                <InteractiveText text={firstSide.text} wordHints={firstSideHints} mergedHints={firstSideMergedHints} speakOnHintClick={ttsEnabled} speakLang={firstSideLang} />
              </p>
              {ttsEnabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayTop();
                  }}
                  className="mt-4"
                >
                  <Volume2 className="mr-2 h-4 w-4" />
                  Ouvir
                </Button>
              )}
              <p className="text-sm text-muted-foreground mt-4">
                Clique para revelar
              </p>
            </Card>
          </div>
          
          {/* Back side */}
          <div className="flip-card-back">
            <Card className="w-full h-full flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-primary/10 to-accent/10 overflow-auto">
              <p className="text-xs sm:text-sm text-muted-foreground mb-2">{secondSide.label}</p>
              {secondSideImage && (
                <ImageCard src={secondSideImage} alt={secondSide.text} className="mb-2 sm:mb-3" maxHeight="100px" />
              )}
              <p className="text-xl sm:text-3xl font-semibold text-center leading-relaxed px-2 sm:px-4" style={{ wordBreak: 'normal', overflowWrap: 'normal' }}>
                <InteractiveText text={secondSide.text} wordHints={secondSideHints} mergedHints={secondSideMergedHints} speakOnHintClick={ttsEnabled} speakLang={secondSideLang} />
              </p>
              {ttsEnabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayBottom();
                  }}
                  className="mt-4"
                >
                  <Volume2 className="mr-2 h-4 w-4" />
                  Ouvir novamente
                </Button>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Navigation arrows below card */}
      <div className="flex items-center justify-center gap-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className="h-12 w-12"
          title="Card anterior (←)"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          disabled={!canGoNext}
          className="h-12 w-12"
          title="Próximo card (→)"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      {/* Action buttons - only show after flip */}
      {isFlipped && (
        <div className="flex flex-row flex-wrap gap-3 justify-center w-full animate-fade-in">
          <Button 
            variant="destructive" 
            size="lg" 
            onClick={handleDidntKnow}
            className="flex-1 min-w-[140px]"
          >
            <RotateCcw className="mr-2 h-5 w-5" />
            Não Sabia
          </Button>
          <Button 
            variant="default" 
            size="lg" 
            onClick={handleKnew}
            className="flex-1 min-w-[140px]"
          >
            <Check className="mr-2 h-5 w-5" />
            Sabia
          </Button>
        </div>
      )}
      
      {/* Instructions */}
      <p className="text-xs text-muted-foreground text-center">
        ← → navegar • Espaço virar/confirmar • Enter ouvir áudio
      </p>
    </div>
  );
};
