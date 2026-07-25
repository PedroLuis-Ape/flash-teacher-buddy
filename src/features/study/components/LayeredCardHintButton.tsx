import { Button } from "@/components/ui/button";
import { Layers, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LayeredCardHintButtonProps {
  layerCount: number;
  visitedCount?: number;
  onOpen: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Purple hint button that surfaces additional playable layers of the current
 * card. Hidden when the card has fewer than 2 playable layers. Never blocks
 * advance — it is a visual invitation, not a gate.
 */
export function LayeredCardHintButton({
  layerCount,
  visitedCount = 0,
  onOpen,
  disabled,
  className,
}: LayeredCardHintButtonProps) {
  if (layerCount < 2) return null;

  const allVisited = visitedCount >= layerCount;
  const remaining = Math.max(0, layerCount - visitedCount);

  return (
    <Button
      type="button"
      variant={allVisited ? "ghost" : "outline"}
      size="sm"
      onClick={onOpen}
      disabled={disabled}
      aria-label="Explorar camadas deste card"
      className={cn(
        "relative h-11 shrink-0 gap-1.5 border-primary/40 bg-primary/10 px-3 text-primary hover:bg-primary/15",
        !allVisited && "motion-safe:animate-pulse",
        allVisited && "border-transparent bg-transparent text-muted-foreground hover:bg-muted/40",
        className,
      )}
      data-perf-no-anim
    >
      <span className="relative inline-flex items-center">
        <Layers className="h-4 w-4" aria-hidden />
        {!allVisited && (
          <Sparkles
            className="pointer-events-none absolute -right-2 -top-2 h-3 w-3 text-primary/80"
            aria-hidden
          />
        )}
      </span>
      <span className="hidden text-xs font-medium sm:inline">
        {allVisited ? "Camadas vistas" : "Mais camadas"}
      </span>
      {!allVisited && (
        <span className="ml-0.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary">
          +{remaining}
        </span>
      )}
    </Button>
  );
}