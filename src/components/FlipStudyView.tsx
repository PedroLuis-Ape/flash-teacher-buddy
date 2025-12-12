import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Volume2, ChevronLeft, ChevronRight, Check, Star } from "lucide-react";
import { useTTS } from "@/hooks/useTTS";
import { SpeechRateControl, getSpeechRate } from "./SpeechRateControl";
import { HintButton } from "./HintButton";
import { awardPoints, REWARD_AMOUNTS } from "@/lib/rewardEngine";
import { supabase } from "@/integrations/supabase/client";
import { useToggleFavorite, useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";
import { playCorrect, playWrong, playNext } from "@/lib/sfx";

interface FlipStudyViewProps {
  front: string;
  back: string;
  hint?: string | null;
  flashcardId?: string;
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
  flashcardId,
  onKnew,
  onDidntKnow,
  onNext,
  onPrevious,
  canGoPrevious = true,
  canGoNext = true,
  direction,
}: FlipStudyViewProps) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [userId, setUserId] = useState<string | undefined>();
  const { speak } = useTTS();
  const toggleFavorite = useToggleFavorite();
  const { data: favorites = [] } = useFavorites(userId);
  
  const isFavorite = flashcardId ? favorites.includes(flashcardId) : false;

  // Fetch user ID for favorites
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
    };
    fetchUser();
  }, []);
  
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

  const handleToggleFavorite = () => {
    if (!flashcardId || !userId) return;
    toggleFavorite.mutate({ flashcardId, isFavorite });
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

  const handleFlip = () => {
    const newFlippedState = !isFlipped;
    setIsFlipped(newFlippedState);
    
    const rate = getSpeechRate();
    
    // Play audio for the side being revealed
    if (newFlippedState) {
      // Revealing back side (translation/answer)
      const langOverride = direction === "pt-en" ? "en-US" : "pt-BR";
      speak(hideText, { langOverride, rate });
    } else {
      // Revealing front side (question)
      const langOverride = direction === "pt-en" ? "pt-BR" : "en-US";
      speak(showText, { langOverride, rate });
    }
  };

  const handlePlayAgain = () => {
    // Play audio for the revealed side with correct language
    const langOverride = direction === "pt-en" ? "en-US" : "pt-BR";
    const rate = getSpeechRate();
    speak(hideText, { langOverride, rate });
  };

  const handlePlayFront = () => {
    // Play audio for the front side with correct language
    const langOverride = direction === "pt-en" ? "pt-BR" : "en-US";
    const rate = getSpeechRate();
    speak(showText, { langOverride, rate });
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
        <div className="flex items-center gap-2">
          {/* Favorite button in-game */}
          {userId && flashcardId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleFavorite}
              disabled={toggleFavorite.isPending}
              className={cn(
                "transition-colors",
                isFavorite ? "text-yellow-500 hover:text-yellow-600" : "text-muted-foreground hover:text-yellow-500"
              )}
              title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            >
              <Star className={cn("h-5 w-5", isFavorite && "fill-current")} />
            </Button>
          )}
          <SpeechRateControl />
        </div>
      </div>
      
      {/* Flip card - can be flipped infinitely */}
      <div
        className="flip-card w-full h-80 cursor-pointer"
        onClick={handleFlip}
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
        Use ← → para navegar • Espaço para virar/confirmar
      </p>
    </div>
  );
};
