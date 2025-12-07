import React from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Eye, Star, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface GameControlsProps {
  onNext: () => void;
  onPrev: () => void;
  onReveal?: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onPlayAudio?: () => void;
  canNext: boolean;
  canPrev: boolean;
  isRevealed?: boolean;
  showRevealButton?: boolean;
  favoriteDisabled?: boolean;
}

export const GameControls: React.FC<GameControlsProps> = ({
  onNext, 
  onPrev, 
  onReveal, 
  isFavorite, 
  onToggleFavorite, 
  onPlayAudio, 
  canNext, 
  canPrev, 
  isRevealed = false,
  showRevealButton = false,
  favoriteDisabled = false
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t z-40 pb-safe">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Previous Button */}
        <Button 
          variant="outline" 
          size="icon" 
          onClick={onPrev} 
          disabled={!canPrev} 
          className="h-12 w-12 shrink-0"
          title="Anterior"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        {/* Center Controls */}
        <div className="flex gap-2 justify-center flex-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onToggleFavorite}
            disabled={favoriteDisabled}
            className={cn(
              "h-12 w-12 transition-colors",
              isFavorite ? "text-yellow-500 hover:text-yellow-600" : "text-muted-foreground hover:text-yellow-500"
            )}
            title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          >
            <Star className={cn("h-6 w-6", isFavorite && "fill-current")} />
          </Button>

          {onPlayAudio && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onPlayAudio} 
              className="h-12 w-12 text-primary hover:text-primary/80"
              title="Ouvir áudio"
            >
              <Volume2 className="h-6 w-6" />
            </Button>
          )}
          
          {showRevealButton && onReveal && !isRevealed && (
            <Button 
              onClick={onReveal} 
              className="px-4 sm:px-6 h-12"
              title="Revelar resposta"
            >
              <Eye className="mr-2 h-5 w-5" /> 
              <span className="hidden sm:inline">Ver</span>
            </Button>
          )}
        </div>

        {/* Next Button */}
        <Button 
          onClick={onNext} 
          disabled={!canNext} 
          className="h-12 w-12 shrink-0" 
          variant={isRevealed ? "default" : "secondary"}
          title="Próximo"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
};
