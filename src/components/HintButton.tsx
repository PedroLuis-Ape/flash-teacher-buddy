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

  if (!hint) return null;

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowHint(!showHint)}
        className="h-8 w-8 p-0 rounded-full hover:bg-warning/20"
        title="Ver dica"
      >
        <Lightbulb className="h-4 w-4 text-warning" />
      </Button>
      
      {showHint && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowHint(false)}
          />
          <Card className="absolute right-0 top-10 z-50 p-4 max-w-xs sm:max-w-sm shadow-lg border-warning/30 bg-warning/5 animate-fade-in">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground leading-relaxed">{hint}</p>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
