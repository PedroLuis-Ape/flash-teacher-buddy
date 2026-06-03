import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SpecialFlashcardScope {
  listId?: string;
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
      const { data, error } = await supabase
        .from('user_special_flashcards' as any)
        .select('flashcard_id')
        .eq('user_id', userId);
      if (error) throw error;
      return ((data as any[]) ?? []).map((r) => r.flashcard_id);
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
      const { count, error } = await supabase
        .from('user_special_flashcards' as any)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useToggleSpecialFlashcard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      flashcardId,
      listId,
      isSpecial,
    }: {
      flashcardId: string;
      listId?: string | null;
      isSpecial: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      if (isSpecial) {
        const { error } = await supabase
          .from('user_special_flashcards' as any)
          .delete()
          .eq('user_id', user.id)
          .eq('flashcard_id', flashcardId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_special_flashcards' as any)
          .insert({
            user_id: user.id,
            flashcard_id: flashcardId,
            list_id: listId ?? null,
          } as any);
        if (error) throw error;
      }
      return { flashcardId, isSpecial: !isSpecial, userId: user.id };
    },
    onMutate: async ({ flashcardId, isSpecial }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await queryClient.cancelQueries({ queryKey: ['special-flashcards', user.id] });
      const previous = queryClient.getQueryData<string[]>(['special-flashcards', user.id]);
      queryClient.setQueryData<string[]>(['special-flashcards', user.id], (old = []) => {
        if (isSpecial) return old.filter((id) => id !== flashcardId);
        return old.includes(flashcardId) ? old : [...old, flashcardId];
      });
      return { previous, userId: user.id };
    },
    onError: (error, _vars, context) => {
      if (context?.previous && context.userId) {
        queryClient.setQueryData(['special-flashcards', context.userId], context.previous);
      }
      console.error('Error toggling special:', error);
      toast.error('Erro ao atualizar especiais');
    },
    onSuccess: (data) => {
      toast.success(data.isSpecial ? '💎 Salvo nos especiais' : 'Removido dos especiais');
    },
    onSettled: (_d, _e, _v, context) => {
      if (context?.userId) {
        queryClient.invalidateQueries({ queryKey: ['special-flashcards', context.userId] });
        queryClient.invalidateQueries({ queryKey: ['special-flashcards-count', context.userId] });
        queryClient.invalidateQueries({ queryKey: ['special-flashcards-details', context.userId] });
      }
    },
  });
}

/**
 * Bulk remove special flashcards (used after an export to clear the queue).
 */
export function useRemoveSpecialFlashcards() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (flashcardIds: string[]) => {
      if (flashcardIds.length === 0) return { removed: 0 };
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const { error } = await supabase
        .from('user_special_flashcards' as any)
        .delete()
        .eq('user_id', user.id)
        .in('flashcard_id', flashcardIds);
      if (error) throw error;
      return { removed: flashcardIds.length, userId: user.id };
    },
    onSuccess: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['special-flashcards', user.id] });
        queryClient.invalidateQueries({ queryKey: ['special-flashcards-count', user.id] });
        queryClient.invalidateQueries({ queryKey: ['special-flashcards-details', user.id] });
      }
    },
    onError: (error) => {
      console.error('Error removing specials:', error);
      toast.error('Erro ao remover dos especiais');
    },
  });
}

export interface SpecialFlashcardDetail {
  id: string;
  flashcard_id: string;
  created_at: string;
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
      const { data, error } = await supabase
        .from('user_special_flashcards' as any)
        .select('id, flashcard_id, created_at, list_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data as any[]) ?? [];
      if (rows.length === 0) return [];

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
            created_at: r.created_at,
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
          } as SpecialFlashcardDetail;
        })
        .filter((v): v is SpecialFlashcardDetail => !!v);
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}