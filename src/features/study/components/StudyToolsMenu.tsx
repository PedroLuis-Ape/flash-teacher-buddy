import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const modeRoot = anchor?.closest(".max-w-2xl");
    if (!modeRoot) return;

    const existing = modeRoot.querySelector<HTMLElement>("[data-study-tools-slot='true']");
    if (existing) {
      setPortalHost(existing);
      return;
    }

    const host = document.createElement("div");
    host.className = "study-tools-portal-slot";
    host.setAttribute("data-study-tools-slot", "true");
    modeRoot.insertBefore(host, modeRoot.firstChild);
    setPortalHost(host);

    return () => {
      setPortalHost(null);
      host.remove();
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<number>).detail;
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

  const trigger = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "study-tools-floating-trigger h-9 gap-1.5 px-3 shrink-0",
            anyActive && "border-primary/60",
            className,
          )}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          title="Ferramentas do card"
          aria-label="Ferramentas do card"
        >
          <Settings2 className="h-4 w-4" />
          <span className="text-xs font-medium hidden sm:inline">Ferramentas</span>
          {anyActive && (
            <span aria-hidden className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuLabel>Ferramentas</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {onToggleFavorite && (
          <DropdownMenuItem
            disabled={favoritePending}
            onSelect={(event) => {
              event.preventDefault();
              if (!favoritePending) onToggleFavorite();
            }}
          >
            {favoritePending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Star className={cn("mr-2 h-4 w-4", isFavorite ? "text-yellow-500 fill-current" : "text-muted-foreground")} />
            )}
            {isFavorite ? "Remover dos favoritos" : "Favoritar"}
          </DropdownMenuItem>
        )}

        {onToggleRedList && (
          <DropdownMenuItem
            disabled={redListPending || !isFavorite}
            onSelect={(event) => {
              event.preventDefault();
              if (!redListPending && isFavorite) onToggleRedList();
            }}
            title={!isFavorite ? "Favorite o card primeiro para usar a Lista Vermelha" : undefined}
          >
            {redListPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Flame className={cn("mr-2 h-4 w-4", isRedListed ? "text-red-500 fill-current" : "text-muted-foreground")} />
            )}
            {!isFavorite
              ? "Lista Vermelha — favorite primeiro"
              : isRedListed
                ? "Sair da Lista Vermelha"
                : "Lista Vermelha"}
          </DropdownMenuItem>
        )}

        {onToggleSpecial && (
          <DropdownMenuItem
            disabled={specialPending}
            onSelect={(event) => {
              event.preventDefault();
              if (!specialPending) onToggleSpecial();
            }}
          >
            {specialPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Gem className={cn("mr-2 h-4 w-4", isSpecial ? "text-sky-500 fill-current" : "text-muted-foreground")} />
            )}
            {isSpecial ? "Remover dos especiais" : "Salvar como especial"}
          </DropdownMenuItem>
        )}

        {(onToggleFavorite || onToggleSpecial) && <DropdownMenuSeparator />}

        {hasDetailedExplanation && onShowDetailedExplanation && (
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              onShowDetailedExplanation();
            }}
          >
            <Sparkles className="mr-2 h-4 w-4 text-sky-500" />
            Ver explicação detalhada
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          disabled={!hasHint}
          onSelect={(event) => {
            event.preventDefault();
            if (hasHint) setShowHint(true);
          }}
        >
          <Lightbulb className={cn("mr-2 h-4 w-4", hasHint ? "text-warning" : "text-muted-foreground")} />
          {hasHint ? "Ver dica" : "Sem dica"}
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            toggleRate();
          }}
        >
          <Gauge className="mr-2 h-4 w-4" />
          Velocidade: {rate === 1 ? "Normal (1x)" : "Lenta (0.5x)"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <span ref={anchorRef} className="study-tools-anchor-placeholder" aria-hidden="true" />
      {portalHost ? createPortal(trigger, portalHost) : null}
      <HintModal hint={hint} isOpen={showHint} onClose={() => setShowHint(false)} />
    </>
  );
}
