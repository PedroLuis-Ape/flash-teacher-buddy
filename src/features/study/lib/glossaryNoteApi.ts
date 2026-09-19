/**
 * Serviço único de escrita da anotação pessoal de uso do glossário in-game.
 *
 * Não existe mutation paralela: tanto o card original quanto o Reforço
 * chamam esta função, que resolve a materialização para o card de origem,
 * relê o word_hints do banco e altera somente a entrada alvo.
 */
import { supabase } from "@/integrations/supabase/client";
import { parseWordHints, type WordHint } from "./wordHints";
import { applyGlossaryNote, type GlossaryNoteTarget } from "./glossaryNote";
import {
  isOwnedByUser,
  READ_ONLY_CARD_MESSAGE,
  resolveCurrentSourceCard,
} from "./studyCardNotesTarget";

export interface SaveGlossaryNoteInput {
  userId: string;
  pathname: string;
  target: GlossaryNoteTarget;
  note: string;
}

export interface SaveGlossaryNoteResult {
  hints: WordHint[];
  sourceCardId: string;
}

export async function saveInGameGlossaryNote(
  input: SaveGlossaryNoteInput,
): Promise<SaveGlossaryNoteResult> {
  const { sourceCard } = await resolveCurrentSourceCard(input.userId, input.pathname);

  if (!isOwnedByUser(sourceCard, input.userId)) {
    throw new Error(READ_ONLY_CARD_MESSAGE);
  }

  const current = parseWordHints(sourceCard.word_hints);
  const next = applyGlossaryNote(current, input.target, input.note);
  if (next === current) {
    return { hints: current, sourceCardId: sourceCard.id };
  }

  const { data: confirmed, error } = await (supabase as any)
    .from("flashcards")
    .update({ word_hints: next })
    .eq("id", sourceCard.id)
    .eq("user_id", input.userId)
    .select("id")
    .maybeSingle();

  if (error || !confirmed) {
    throw error ?? new Error("Não foi possível salvar a anotação neste card.");
  }

  // Mantém o objeto em memória coerente para quem abrir o card logo depois.
  sourceCard.word_hints = next;

  return { hints: next, sourceCardId: sourceCard.id };
}

