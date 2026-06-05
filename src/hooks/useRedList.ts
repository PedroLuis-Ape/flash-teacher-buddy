import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Fetch red-list flashcard IDs for a given user, optionally scoped to a list.
 */
async function fetchRedList(
  userId: string,
  listScope?: string
): Promise<string[]> {
  if (!listScope) {
    // Global (all red-listed flashcards for the user)
    const { data, error } = await supabase
      .from('user_red_list' as any)
      .select('flashcard_id')
      .eq('user_id', userId);

    if (error) throw error;
    return (data as any[])?.map((r: any) => r.flashcard_id) ?? [];
  }

  // Scoped: include card.id AND parent_card_id so red-list entries saved on
  // the parent/aggregator id of layered cards are still recognized within
  // this list.
  const { data: flashcards, error: fcError } = await supabase
    .from('flashcards')
    .select('id, parent_card_id')
    .eq('list_id', listScope)
    .is('deleted_at', null);

  if (fcError) throw fcError;
  const idSet = new Set<string>();
  for (const card of flashcards ?? []) {
    if (card.id) idSet.add(card.id);
    if ((card as any).parent_card_id) idSet.add((card as any).parent_card_id);
  }
  const flashcardIds = Array.from(idSet);
  if (flashcardIds.length === 0) return [];

  const { data, error } = await supabase
    .from('user_red_list' as any)
    .select('flashcard_id')
    .eq('user_id', userId)
    .in('flashcard_id', flashcardIds);

  if (error) throw error;
  return (data as any[])?.map((r: any) => r.flashcard_id) ?? [];
}

/**
 * Hook to read red-list IDs for the current user, optionally scoped to a list.
 */
export function useRedList(userId: string | undefined, listId?: string) {
  return useQuery({
    queryKey: ['red-list', userId, listId ?? null],
    queryFn: async () => {
      if (!userId) return [];
      return fetchRedList(userId, listId);
    },
    enabled: !!userId,
  });
}

/**
 * Hook to toggle a flashcard's red-list status.
 * Also enforces the rule: removing from favorites auto-removes from red list.
 */
export function useToggleRedList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      flashcardId,
      isRedListed,
    }: {
      flashcardId: string;
      isRedListed: boolean;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      if (isRedListed) {
        // Remove from red list
        const { error } = await supabase
          .from('user_red_list' as any)
          .delete()
          .eq('user_id', user.id)
          .eq('flashcard_id', flashcardId);
        if (error) throw error;
      } else {
        // Add to red list — tolerate unique-violation races from rapid clicks.
        const { error } = await supabase
          .from('user_red_list' as any)
          .insert({ user_id: user.id, flashcard_id: flashcardId } as any);
        if (error && (error as any).code !== '23505') throw error;
      }

      return { flashcardId, isRedListed: !isRedListed, userId: user.id };
    },

    onMutate: async ({ flashcardId, isRedListed }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await queryClient.cancelQueries({ queryKey: ['red-list', user.id] });

      const previousEntries = queryClient.getQueriesData<string[]>({
        queryKey: ['red-list', user.id],
      });

      queryClient.setQueriesData<string[]>(
        { queryKey: ['red-list', user.id] },
        (old = []) => {
          if (isRedListed) {
            return old.filter((id) => id !== flashcardId);
          }
          return old.includes(flashcardId) ? old : [...old, flashcardId];
        }
      );

      return { previousEntries, userId: user.id };
    },

    onError: (error, _variables, context) => {
      if (context?.previousEntries) {
        context.previousEntries.forEach(([queryKey, value]) => {
          queryClient.setQueryData(queryKey, value);
        });
      }
      console.error('Error toggling red list:', error);
      toast.error('Erro ao alterar Lista Vermelha');
    },

    onSuccess: (data) => {
      toast.success(
        data.isRedListed
          ? '🔴 Adicionado à Lista Vermelha'
          : 'Removido da Lista Vermelha'
      );
    },

    onSettled: (_data, _error, _variables, context) => {
      if (context?.userId) {
        queryClient.invalidateQueries({ queryKey: ['red-list', context.userId] });
      }
    },
  });
}

/**
 * Utility: remove flashcard from red list when it's unfavorited.
 * Called from the favorites toggle mutation.
 */
export async function removeFromRedListIfNeeded(
  userId: string,
  flashcardId: string
) {
  try {
    await supabase
      .from('user_red_list' as any)
      .delete()
      .eq('user_id', userId)
      .eq('flashcard_id', flashcardId);
  } catch {
    // Non-blocking: red-list cleanup is best-effort
  }
}
