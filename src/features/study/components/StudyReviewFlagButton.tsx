import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudyReviewFlagButtonProps {
  isFlagged: boolean;
  isPending?: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * Marcador “vou olhar isso depois” — one click, sem modal e sem interromper a
 * sessão.
 *
 * O botão vive no rail compartilhado de ferramentas do modo de estudo em vez
 * de flutuar sobre o conteúdo do card. Isso evita colisões com TTS, texto e
 * outros controles em qualquer modo/tamanho de tela. Se um consumidor futuro
 * não montar o rail, o fallback continua em fluxo normal (nunca absoluto).
 *
 * O clique é isolado do deck/atividade de propósito: `type="button"`, parada de
 * propagação no pointer/touch/click e guarda de `isPending` (um clique = uma
 * mutation, zero ações de jogo).
 */
export function StudyReviewFlagButton({
  isFlagged,
  isPending = false,
  onToggle,
  className,
}: StudyReviewFlagButtonProps) {
  const label = isFlagged ? "Marcado para revisão" : "Marcar para revisar depois";
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [useInlineFallback, setUseInlineFallback] = useState(false);

  useEffect(() => {
    const anchor = anchorRef.current;
    const modeRoot = anchor?.closest(".max-w-2xl");
    const host = modeRoot?.querySelector<HTMLElement>("[data-study-tools-slot='true']") ?? null;

    if (host) {
      setPortalHost(host);
      setUseInlineFallback(false);
      return;
    }

    setPortalHost(null);
    setUseInlineFallback(true);
  }, []);

  const button = (
    <button
      type="button"
      data-review-flagged={isFlagged ? "true" : "false"}
      aria-pressed={isFlagged}
      aria-label={label}
      title={label}
      disabled={isPending}
      className={cn(
        "study-review-flag-toolbar-button inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
        "border border-transparent text-muted-foreground/70 transition-colors",
        "hover:bg-muted/60 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-progress disabled:opacity-60",
        isFlagged && "border-rose-500/40 bg-rose-500/15 text-rose-500 hover:text-rose-400",
        className,
      )}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onTouchStart={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (isPending) return;
        onToggle();
      }}
    >
      <Flag className={cn("h-4 w-4", isFlagged && "fill-current")} aria-hidden />
    </button>
  );

  return (
    <>
      <span ref={anchorRef} className="hidden" aria-hidden="true" />
      {portalHost ? createPortal(button, portalHost) : useInlineFallback ? button : null}
    </>
  );
}
