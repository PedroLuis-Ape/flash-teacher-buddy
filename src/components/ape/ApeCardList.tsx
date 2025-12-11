import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface ApeCardListProps {
  title: string;
  subtitle?: string;
  cardCount?: number;
  language?: string;
  badge?: string;
  onClick?: () => void;
  className?: string;
}

export function ApeCardList({
  title,
  subtitle,
  cardCount,
  language,
  badge,
  onClick,
  className
}: ApeCardListProps) {
  const revealRef = useScrollReveal<HTMLButtonElement>();

  return (
    <button
      ref={revealRef}
      onClick={onClick}
      className={cn(
        "scroll-reveal card-3d flex items-center gap-3 w-full min-h-[64px] px-4 py-3 rounded-xl",
        "bg-card transition-all duration-200",
        "border border-border",
        "text-left shadow-sm",
        className
      )}
    >
      <div className="shrink-0 w-11 h-11 rounded-lg bg-secondary/20 flex items-center justify-center">
        <FileText className="h-5 w-5 text-secondary-foreground" />
      </div>

      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-base truncate leading-tight flex-1 min-w-0" title={title}>
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
    </button>
  );
}
