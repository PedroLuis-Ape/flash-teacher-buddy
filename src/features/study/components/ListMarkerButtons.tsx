import { CircleAlert, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ListMarkerButtonsProps {
  isFavorite: boolean;
  isAttention: boolean;
  onToggleFavorite: () => void;
  onToggleAttention: () => void;
}

export function ListMarkerButtons({
  isFavorite,
  isAttention,
  onToggleFavorite,
  onToggleAttention,
}: ListMarkerButtonsProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${
                isFavorite
                  ? "text-yellow-500 hover:text-yellow-500"
                  : "text-muted-foreground hover:bg-yellow-500/10 hover:text-yellow-500"
              }`}
              onClick={(event) => {
                event.stopPropagation();
                onToggleFavorite();
              }}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? "Remover lista dos favoritos" : "Marcar lista como favorita"}
            >
              <Star className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isFavorite ? "Remover dos favoritos" : "Favoritar e manter no topo"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${
                isAttention
                  ? "bg-red-500/15 text-red-500 hover:bg-red-500/20 hover:text-red-500"
                  : "text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
              }`}
              onClick={(event) => {
                event.stopPropagation();
                onToggleAttention();
              }}
              aria-pressed={isAttention}
              aria-label={isAttention ? "Remover marca de atenção" : "Marcar lista para prestar atenção"}
            >
              <CircleAlert className={`h-4 w-4 ${isAttention ? "fill-red-500/15" : ""}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isAttention ? "Remover marca de dificuldade" : "Marcar como conteúdo difícil"}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
