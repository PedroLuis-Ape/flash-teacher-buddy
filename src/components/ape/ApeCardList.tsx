import { FileText, Play, Sparkles } from "lucide-react";
import { ScrollingTitle } from "@/components/ui/scrolling-title";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/useScrollReveal";

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
  disableAnimation = false
}: ApeCardListProps) {
  const revealRef = useScrollReveal<HTMLDivElement>({ disabled: disableAnimation });

  return (
    <div
      ref={disableAnimation ? undefined : revealRef}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "space-ui-list-card group card-3d ape-card-row rounded-2xl cursor-pointer select-none",
        "bg-card transition-all duration-200",
        "border border-border",
        "text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "md:hover:shadow-md md:hover:border-primary/30 md:hover:bg-primary/5 md:hover:translate-y-[-2px]",
        "active:scale-[0.98] active:shadow-sm active:translate-y-0",
        !disableAnimation && "scroll-reveal",
        disableAnimation && "opacity-100 translate-y-0",
        className
      )}
    >
      <div className="space-ui-card-icon relative shrink-0 w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center transition-all duration-200 group-hover:bg-secondary/30 group-hover:scale-105">
        <Sparkles className="absolute -right-1 -top-1 h-3 w-3 text-primary-glow opacity-0 transition-opacity group-hover:opacity-100" />
        <FileText className="h-5 w-5 text-secondary-foreground transition-transform group-hover:scale-110" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <ScrollingTitle text={title} className="ape-card-title flex-1 min-w-0" />
          {badge && (
            <Badge variant="secondary" className="space-ui-card-badge text-xs shrink-0">
              {badge}
            </Badge>
          )}
        </div>
        {(subtitle || cardCount !== undefined || language) && (
          <p className="text-xs text-muted-foreground truncate mt-1">
            {[
              subtitle,
              cardCount !== undefined && `${cardCount} ${cardCount === 1 ? 'card' : 'cards'}`,
              language
            ].filter(Boolean).join(' • ')}
          </p>
        )}
      </div>

      {onPlayClick && (
        <Button
          variant="ghost"
          size="icon"
          className="space-ui-play-button shrink-0 h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary"
          onClick={(e) => {
            e.stopPropagation();
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
