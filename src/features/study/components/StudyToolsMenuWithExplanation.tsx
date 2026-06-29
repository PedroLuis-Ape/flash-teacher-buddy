import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getCurrentDetailedExplanation,
  subscribeCurrentDetailedExplanation,
} from "@/features/study/lib/currentDetailedExplanation";
import { StudyToolsMenu } from "./StudyToolsMenu";

interface StudyToolsMenuWithExplanationProps {
  hint?: string | null;
  flashcardId?: string;
  wordHints?: unknown;
  answerRevealed?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  isRedListed?: boolean;
  onToggleRedList?: () => void;
  isSpecial?: boolean;
  onToggleSpecial?: () => void;
  favoritePending?: boolean;
  redListPending?: boolean;
  specialPending?: boolean;
  onRestartRound?: () => void;
  onRestartJourney?: () => void;
  className?: string;
}

export function StudyToolsMenuWithExplanation({
  flashcardId,
  wordHints,
  answerRevealed = false,
  ...toolsProps
}: StudyToolsMenuWithExplanationProps) {
  const [buttonHost, setButtonHost] = useState<HTMLElement | null>(null);
  const detailed = useSyncExternalStore(
    subscribeCurrentDetailedExplanation,
    getCurrentDetailedExplanation,
    getCurrentDetailedExplanation,
  );

  const hasWordHints = Array.isArray(wordHints) && wordHints.length > 0;
  const hasRichExplanation = Boolean(
    detailed.explanation?.trim() ||
    detailed.usageNotes?.trim() ||
    detailed.commonMistakes?.trim() ||
    hasWordHints
  );

  useLayoutEffect(() => {
    window.dispatchEvent(new CustomEvent("study:explanation-context", {
      detail: {
        cardId: flashcardId ?? null,
        wordHints,
        answerRevealed,
      },
    }));
  }, [flashcardId, wordHints, answerRevealed]);

  useLayoutEffect(() => {
    const timer = window.requestAnimationFrame(() => {
      const slots = document.querySelectorAll<HTMLElement>("[data-study-tools-slot='true']");
      const slot = slots.item(slots.length - 1);
      if (!slot) return;

      const host = document.createElement("div");
      host.className = "hidden xl:block";
      host.setAttribute("data-study-explanation-button", "true");
      slot.appendChild(host);
      setButtonHost(host);
    });

    return () => {
      window.cancelAnimationFrame(timer);
      setButtonHost((current) => {
        current?.remove();
        return null;
      });
    };
  }, []);

  const explanationButton = hasRichExplanation ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="study-tools-inline-button h-9 min-w-9 gap-1.5 px-2.5"
      title={answerRevealed ? "Abrir explicação detalhada" : "A explicação será liberada depois da resposta"}
      aria-label="Abrir ou fechar explicação detalhada"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        window.dispatchEvent(new CustomEvent("study:toggle-explanation"));
      }}
    >
      <BookOpen className="h-4 w-4" />
      <span className="hidden 2xl:inline text-xs">Explicação</span>
    </Button>
  ) : null;

  return (
    <>
      <StudyToolsMenu {...toolsProps} />
      {buttonHost && explanationButton ? createPortal(explanationButton, buttonHost) : null}
    </>
  );
}
