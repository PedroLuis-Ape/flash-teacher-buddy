import { Folder, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface ApeCardFolderProps {
  title: string;
  listCount?: number;
  cardCount?: number;
  isLocked?: boolean;
  onClick?: () => void;
  className?: string;
  /** Disable scroll reveal animation for performance in large lists */
  disableAnimation?: boolean;
}

export function ApeCardFolder({
  title,
  listCount,
  cardCount,
  isLocked = false,
  onClick,
  className,
  disableAnimation = false
}: ApeCardFolderProps) {
  const revealRef = useScrollReveal<HTMLButtonElement>({ disabled: disableAnimation });

  return (
    <button
      ref={disableAnimation ? undefined : revealRef}
      onClick={onClick}
      disabled={isLocked}
      className={cn(
        "card-3d ape-card-row rounded-xl",
        "bg-card transition-all duration-200",
        "border border-border",
        "text-left shadow-sm",
        !disableAnimation && "scroll-reveal",
        disableAnimation && "opacity-100 translate-y-0",
        isLocked && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <div className="shrink-0 w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
        {isLocked ? (
          <Lock className="h-5 w-5 text-primary" />
        ) : (
          <Folder className="h-5 w-5 text-primary" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="ape-card-title" title={title}>
          {title}
        </h3>
        {(listCount !== undefined || cardCount !== undefined) && (
          <p className="text-xs text-muted-foreground leading-tight mt-0.5 truncate">
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
