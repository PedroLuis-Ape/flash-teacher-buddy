import * as React from "react";
import { Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface HintModalProps {
  hint?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Lightweight markdown renderer for hint text.
 * Supports:
 *  - **bold** inline
 *  - lines starting with "- " or "* " as bullet items
 *  - blank lines as paragraph breaks
 *  - everything else as paragraphs (preserving newlines via white-space pre-line)
 * Intentionally minimal: no external markdown library, no HTML injection.
 */
const renderInline = (text: string): React.ReactNode[] => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
};

const renderHintBody = (raw: string): React.ReactNode => {
  const blocks = raw.replace(/\r\n/g, "\n").split(/\n\s*\n/);

  return blocks.map((block, bi) => {
    const lines = block.split("\n").map((line) => line.trimEnd());
    const isList = lines.every((line) => /^\s*[-*]\s+/.test(line) || line.trim() === "");

    if (isList && lines.some((line) => line.trim() !== "")) {
      const items = lines
        .filter((line) => line.trim() !== "")
        .map((line) => line.replace(/^\s*[-*]\s+/, ""));
      return (
        <ul
          key={bi}
          className="list-disc pl-5 space-y-1.5 my-2 marker:text-muted-foreground"
        >
          {items.map((item, ii) => (
            <li key={ii} className="leading-relaxed">{renderInline(item)}</li>
          ))}
        </ul>
      );
    }

    return (
      <p
        key={bi}
        className="leading-relaxed mb-3 last:mb-0"
        style={{ whiteSpace: "pre-line" }}
      >
        {renderInline(block)}
      </p>
    );
  });
};

export const HintModal = ({ hint, isOpen, onClose }: HintModalProps) => {
  if (!isOpen) return null;

  const hasHint = Boolean(hint && hint.trim().length > 0);
  const hasDetailedExplanation = Boolean(
    hint?.includes("**Explicação detalhada**")
      || hint?.includes("**Quando usar**")
      || hint?.includes("**Erros comuns**"),
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <Card
        className={`relative w-full max-w-lg max-h-[85dvh] p-4 sm:p-6 animate-fade-in ${hasHint ? "border-warning/50" : "border-muted"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-8 w-8 p-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full shrink-0 ${hasHint ? "bg-warning/20" : "bg-muted"}`}>
            <Lightbulb className={`h-5 w-5 ${hasHint ? "text-warning" : "text-muted-foreground"}`} />
          </div>
          <div className="flex-1 pt-1 min-w-0">
            <h3 className={`font-semibold mb-2 pr-8 ${hasHint ? "text-warning" : "text-muted-foreground"}`}>
              {hasHint
                ? hasDetailedExplanation ? "Dica e explicação" : "Dica"
                : "Sem dica"}
            </h3>
            <div className="text-foreground text-[15px] sm:text-base max-h-[68dvh] overflow-y-auto overscroll-contain pr-2">
              {hasHint
                ? renderHintBody(hint as string)
                : (
                  <p className="leading-relaxed text-muted-foreground">
                    Nenhuma dica disponível para este card.
                  </p>
                )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
