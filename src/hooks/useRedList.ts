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

  // CLARA MASTER P0 — server-side RPC returns canonical group ids only.
  const { data, error } = await (supabase as any).rpc('get_scoped_flashcard_red_list', {
    p_list_id: listScope,
    p_collection_id: null,
    p_folder_id: null,
    p_institution_id: null,
  });
  if (error) throw error;
  const seen = new Set<string>();
  for (const row of (data ?? []) as Array<{ group_id: string }>) {
    if (row?.group_id) seen.add(row.group_id);
  }
  return Array.from(seen);
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
    // Clara Master P0 — explicit key so `useIsMutating` in GamesHub /
    // Study can detect in-flight red-list writes.
    mutationKey: ['red-list-toggle'],
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
 * Utility: remove flashcard(s) from red list when they get unfavorited.
 * Called from the favorites toggle mutation. Accepts a single id or a
 * batch of legacy ids (canonical + per-layer) so cleanup is atomic from
 * the user's perspective — one DELETE, no loops.
 */
export async function removeFromRedListIfNeeded(
  userId: string,
  flashcardId: string | string[]
) {
  const ids = Array.isArray(flashcardId) ? flashcardId : [flashcardId];
  const unique = Array.from(new Set(ids.filter((id): id is string => !!id)));
  if (unique.length === 0) return;
  try {
    const { error } = await supabase
      .from('user_red_list' as any)
      .delete()
      .eq('user_id', userId)
      .in('flashcard_id', unique);
    // Non-blocking: red-list cleanup is best-effort. We still log unexpected
    // errors so the caller can react (e.g. trigger an invalidate).
    if (error && (error as any).code !== 'PGRST116') {
      console.warn('[redList] cleanup error', error);
    }
  } catch (err) {
    console.warn('[redList] cleanup threw', err);
  }
}
