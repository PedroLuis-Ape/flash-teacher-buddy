import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DetailedExplanationPanelProps {
  explanation?: string | null;
  usageNotes?: string | null;
  commonMistakes?: string | null;
}

/**
 * Discreet, collapsible panel that surfaces AI-generated explanations
 * attached to the current layer/card. Pure presentation — no game logic.
 */
export function DetailedExplanationPanel({
  explanation,
  usageNotes,
  commonMistakes,
}: DetailedExplanationPanelProps) {
  const [open, setOpen] = useState(false);
  const has =
    (explanation && explanation.trim().length > 0) ||
    (usageNotes && usageNotes.trim().length > 0) ||
    (commonMistakes && commonMistakes.trim().length > 0);
  if (!has) return null;
  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="w-full justify-between text-left !min-h-[40px] px-3"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-sky-500" />
          Explicação detalhada
        </span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
        />
      </Button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 text-sm text-foreground/90">
          {explanation && (
            <p className="whitespace-pre-wrap leading-relaxed">{explanation}</p>
          )}
          {usageNotes && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                Quando usar
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{usageNotes}</p>
            </div>
          )}
          {commonMistakes && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                Erros comuns
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">
                {commonMistakes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}