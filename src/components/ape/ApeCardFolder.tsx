import { Lock } from "lucide-react";
import { ScrollingTitle } from "@/components/ui/scrolling-title";
import { cn } from "@/lib/utils";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { prefetchFolderRouteChunks } from "@/lib/routeChunkPrefetch";

interface ApeCardFolderProps {
  title: string;
  referenceId?: string | null;
  listCount?: number;
  cardCount?: number;
  emoji?: string | null;
  isLocked?: boolean;
  onClick?: () => void;
  className?: string;
  disableAnimation?: boolean;
}

export function ApeCardFolder({
  title,
  referenceId,
  listCount,
  cardCount,
  emoji,
  isLocked = false,
  onClick,
  className,
  disableAnimation = false,
}: ApeCardFolderProps) {
  const revealRef = useScrollReveal<HTMLButtonElement>({ disabled: disableAnimation });

  return (
    <button
      ref={disableAnimation ? undefined : revealRef}
      onClick={onClick}
      onPointerEnter={prefetchFolderRouteChunks}
      onFocus={prefetchFolderRouteChunks}
      onTouchStart={prefetchFolderRouteChunks}
      disabled={isLocked}
      className={cn(
        "space-ui-folder-card group card-3d ape-card-row rounded-2xl",
        "bg-card ape-interactive-card",
        "border border-border text-left shadow-sm",
        "active:scale-[0.98] active:shadow-sm active:translate-y-0",
        !disableAnimation && "scroll-reveal",
        disableAnimation && "opacity-100 translate-y-0",
        isLocked && "opacity-50 cursor-not-allowed md:hover:translate-y-0 md:hover:shadow-sm",
        className,
      )}
    >
      <div data-motion-icon="folder" className="space-ui-card-icon relative shrink-0 w-12 h-12 rounded-xl border border-primary/20 bg-primary/15 flex items-center justify-center shadow-sm transition-colors duration-200 group-hover:bg-primary/25">
        <span aria-hidden className="absolute inset-1 rounded-full border border-primary/15" />
        {isLocked ? (
          <Lock className="relative h-5 w-5 text-primary transition-transform group-hover:scale-110" />
        ) : (
          <span aria-hidden className="relative text-2xl leading-none transition-transform group-hover:scale-110">
            {emoji?.trim() || "📁"}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <ScrollingTitle text={title} className="ape-card-title" />
        {referenceId && <span className="mt-1 block truncate font-mono text-[10px] text-muted-foreground/80">{referenceId}</span>}
        {(listCount !== undefined || cardCount !== undefined) && (
          <p className="text-xs text-muted-foreground leading-tight mt-1 truncate">
            {[
              listCount !== undefined && `${listCount} ${listCount === 1 ? "lista" : "listas"}`,
              cardCount !== undefined && `${cardCount} ${cardCount === 1 ? "card" : "cards"}`,
            ].filter(Boolean).join(" • ")}
          </p>
        )}
      </div>
    </button>
  );
}
