import { Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SpecialButtonProps {
  isSpecial: boolean;
  onToggle: () => void;
  size?: "sm" | "default";
  className?: string;
}

/**
 * In-game button to mark the currently displayed card/layer as "Especial"
 * (a temporary queue for IA detailed-explanation export).
 * Independent from favorites and red-list.
 */
export function SpecialButton({ isSpecial, onToggle, size = "sm", className }: SpecialButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onToggle();
      }}
      className={cn(
        "transition-colors",
        isSpecial
          ? "text-sky-500 hover:text-sky-600"
          : "text-muted-foreground hover:text-sky-500",
        size === "sm" ? "h-8 w-8" : "h-9 w-9",
        className
      )}
      title={
        isSpecial
          ? "Remover dos especiais"
          : "Salvar para explicação detalhada depois"
      }
      aria-pressed={isSpecial}
      aria-label="Salvar como especial"
    >
      <Gem className={cn("h-4 w-4", isSpecial && "fill-current")} />
    </Button>
  );
}