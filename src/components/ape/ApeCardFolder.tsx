import { Folder, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApeCardFolderProps {
  title: string;
  listCount?: number;
  cardCount?: number;
  isLocked?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ApeCardFolder({
  title,
  listCount,
  cardCount,
  isLocked = false,
  onClick,
  className
}: ApeCardFolderProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLocked}
      className={cn(
        "flex items-center gap-3 w-full min-h-[56px] px-4 rounded-xl",
        "bg-card hover:bg-accent/80 transition-all duration-200",
        "border border-border",
        "text-left shadow-sm hover:shadow-md",
        isLocked && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        {isLocked ? (
          <Lock className="h-5 w-5 text-primary" />
        ) : (
          <Folder className="h-5 w-5 text-primary" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-base truncate leading-tight">
          {title}
        </h3>
        {(listCount !== undefined || cardCount !== undefined) && (
          <p className="text-xs text-muted-foreground leading-tight mt-0.5">
            {[
              listCount !== undefined && `${listCount} ${listCount === 1 ? 'lista' : 'listas'}`,
              cardCount !== undefined && `${cardCount} ${cardCount === 1 ? 'card' : 'cards'}`
            ].filter(Boolean).join(' • ')}
          </p>
        )}
      </div>
    </button>
  );
}
