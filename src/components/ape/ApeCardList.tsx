import { Play } from "lucide-react";
import { ScrollingTitle } from "@/components/ui/scrolling-title";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { prefetchListRouteChunks, prefetchStudyRouteChunks } from "@/lib/routeChunkPrefetch";

interface ApeCardListProps {
  title: string;
  subtitle?: string;
  cardCount?: number;
  language?: string;
  badge?: string;
  onClick?: () => void;
  onPlayClick?: () => void;
  className?: string;
  /** Disable scroll reveal animation for performance in large lists */
  disableAnimation?: boolean;
}

export function ApeCardList({
  title,
  subtitle,
  cardCount,
  language,
  badge,
  onClick,
  onPlayClick,
  className,
  disableAnimation = false,
}: ApeCardListProps) {
  const revealRef = useScrollReveal<HTMLDivElement>({ disabled: disableAnimation });

  return (
    <div
      ref={disableAnimation ? undefined : revealRef}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onPointerEnter={prefetchListRouteChunks}
      onFocus={prefetchListRouteChunks}
      onTouchStart={prefetchListRouteChunks}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "space-ui-list-card group card-3d ape-card-row rounded-2xl cursor-pointer select-none",
        "bg-card ape-interactive-card",
        "border border-border",
        "text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "md:hover:bg-primary/5",
        "active:scale-[0.98] active:shadow-sm active:translate-y-0",
        !disableAnimation && "scroll-reveal",
        disableAnimation && "opacity-100 translate-y-0",
        className,
      )}
    >
      <div data-motion-icon="card" className="space-ui-card-icon relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-secondary/25 bg-secondary/20 shadow-sm transition-colors duration-200 group-hover:bg-secondary/30 sm:h-12 sm:w-12">
        <span aria-hidden className="text-xl leading-none transition-transform group-hover:scale-110 sm:text-2xl">
          {"\u{1F3AE}"}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <ScrollingTitle text={title} className="ape-card-title min-w-0 flex-1" />
          {badge && (
            <Badge
              variant="secondary"
              title={badge}
              className="space-ui-card-badge hidden max-w-[9rem] shrink truncate text-xs md:inline-flex"
            >
              {badge}
            </Badge>
          )}
        </div>
        {(subtitle || cardCount !== undefined || language || badge) && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {[
              subtitle,
              cardCount !== undefined && `${cardCount} ${cardCount === 1 ? "card" : "cards"}`,
              language,
              badge,
            ].filter(Boolean).join(" • ")}
          </p>
        )}
      </div>

      {onPlayClick && (
        <Button
          variant="ghost"
          size="icon"
          className="space-ui-play-button h-9 w-9 shrink-0 rounded-xl hover:bg-primary/10 hover:text-primary sm:h-10 sm:w-10"
          onPointerEnter={prefetchStudyRouteChunks}
          onFocus={prefetchStudyRouteChunks}
          onTouchStart={prefetchStudyRouteChunks}
          onClick={(event) => {
            event.stopPropagation();
            onPlayClick();
          }}
          aria-label={`Estudar ${title}`}
        >
          <Play className="h-4 w-4 fill-current" />
        </Button>
      )}
    </div>
  );
}
