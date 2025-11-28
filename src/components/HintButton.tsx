import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface HintButtonProps {
  hint?: string | null;
  className?: string;
}

export const HintButton = ({ hint, className = "" }: HintButtonProps) => {
  const [showHint, setShowHint] = useState(false);

  const hasHint = hint && hint.trim().length > 0;
  const displayText = hasHint ? hint : "Nenhuma dica disponível para este card.";

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowHint(!showHint)}
        className={`h-8 w-8 p-0 rounded-full ${hasHint ? 'hover:bg-warning/20' : 'hover:bg-muted'}`}
        title="Ver dica"
      >
        <Lightbulb className={`h-4 w-4 ${hasHint ? 'text-warning' : 'text-muted-foreground'}`} />
      </Button>
      
      {showHint && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/20" 
            onClick={() => setShowHint(false)}
          />
          <Card className={`absolute right-0 top-10 z-50 p-4 max-w-xs sm:max-w-sm shadow-lg ${hasHint ? 'border-warning/30 bg-warning/5' : 'border-muted bg-muted/5'} animate-fade-in`}>
            <div className="flex items-start gap-2">
              <Lightbulb className={`h-4 w-4 flex-shrink-0 mt-0.5 ${hasHint ? 'text-warning' : 'text-muted-foreground'}`} />
              <p className="text-sm text-foreground leading-relaxed">{displayText}</p>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
