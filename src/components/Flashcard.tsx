import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { HintButton } from "@/components/HintButton";

interface FlashcardProps {
  term: string;
  translation: string;
  hint?: string | null;
  className?: string;
}

export const Flashcard = ({ term, translation, hint, className }: FlashcardProps) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div 
      className={cn("flip-card w-full h-64 cursor-pointer", className)}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div className={cn("flip-card-inner", isFlipped && "flipped")}>
        <div className="flip-card-front">
          <Card className="w-full h-full flex items-center justify-center p-8 bg-gradient-to-br from-card to-muted/20 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-hover)] transition-shadow duration-300 relative">
            <HintButton hint={hint} className="absolute top-4 right-4" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Português</p>
              <p className="text-2xl font-semibold">{term}</p>
            </div>
          </Card>
        </div>
        <div className="flip-card-back">
          <Card className="w-full h-full flex items-center justify-center p-8 bg-gradient-to-br from-primary/10 to-accent/10 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-hover)] transition-shadow duration-300 relative">
            <HintButton hint={hint} className="absolute top-4 right-4" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">English</p>
              <p className="text-2xl font-semibold">{translation}</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
