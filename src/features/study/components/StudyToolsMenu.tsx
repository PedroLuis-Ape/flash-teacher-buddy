import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Settings2, Star, Flame, Gem, Lightbulb, Gauge, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { HintModal } from "./HintModal";
import "./study-tools-menu.css";

/**
 * StudyToolsMenu — agrupa as ações secundárias do jogo (favorito, lista vermelha,
 * especial, dica, velocidade de áudio) em um único botão "Ferramentas".
 * Reduz a poluição visual mantendo as ações principais (responder, áudio,
 * navegar) visíveis no card.
 *
 * Importante: este componente NÃO altera a lógica dos botões — apenas concentra
 * a UI. Cada toggle continua chamando os mesmos callbacks já validados.
 */

const SPEECH_RATE_KEY = "speechRate";

function readRate(): number {
  if (typeof window === "undefined") return 1;
  return Number(localStorage.getItem(SPEECH_RATE_KEY) || "1");
}

interface StudyToolsMenuProps {
  hint?: string | null;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  isRedListed?: boolean;
  onToggleRedList?: () => void;
  isSpecial?: boolean;
  onToggleSpecial?: () => void;
  favoritePending?: boolean;
  redListPending?: boolean;
  specialPending?: boolean;
  hasDetailedExplanation?: boolean;
  onShowDetailedExplanation?: () => void;
  className?: string;
}

export function StudyToolsMenu({
  hint,
  isFavorite,
  onToggleFavorite,
  isRedListed,
  onToggleRedList,
  isSpecial,
  onToggleSpecial,
  favoritePending,
  redListPending,
  specialPending,
  hasDetailedExplanation,
  onShowDetailedExplanation,
  className,
}: StudyToolsMenuProps) {
  const [showHint, setShowHint] = useState(false);
  const [rate, setRate] = useState<number>(() => readRate());

  // Sync external changes to localStorage rate (other components may toggle it).
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      if (typeof detail === "number") setRate(detail);
    };
    window.addEventListener("speechRateChanged", handler as EventListener);
    return () => window.removeEventListener("speechRateChanged", handler as EventListener);
  }, []);

  const toggleRate = () => {
    const next = rate === 1 ? 0.5 : 1;
    setRate(next);
    localStorage.setItem(SPEECH_RATE_KEY, String(next));
    window.dispatchEvent(new CustomEvent("speechRateChanged", { detail: next }));
  };

  const hasHint = !!hint && hint.trim().length > 0;
  const anyActive = !!isFavorite || !!isRedListed || !!isSpecial;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "study-tools-floating-trigger h-8 gap-1.5 px-2.5 shrink-0",
              anyActive && "border-primary/60",
              className,
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            title="Ferramentas"
            aria-label="Ferramentas"
          >
            <Settings2 className="h-4 w-4" />
            <span className="text-xs font-medium hidden sm:inline">Ferramentas</span>
            {anyActive && (
              <span
                aria-hidden
                className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary"
              />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuLabel>Ferramentas</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {onToggleFavorite && (
            <DropdownMenuItem
              disabled={favoritePending}
              onSelect={(e) => {
                e.preventDefault();
                if (favoritePending) return;
                onToggleFavorite();
              }}
            >
              {favoritePending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Star
                className={cn(
                  "mr-2 h-4 w-4",
                  isFavorite ? "text-yellow-500 fill-current" : "text-muted-foreground",
                )}
                />
              )}
              {isFavorite ? "Remover dos favoritos" : "Favoritar"}
            </DropdownMenuItem>
          )}

          {onToggleRedList && (
            <DropdownMenuItem
              disabled={redListPending || !isFavorite}
              onSelect={(e) => {
                e.preventDefault();
                if (redListPending || !isFavorite) return;
                onToggleRedList();
              }}
              title={!isFavorite ? "Favorite o card primeiro para usar a Lista Vermelha" : undefined}
            >
              {redListPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Flame
                className={cn(
                  "mr-2 h-4 w-4",
                  isRedListed ? "text-red-500 fill-current" : "text-muted-foreground",
                )}
                />
              )}
              {!isFavorite
                ? "Lista Vermelha — favorite primeiro"
                : isRedListed ? "Sair da Lista Vermelha" : "Lista Vermelha"}
            </DropdownMenuItem>
          )}

          {onToggleSpecial && (
            <DropdownMenuItem
              disabled={specialPending}
              onSelect={(e) => {
                e.preventDefault();
                if (specialPending) return;
                onToggleSpecial();
              }}
            >
              {specialPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Gem
                className={cn(
                  "mr-2 h-4 w-4",
                  isSpecial ? "text-sky-500 fill-current" : "text-muted-foreground",
                )}
                />
              )}
              {isSpecial ? "Remover dos especiais" : "Salvar como especial"}
            </DropdownMenuItem>
          )}

          {(onToggleFavorite || onToggleSpecial) && <DropdownMenuSeparator />}

          {hasDetailedExplanation && onShowDetailedExplanation && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onShowDetailedExplanation();
              }}
            >
              <Sparkles className="mr-2 h-4 w-4 text-sky-500" />
              Ver explicação detalhada
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            disabled={!hasHint}
            onSelect={(e) => {
              e.preventDefault();
              if (hasHint) setShowHint(true);
            }}
          >
            <Lightbulb
              className={cn(
                "mr-2 h-4 w-4",
                hasHint ? "text-warning" : "text-muted-foreground",
              )}
            />
            {hasHint ? "Ver dica" : "Sem dica"}
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              toggleRate();
            }}
          >
            <Gauge className="mr-2 h-4 w-4" />
            Velocidade: {rate === 1 ? "Normal (1x)" : "Lenta (0.5x)"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <HintModal hint={hint} isOpen={showHint} onClose={() => setShowHint(false)} />
    </>
  );
}
