import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  setAttentionPoint,
  useAttentionPointsMutation,
  invalidateAttentionPointQueries,
} from './useAttentionPoint';

export type SpecialFocusSide = 'a' | 'b' | 'both';
export type SpecialFocusTag =
  | 'grammar'
  | 'vocabulary'
  | 'expression'
  | 'phrasal_verb'
  | 'pronunciation'
  | 'translation'
  | 'natural_usage'
  | 'other';

export interface SpecialFocusContext {
  focus_text?: string | null;
  focus_side?: SpecialFocusSide | null;
  focus_tag?: SpecialFocusTag | null;
  focus_note?: string | null;
}

export interface SpecialFlashcardScope {
  listId?: string;
}

function isMissingAttentionColumns(error: unknown): boolean {
  const err = error as { message?: string; details?: string; hint?: string; code?: string } | null | undefined;
  const text = `${err?.message ?? ''} ${err?.details ?? ''} ${err?.hint ?? ''} ${err?.code ?? ''}`.toLowerCase();
  return [
    'focus_text', 'focus_side', 'focus_tag', 'focus_note', 'updated_at',
    'source_group_id', 'attention_area_id', 'materialization_list_id',
    'materialization_group_id', 'is_active', 'deactivated_at',
  ]
    .some((column) => text.includes(column));
}

async function resolveLegacyGroupIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_special_flashcards' as any)
    .select('flashcard_id')
    .eq('user_id', userId);
  if (error) throw error;
  const ids = ((data as any[]) ?? []).map((row) => row.flashcard_id).filter(Boolean);
  if (!ids.length) return [];
  const { data: cards, error: cardsError } = await supabase
    .from('flashcards')
    .select('id, status_group_uid, parent_card_id')
    .in('id', ids);
  if (cardsError) throw cardsError;
  return Array.from(new Set(((cards as any[]) ?? []).map((card) =>
    card.status_group_uid ?? card.parent_card_id ?? card.id
  )));
}

/**
 * Returns the list of flashcard ids the user has saved as "special"
 * (the temporary queue for IA export). Independent from favorites and red-list.
 */
export function useSpecialFlashcards(
  userId: string | undefined,
  _scope?: SpecialFlashcardScope
) {
  return useQuery({
    queryKey: ['special-flashcards', userId],
    queryFn: async (): Promise<string[]> => {
      if (!userId) return [];
      const enhanced = await supabase
        .from('user_special_flashcards' as any)
        .select('source_group_id, flashcard_id, materialization_group_id')
        .eq('user_id', userId)
        .eq('is_active', true);
      if (enhanced.error) {
        if (!isMissingAttentionColumns(enhanced.error)) throw enhanced.error;
        return resolveLegacyGroupIds(userId);
      }
      return Array.from(new Set(((enhanced.data as any[]) ?? []).flatMap((row) => [
        row.source_group_id ?? row.flashcard_id,
        row.materialization_group_id,
      ]).filter(Boolean)));
    },
    enabled: !!userId,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useSpecialFlashcardsCount(userId: string | undefined) {
  return useQuery({
    queryKey: ['special-flashcards-count', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const enhanced = await supabase
        .from('user_special_flashcards' as any)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true);
      if (enhanced.error) {
        if (!isMissingAttentionColumns(enhanced.error)) throw enhanced.error;
        const legacy = await supabase
          .from('user_special_flashcards' as any)
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);
        if (legacy.error) throw legacy.error;
        return legacy.count ?? 0;
      }
      return enhanced.count ?? 0;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useToggleSpecialFlashcard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ flashcardId, listId, isSpecial, focus, institutionId }: {
      flashcardId: string;
      listId?: string | null;
      isSpecial: boolean;
      focus?: SpecialFocusContext | null;
      institutionId?: string | null;
    }) => {
      const result = await setAttentionPoint({
        sourceCardId: flashcardId,
        enabled: !isSpecial,
        institutionId: institutionId ?? null,
        focus: !isSpecial ? focus : null,
      });
      return { ...result, flashcardId, isSpecial: !result.enabled, listId };
    },
    onSettled: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) invalidateAttentionPointQueries(queryClient, user.id);
    },
  });
}

/**
 * Bulk remove special flashcards (used after an export to clear the queue).
 */
