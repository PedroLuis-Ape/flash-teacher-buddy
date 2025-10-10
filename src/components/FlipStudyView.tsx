import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface FlipStudyViewProps {
  front: string;
  back: string;
  onKnew: () => void;
  onDidntKnow: () => void;
  direction: "pt-en" | "en-pt" | "any";
}

export const FlipStudyView = ({
  front,
  back,
  onKnew,
  onDidntKnow,
  direction,
}: FlipStudyViewProps) => {
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    setIsFlipped(false);
  }, [front, back]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === " " && !isFlipped) {
        e.preventDefault();
        setIsFlipped(true);
      } else if (e.key === " " && isFlipped) {
        e.preventDefault();
        onKnew();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isFlipped, onKnew]);

  const showText = direction === "pt-en" || direction === "any" ? front : back;
  const hideText = direction === "pt-en" || direction === "any" ? back : front;
  const showLabel = direction === "pt-en" || direction === "any" ? "Português" : "English";
  const hideLabel = direction === "pt-en" || direction === "any" ? "English" : "Português";

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto">
      <div
        className="flip-card w-full h-80 cursor-pointer"
        onClick={() => !isFlipped && setIsFlipped(true)}
      >
        <div className={`flip-card-inner ${isFlipped ? "flipped" : ""}`}>
          <div className="flip-card-front">
            <Card className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-card to-muted/20">
              <p className="text-sm text-muted-foreground mb-4">{showLabel}</p>
              <p className="text-3xl font-semibold text-center">{showText}</p>
              <p className="text-sm text-muted-foreground mt-8">
                Pressione Espaço ou clique para revelar
              </p>
            </Card>
          </div>
          <div className="flip-card-back">
            <Card className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-primary/10 to-accent/10">
              <p className="text-sm text-muted-foreground mb-4">{hideLabel}</p>
              <p className="text-3xl font-semibold text-center">{hideText}</p>
            </Card>
          </div>
        </div>
      </div>

      {isFlipped && (
        <div className="flex gap-4 animate-fade-in">
          <Button variant="destructive" size="lg" onClick={onDidntKnow}>
            <RotateCcw className="mr-2 h-5 w-5" />
            Não Sabia
          </Button>
          <Button variant="default" size="lg" onClick={onKnew}>
            Sabia
          </Button>
        </div>
      )}
    </div>
  );
};
