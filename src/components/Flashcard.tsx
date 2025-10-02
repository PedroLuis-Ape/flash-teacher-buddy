import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FlashcardProps {
  front: string;
  back: string;
  className?: string;
}

export const Flashcard = ({ front, back, className }: FlashcardProps) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div 
      className={cn("flip-card w-full h-64 cursor-pointer", className)}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div className={cn("flip-card-inner", isFlipped && "flipped")}>
        <div className="flip-card-front">
          <Card className="w-full h-full flex items-center justify-center p-8 bg-gradient-to-br from-card to-muted/20 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-hover)] transition-shadow duration-300">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Português</p>
              <p className="text-2xl font-semibold">{front}</p>
            </div>
          </Card>
        </div>
        <div className="flip-card-back">
          <Card className="w-full h-full flex items-center justify-center p-8 bg-gradient-to-br from-primary/10 to-accent/10 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-hover)] transition-shadow duration-300">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">English</p>
              <p className="text-2xl font-semibold">{back}</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
