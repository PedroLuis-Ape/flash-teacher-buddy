import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";
import { chunkArray } from "@/features/special-import/lib/listSpecials";
import type { SpecialFlashcardDetail } from "@/hooks/useSpecialFlashcards";

const IN_FILTER_CHUNK = 200;

type SpecialRow = {
  id: string;
  flashcard_id: string;
  created_at: string;
  list_id: string | null;
};

export function useSpecialFlashcardsDetailsScalable(userId: string | undefined) {
  return useQuery({
    queryKey: ["special-flashcards-details", userId],
    queryFn: async (): Promise<SpecialFlashcardDetail[]> => {
      if (!userId) return [];

      const rows = await fetchAllSupabaseRows<SpecialRow>((from, to) =>
        (supabase as any)
          .from("user_special_flashcards")
          .select("id, flashcard_id, created_at, list_id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
      );
      if (rows.length === 0) return [];

      const cards: any[] = [];
      for (const ids of chunkArray(rows.map((row) => row.flashcard_id), IN_FILTER_CHUNK)) {
        const { data, error } = await supabase
          .from("flashcards")
          .select("id, term, translation, hint, context_tag, example_text, example_translation, layer_index, parent_card_id, list_id")
          .in("id", ids);
        if (error) throw error;
        cards.push(...((data as any[]) ?? []));
      }

      const listIds = Array.from(new Set(cards.map((card) => card.list_id).filter(Boolean))) as string[];
      const listTitles = new Map<string, string>();
      for (const ids of chunkArray(listIds, IN_FILTER_CHUNK)) {
        const { data, error } = await supabase
          .from("lists")
          .select("id, title")
          .in("id", ids);
        if (error) throw error;
        for (const list of (data as any[]) ?? []) listTitles.set(list.id, list.title);
      }

      const cardMap = new Map(cards.map((card) => [card.id, card]));
      return rows
        .map((row) => {
          const card = cardMap.get(row.flashcard_id);
          if (!card) return null;
          return {
            id: row.id,
            flashcard_id: row.flashcard_id,
            created_at: row.created_at,
            term: card.term,
            translation: card.translation,
            hint: card.hint ?? null,
            context_tag: card.context_tag ?? null,
            example_text: card.example_text ?? null,
            example_translation: card.example_translation ?? null,
            layer_index: card.layer_index ?? null,
            parent_card_id: card.parent_card_id ?? null,
            list_id: card.list_id ?? row.list_id ?? null,
            list_title: card.list_id ? listTitles.get(card.list_id) ?? null : null,
          } satisfies SpecialFlashcardDetail;
        })
        .filter((value): value is SpecialFlashcardDetail => Boolean(value));
    },
    enabled: Boolean(userId),
    staleTime: 0,
    placeholderData: keepPreviousData,
    refetchOnMount: "always",
  });
}
