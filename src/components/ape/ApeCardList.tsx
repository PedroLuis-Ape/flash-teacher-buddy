import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApeCardListProps {
  title: string;
  cardCount?: number;
  language?: string;
  onClick?: () => void;
  className?: string;
}

export function ApeCardList({
  title,
  cardCount,
  language,
  onClick,
  className
}: ApeCardListProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full h-14 px-4 rounded-xl",
        "bg-card hover:bg-accent transition-colors",
        "border border-border",
        "text-left",
        className
      )}
    >
      <div className="shrink-0 w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center">
        <FileText className="h-4 w-4 text-secondary-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm truncate">
          {title}
        </h3>
        {(cardCount !== undefined || language) && (
          <p className="text-xs text-muted-foreground">
            {[
              cardCount !== undefined && `${cardCount} ${cardCount === 1 ? 'card' : 'cards'}`,
              language
            ].filter(Boolean).join(' • ')}
          </p>
        )}
      </div>
    </button>
  );
}
