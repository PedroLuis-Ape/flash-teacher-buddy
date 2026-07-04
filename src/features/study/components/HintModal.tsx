import * as React from "react";
import { Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { requestDetailedExplanationPanelToggle } from "@/features/study/lib/currentDetailedExplanation";

interface HintModalProps {
  hint?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const DESKTOP_PANEL_QUERY = "(min-width: 1280px)";

function shouldUseDesktopSidePanel(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(DESKTOP_PANEL_QUERY).matches;
}

function hasDetailedContentMarker(hint?: string | null): boolean {
  return Boolean(
    hint?.includes("**Explicação detalhada**")
      || hint?.includes("**Quando usar**")
      || hint?.includes("**Erros comuns**"),
  );
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
          className="my-2 list-disc space-y-1.5 pl-5 marker:text-muted-foreground"
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
        className="mb-3 leading-relaxed last:mb-0"
        style={{ whiteSpace: "pre-line" }}
      >
        {renderInline(block)}
      </p>
    );
  });
};

export const HintModal = ({ hint, isOpen, onClose }: HintModalProps) => {
  const hasDetailedExplanation = hasDetailedContentMarker(hint);
  const useDesktopSidePanel = isOpen && hasDetailedExplanation && shouldUseDesktopSidePanel();

  React.useEffect(() => {
    if (!isOpen || !hasDetailedExplanation || !shouldUseDesktopSidePanel()) return;
    requestDetailedExplanationPanelToggle();
    onClose();
  }, [hasDetailedExplanation, isOpen, onClose]);

  if (!isOpen || useDesktopSidePanel) return null;

  const hasHint = Boolean(hint && hint.trim().length > 0);
  const title = hasHint
    ? hasDetailedExplanation ? "Dica e explicação" : "Dica"
    : "Sem dica";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent
        hideClose
        className={`max-h-[85dvh] max-w-lg overflow-hidden p-0 ${hasHint ? "border-warning/50" : "border-muted"}`}
      >
        <div className="relative p-4 sm:p-6">
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2 z-10 h-8 min-h-8 w-8 min-w-8 p-0"
              aria-label="Fechar dica"
              title="Fechar dica"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>

          <div className="flex items-start gap-3">
            <div className={`shrink-0 rounded-full p-2 ${hasHint ? "bg-warning/20" : "bg-muted"}`}>
              <Lightbulb className={`h-5 w-5 ${hasHint ? "text-warning" : "text-muted-foreground"}`} />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <DialogTitle className={`mb-2 pr-8 text-base font-semibold ${hasHint ? "text-warning" : "text-muted-foreground"}`}>
                {title}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Conteúdo de apoio do flashcard atual.
              </DialogDescription>
              <div className="max-h-[68dvh] touch-pan-y overflow-y-auto overscroll-contain pr-2 text-[15px] text-foreground sm:text-base">
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
