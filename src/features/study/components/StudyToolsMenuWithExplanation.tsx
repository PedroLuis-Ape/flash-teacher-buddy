import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
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

export interface RemoteExplanationPreference {
  mode?: "off" | "on_demand" | "always";
  cards: Record<string, boolean>;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function loadRemoteExplanationPreference(
  scopeType: "list" | "collection",
  scopeId: string,
): Promise<RemoteExplanationPreference | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const client = supabase as any;
  const [preferenceResult, cardsResult] = await Promise.all([
    client
      .from("user_study_explanation_preferences")
      .select("display_mode")
      .eq("user_id", userId)
      .eq("scope_type", scopeType)
      .eq("scope_id", scopeId)
      .maybeSingle(),
    client
      .from("user_study_explanation_cards")
      .select("card_key, is_open")
      .eq("user_id", userId)
      .eq("scope_type", scopeType)
      .eq("scope_id", scopeId),
  ]);

  if (preferenceResult.error || cardsResult.error) return null;
  return {
    mode: preferenceResult.data?.display_mode,
    cards: Object.fromEntries(
      (cardsResult.data ?? []).map((row: { card_key: string; is_open: boolean }) => [row.card_key, row.is_open]),
    ),
  };
}

export async function saveRemoteExplanationMode(
  scopeType: "list" | "collection",
  scopeId: string,
  displayMode: "off" | "on_demand" | "always",
): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  await (supabase as any).from("user_study_explanation_preferences").upsert({
    user_id: userId,
    scope_type: scopeType,
    scope_id: scopeId,
    display_mode: displayMode,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,scope_type,scope_id" });
}

export async function saveRemoteExplanationCard(
  scopeType: "list" | "collection",
  scopeId: string,
  cardKey: string,
  isOpen: boolean,
): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  await (supabase as any).from("user_study_explanation_cards").upsert({
    user_id: userId,
    scope_type: scopeType,
    scope_id: scopeId,
    card_key: cardKey,
    is_open: isOpen,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,scope_type,scope_id,card_key" });
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
