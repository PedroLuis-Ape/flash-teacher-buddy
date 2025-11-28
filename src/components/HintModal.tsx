import { Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface HintModalProps {
  hint?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const HintModal = ({ hint, isOpen, onClose }: HintModalProps) => {
  if (!isOpen) return null;

  const hasHint = hint && hint.trim().length > 0;
  const displayText = hasHint ? hint : "Nenhuma dica disponível para este card.";

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card 
        className={`relative max-w-md w-full p-6 animate-fade-in ${hasHint ? 'border-warning/50' : 'border-muted'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-8 w-8 p-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
        
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full ${hasHint ? 'bg-warning/20' : 'bg-muted'}`}>
            <Lightbulb className={`h-5 w-5 ${hasHint ? 'text-warning' : 'text-muted-foreground'}`} />
          </div>
          <div className="flex-1 pt-1">
            <h3 className={`font-semibold mb-2 ${hasHint ? 'text-warning' : 'text-muted-foreground'}`}>
              {hasHint ? 'Dica' : 'Sem dica'}
            </h3>
            <p className="text-foreground leading-relaxed max-h-[300px] overflow-y-auto">
              {displayText}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