export function useRemoveSpecialFlashcards() {
  const mutation = useAttentionPointsMutation();
  return {
    ...mutation,
    mutate: (flashcardIds: string[], options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate({ sourceCardIds: flashcardIds, enabled: false }, options),
    mutateAsync: (flashcardIds: string[]) =>
      mutation.mutateAsync({ sourceCardIds: flashcardIds, enabled: false }),
  };
}

export interface SpecialFlashcardDetail {
  id: string;
  flashcard_id: string;
  source_group_id?: string | null;
  attention_area_id?: string | null;
  institution_id?: string | null;
  materialization_list_id?: string | null;
  materialization_group_id?: string | null;
  is_active?: boolean;
  created_at: string;
  updated_at: string | null;
  term: string;
  translation: string;
  hint: string | null;
  context_tag: string | null;
  example_text: string | null;
  example_translation: string | null;
  layer_index: number | null;
  parent_card_id: string | null;
  list_id: string | null;
  list_title: string | null;
  focus_text: string | null;
  focus_side: SpecialFocusSide | null;
  focus_tag: SpecialFocusTag | null;
  focus_note: string | null;
  notes: string | null;
}

/**
 * Returns full details for every special flashcard saved by the user,
 * already joined with list title so the export prompt has all needed fields.
 */
export function useSpecialFlashcardsDetails(userId: string | undefined) {
  return useQuery({
    queryKey: ['special-flashcards-details', userId],
    queryFn: async (): Promise<SpecialFlashcardDetail[]> => {
      if (!userId) return [];
      let rows: any[] = [];
      const enhanced = await supabase
        .from('user_special_flashcards' as any)
        .select('id, flashcard_id, source_group_id, attention_area_id, materialization_list_id, materialization_group_id, is_active, created_at, updated_at, list_id, focus_text, focus_side, focus_tag, focus_note, notes')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (enhanced.error) {
        if (!isMissingAttentionColumns(enhanced.error)) throw enhanced.error;
        const legacy = await supabase
          .from('user_special_flashcards' as any)
          .select('id, flashcard_id, created_at, list_id, notes')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (legacy.error) throw legacy.error;
        rows = (legacy.data as any[]) ?? [];
      } else {
        rows = (enhanced.data as any[]) ?? [];
      }

      if (rows.length === 0) return [];

      const areaIds = Array.from(new Set(rows.map((row) => row.attention_area_id).filter(Boolean)));
      const areaInstitutionById = new Map<string, string | null>();
      if (areaIds.length > 0) {
        const { data: areas } = await supabase
          .from('user_attention_areas' as any)
          .select('id, institution_id')
          .in('id', areaIds);
        for (const area of (areas as any[]) ?? []) areaInstitutionById.set(area.id, area.institution_id ?? null);
      }

      const flashcardIds = rows.map((r) => r.flashcard_id);
      const { data: cards, error: cardsErr } = await supabase
        .from('flashcards')
        .select('id, term, translation, hint, context_tag, example_text, example_translation, layer_index, parent_card_id, list_id')
        .in('id', flashcardIds);
      if (cardsErr) throw cardsErr;

      const listIds = Array.from(
        new Set(
          ((cards as any[]) ?? [])
            .map((c) => c.list_id)
            .filter((v): v is string => !!v)
        )
      );
      let listTitles = new Map<string, string>();
      if (listIds.length > 0) {
        const { data: lists } = await supabase
          .from('lists')
          .select('id, title')
          .in('id', listIds);
        listTitles = new Map(((lists as any[]) ?? []).map((l) => [l.id, l.title]));
      }

      const cardMap = new Map(((cards as any[]) ?? []).map((c) => [c.id, c]));
      return rows
        .map((r) => {
          const c = cardMap.get(r.flashcard_id);
          if (!c) return null;
          return {
            id: r.id,
            flashcard_id: r.flashcard_id,
            source_group_id: r.source_group_id ?? c.status_group_uid ?? c.parent_card_id ?? c.id,
            attention_area_id: r.attention_area_id ?? null,
            institution_id: r.attention_area_id ? areaInstitutionById.get(r.attention_area_id) ?? null : null,
            materialization_list_id: r.materialization_list_id ?? null,
            materialization_group_id: r.materialization_group_id ?? null,
            is_active: r.is_active ?? true,
            created_at: r.created_at,
            updated_at: r.updated_at ?? null,
            term: c.term,
            translation: c.translation,
            hint: c.hint ?? null,
            context_tag: c.context_tag ?? null,
            example_text: c.example_text ?? null,
            example_translation: c.example_translation ?? null,
            layer_index: c.layer_index ?? null,
            parent_card_id: c.parent_card_id ?? null,
            list_id: c.list_id ?? r.list_id ?? null,
            list_title: c.list_id ? listTitles.get(c.list_id) ?? null : null,
            focus_text: r.focus_text ?? null,
            focus_side: r.focus_side ?? null,
            focus_tag: r.focus_tag ?? null,
            focus_note: r.focus_note ?? null,
            notes: r.notes ?? null,
          } as SpecialFlashcardDetail;
        })
        .filter((v): v is SpecialFlashcardDetail => !!v);
    },
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
