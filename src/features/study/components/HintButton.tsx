import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HintModal } from "./HintModal";

interface HintButtonProps {
  hint?: string | null;
  className?: string;
}

export const HintButton = ({ hint, className = "" }: HintButtonProps) => {
  const [showHint, setShowHint] = useState(false);

  const hasHint = hint && hint.trim().length > 0;

  return (
    <div className={className}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowHint(true)}
        className={`h-8 w-8 p-0 rounded-full ${hasHint ? 'hover:bg-warning/20' : 'hover:bg-muted'}`}
        title="Ver dica"
      >
        <Lightbulb className={`h-4 w-4 ${hasHint ? 'text-warning' : 'text-muted-foreground'}`} />
      </Button>
      
      <HintModal
        hint={hint}
        isOpen={showHint}
        onClose={() => setShowHint(false)}
      />
    </div>
  );
};
