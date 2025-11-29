import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Volume2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { pickLang } from "@/lib/speech";
import { useTTS } from "@/hooks/useTTS";
import { SpeechRateControl } from "./SpeechRateControl";
import { HintButton } from "./HintButton";
import { awardPoints, REWARD_AMOUNTS } from "@/lib/rewardEngine";
import { supabase } from "@/integrations/supabase/client";

interface FlipStudyViewProps {
  front: string;
  back: string;
  hint?: string | null;
  onKnew: () => void;
  onDidntKnow: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  direction: "pt-en" | "en-pt" | "any";
}

export const FlipStudyView = ({
  front,
  back,
  hint,
  onKnew,
  onDidntKnow,
  onNext,
  onPrevious,
  canGoPrevious = true,
  canGoNext = true,
  direction,
}: FlipStudyViewProps) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const { speak } = useTTS();
  
  const handleKnew = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await awardPoints(session.user.id, REWARD_AMOUNTS.CORRECT_ANSWER, 'flashcard_correct');
    }
    onKnew();
  };

  // Determine which text is shown first based on direction
  const showText = direction === "pt-en" ? front : back;
  const hideText = direction === "pt-en" ? back : front;
  const showLabel = direction === "pt-en" ? "Português" : "English";
  const hideLabel = direction === "pt-en" ? "English" : "Português";

  // Reset flip state when card changes
  useEffect(() => {
    setIsFlipped(false);
  }, [front, back]);

  const handleFlip = async () => {
    if (!isFlipped) {
      setIsFlipped(true);
      // Determine correct language for TTS based on what's being revealed
      const lang = direction === "pt-en" ? "en-US" : "pt-BR";
      await speak(hideText, lang);
    }
  };

  const handlePlayAgain = async () => {
    // Play audio for the revealed side with correct language
    const lang = direction === "pt-en" ? "en-US" : "pt-BR";
    await speak(hideText, lang);
  };

  const handlePlayFront = async () => {
    // Play audio for the front side with correct language
    const lang = direction === "pt-en" ? "pt-BR" : "en-US";
    await speak(showText, lang);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Space: flip or mark as known
      if (e.key === " " && !isFlipped) {
        e.preventDefault();
        handleFlip();
      } else if (e.key === " " && isFlipped) {
        e.preventDefault();
        handleKnew();
      }
      
      // Arrow keys for navigation
      if (e.key === "ArrowRight" && onNext && canGoNext) {
        e.preventDefault();
        onNext();
      }
      if (e.key === "ArrowLeft" && onPrevious && canGoPrevious) {
        e.preventDefault();
        onPrevious();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isFlipped, direction, hideText, onNext, onPrevious, canGoNext, canGoPrevious]);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto">
      {/* Controls row */}
      <div className="w-full flex justify-between items-center mb-2">
        <HintButton hint={hint} />
        <SpeechRateControl />
      </div>
      
      {/* Card container with navigation */}
      <div className="w-full flex items-center gap-2">
        {/* Previous button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className="shrink-0 h-12 w-12"
          title="Card anterior (←)"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        {/* Flip card */}
        <div
          className="flip-card flex-1 h-80 cursor-pointer"
          onClick={() => !isFlipped && handleFlip()}
        >
          <div className={`flip-card-inner ${isFlipped ? "flipped" : ""}`}>
            {/* Front side */}
            <div className="flip-card-front">
              <Card className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-card to-muted/20">
                <p className="text-sm text-muted-foreground mb-2">{showLabel}</p>
                <p className="text-2xl sm:text-3xl font-semibold text-center leading-relaxed px-4" style={{ wordBreak: 'normal', overflowWrap: 'normal' }}>
                  {showText}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayFront();
                  }}
                  className="mt-4"
                >
                  <Volume2 className="mr-2 h-4 w-4" />
                  Ouvir
                </Button>
                <p className="text-sm text-muted-foreground mt-4">
                  Clique para revelar
                </p>
              </Card>
            </div>
            
            {/* Back side */}
            <div className="flip-card-back">
              <Card className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-primary/10 to-accent/10">
                <p className="text-sm text-muted-foreground mb-2">{hideLabel}</p>
                <p className="text-2xl sm:text-3xl font-semibold text-center leading-relaxed px-4" style={{ wordBreak: 'normal', overflowWrap: 'normal' }}>
                  {hideText}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayAgain();
                  }}
                  className="mt-4"
                >
                  <Volume2 className="mr-2 h-4 w-4" />
                  Ouvir novamente
                </Button>
              </Card>
            </div>
          </div>
        </div>

        {/* Next button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          disabled={!canGoNext}
          className="shrink-0 h-12 w-12"
          title="Próximo card (→)"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      {/* Action buttons - only show after flip */}
      {isFlipped && (
        <div className="flex gap-4 animate-fade-in">
          <Button variant="destructive" size="lg" onClick={onDidntKnow}>
            <RotateCcw className="mr-2 h-5 w-5" />
            Não Sabia
          </Button>
          <Button variant="default" size="lg" onClick={handleKnew}>
            <Check className="mr-2 h-5 w-5" />
            Sabia
          </Button>
        </div>
      )}
      
      {/* Instructions */}
      <p className="text-xs text-muted-foreground text-center">
        Use ← → para navegar • Espaço para virar/confirmar
      </p>
    </div>
  );
};
