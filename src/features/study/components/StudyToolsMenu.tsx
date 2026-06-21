import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
import { Flame, Gauge, Gem, Lightbulb, Loader2, Settings2, Sparkles, Star } from "lucide-react";
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

function stopCardInteraction(event: React.SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function InlineToolButton({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "outline"}
      size="sm"
      disabled={disabled}
      className={cn(
        "study-tools-inline-button h-9 min-w-9 gap-1.5 px-2.5",
        active && "border-primary/60 bg-primary/10 text-primary",
      )}
      title={label}
      aria-label={label}
      onPointerDown={stopCardInteraction}
      onClick={(event) => {
        stopCardInteraction(event);
        if (!disabled) onClick?.();
      }}
    >
      {icon}
      <span className="hidden 2xl:inline text-xs">{label}</span>
    </Button>
  );
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
    window.speechSynthesis?.cancel();
    const next = rate === 1 ? 0.5 : 1;
    setRate(next);
    localStorage.setItem(SPEECH_RATE_KEY, String(next));
    window.dispatchEvent(new CustomEvent("speechRateChanged", { detail: next }));
  };

  const hasHint = !!hint && hint.trim().length > 0;
  const anyActive = !!isFavorite || !!isRedListed || !!isSpecial;
  const rateLabel = rate === 1
    ? "Velocidade da fala: normal (1x)"
    : "Velocidade da fala: palavra por palavra (0.5x)";

  const mobileMenu = (
    <div className="flex items-center gap-2 md:hidden">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="study-tools-inline-button h-9 min-w-[4.25rem] gap-1.5 px-2.5"
        title={rateLabel}
        aria-label={`${rateLabel}. Toque para alternar.`}
        onPointerDown={stopCardInteraction}
        onClick={(event) => {
          stopCardInteraction(event);
          toggleRate();
        }}
      >
        <Gauge className="h-4 w-4" />
        <span className="text-xs font-semibold">{rate === 1 ? "1x" : "0.5x"}</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "study-tools-floating-trigger h-9 w-10 px-0 shrink-0",
              anyActive && "border-primary/60",
              className,
            )}
            onClick={stopCardInteraction}
            title="Ferramentas do card"
            aria-label="Ferramentas do card"
          >
            <Settings2 className="h-4 w-4" />
            {anyActive && <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64" onClick={(event) => event.stopPropagation()}>
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
              {favoritePending
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Star className={cn("mr-2 h-4 w-4", isFavorite ? "fill-current text-yellow-500" : "text-muted-foreground")} />}
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
            >
              {redListPending
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Flame className={cn("mr-2 h-4 w-4", isRedListed ? "fill-current text-red-500" : "text-muted-foreground")} />}
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
              {specialPending
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Gem className={cn("mr-2 h-4 w-4", isSpecial ? "fill-current text-sky-500" : "text-muted-foreground")} />}
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
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const desktopTools = (
    <div className={cn("study-tools-desktop-actions hidden md:flex items-center justify-end gap-1.5", className)}>
      {onToggleFavorite && (
        <InlineToolButton
          label={isFavorite ? "Remover favorito" : "Favoritar"}
          active={isFavorite}
          disabled={favoritePending}
          onClick={onToggleFavorite}
          icon={favoritePending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Star className={cn("h-4 w-4", isFavorite && "fill-current text-yellow-500")} />}
        />
      )}
      {onToggleRedList && (
        <InlineToolButton
          label={!isFavorite ? "Favorite primeiro" : isRedListed ? "Sair da Lista Vermelha" : "Lista Vermelha"}
          active={isRedListed}
          disabled={redListPending || !isFavorite}
          onClick={onToggleRedList}
          icon={redListPending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Flame className={cn("h-4 w-4", isRedListed && "fill-current text-red-500")} />}
        />
      )}
      {onToggleSpecial && (
        <InlineToolButton
          label={isSpecial ? "Remover especial" : "Salvar como especial"}
          active={isSpecial}
          disabled={specialPending}
          onClick={onToggleSpecial}
          icon={specialPending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Gem className={cn("h-4 w-4", isSpecial && "fill-current text-sky-500")} />}
        />
      )}
      {hasDetailedExplanation && onShowDetailedExplanation && (
        <InlineToolButton
          label="Explicação detalhada"
          onClick={onShowDetailedExplanation}
          icon={<Sparkles className="h-4 w-4 text-sky-500" />}
        />
      )}
      <InlineToolButton
        label={hasHint ? "Ver dica" : "Sem dica"}
        disabled={!hasHint}
        onClick={() => setShowHint(true)}
        icon={<Lightbulb className={cn("h-4 w-4", hasHint ? "text-warning" : "text-muted-foreground")} />}
      />
      <InlineToolButton
        label={rate === 1 ? "Velocidade normal" : "Velocidade lenta"}
        onClick={toggleRate}
        icon={
          <span className="inline-flex items-center gap-1 text-xs font-semibold">
            <Gauge className="h-4 w-4" />
            {rate === 1 ? "1x" : "0.5x"}
          </span>
        }
      />
    </div>
  );

  return (
    <>
      <span ref={anchorRef} className="study-tools-anchor-placeholder" aria-hidden="true" />
      {portalHost ? createPortal(<>{mobileMenu}{desktopTools}</>, portalHost) : null}
      <HintModal hint={hint} isOpen={showHint} onClose={() => setShowHint(false)} />
    </>
  );
}
