import { FileText, Play } from "lucide-react";
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
  const revealRef = useScrollReveal<HTMLButtonElement>({ disabled: disableAnimation });

  return (
    <button
      ref={disableAnimation ? undefined : revealRef}
      onClick={onClick}
      className={cn(
        "group card-3d ape-card-row rounded-xl",
        "bg-card transition-all duration-200",
        "border border-border",
        "text-left shadow-sm",
        "hover:shadow-md hover:border-secondary/50 hover:translate-y-[-2px]",
        "active:scale-[0.98] active:shadow-sm active:translate-y-0",
        !disableAnimation && "scroll-reveal",
        disableAnimation && "opacity-100 translate-y-0",
        className
      )}
    >
      <div className="shrink-0 w-11 h-11 rounded-lg bg-secondary/20 flex items-center justify-center transition-all duration-200 group-hover:bg-secondary/30 group-hover:scale-105">
        <FileText className="h-5 w-5 text-secondary-foreground transition-transform group-hover:scale-110" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="ape-card-title flex-1 min-w-0" title={title}>
            {title}
          </h3>
          {badge && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {badge}
            </Badge>
          )}
        </div>
        {(subtitle || cardCount !== undefined || language) && (
          <p className="text-xs text-muted-foreground truncate">
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
          className="shrink-0 h-9 w-9 rounded-lg hover:bg-primary/10 hover:text-primary"
          onClick={(e) => {
            e.stopPropagation();
            onPlayClick();
          }}
        >
          <Play className="h-4 w-4" />
        </Button>
      )}
    </button>
  );
}
