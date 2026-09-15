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
 * sessão. Pertence ao card atual: fica no canto superior direito da superfície
 * principal.
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

  return (
    <button
      type="button"
      data-review-flagged={isFlagged ? "true" : "false"}
      aria-pressed={isFlagged}
      aria-label={label}
      title={label}
      disabled={isPending}
      className={cn(
        "absolute right-2 top-2 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full",
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
}
