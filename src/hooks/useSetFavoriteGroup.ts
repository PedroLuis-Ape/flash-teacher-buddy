import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Set the favorite state of a layered-or-normal card GROUP via the
 * server-side RPC `set_flashcard_group_favorite`. Single transaction,
 * optimistic UI on top of every favorites/favorites-count cache scope.
 */
export function useSetFavoriteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      canonicalId,
      cleanupIds,
      enable,
    }: {
      canonicalId: string;
      cleanupIds: string[];
      enable: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const { data, error } = await (supabase as any).rpc('set_flashcard_group_favorite', {
        p_canonical_id: canonicalId,
        p_cleanup_ids: cleanupIds ?? [],
        p_enabled: enable,
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.message || data.error || 'Falha ao atualizar favorito');
      return { enabled: enable, userId: user.id };
    },

    onMutate: async ({ canonicalId, cleanupIds, enable }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const allIds = Array.from(new Set([canonicalId, ...(cleanupIds ?? [])].filter(Boolean)));

      await qc.cancelQueries({ queryKey: ['favorites', user.id, 'flashcard'] });
      await qc.cancelQueries({ queryKey: ['favorites-count', user.id, 'flashcard'] });
      await qc.cancelQueries({ queryKey: ['red-list', user.id] });

      const prevFavs = qc.getQueriesData<string[]>({ queryKey: ['favorites', user.id, 'flashcard'] });
      const prevCount = qc.getQueriesData<number>({ queryKey: ['favorites-count', user.id, 'flashcard'] });
      const prevRed = qc.getQueriesData<string[]>({ queryKey: ['red-list', user.id] });

      qc.setQueriesData<string[]>({ queryKey: ['favorites', user.id, 'flashcard'] }, (old = []) => {
        const without = old.filter((id) => !allIds.includes(id));
        return enable ? [...without, canonicalId] : without;
      });
      qc.setQueriesData<number>({ queryKey: ['favorites-count', user.id, 'flashcard'] }, (old = 0) => {
        // Count change is at most 1 per group toggle (canonical replaces legacy).
        return enable ? old + 1 : Math.max(0, old - 1);
      });
      if (!enable) {
        qc.setQueriesData<string[]>({ queryKey: ['red-list', user.id] }, (old = []) =>
          old.filter((id) => !allIds.includes(id)),
        );
      }
      return { prevFavs, prevCount, prevRed };
    },

    onError: (err, _vars, ctx) => {
      ctx?.prevFavs?.forEach(([k, v]) => qc.setQueryData(k, v));
      ctx?.prevCount?.forEach(([k, v]) => qc.setQueryData(k, v));
      ctx?.prevRed?.forEach(([k, v]) => qc.setQueryData(k, v));
      console.error('[favoriteGroup] error', err);
      toast.error((err as any)?.message ?? 'Erro ao atualizar favorito');
    },
    onSuccess: (data) => {
      toast.success(
        data.enabled ? '⭐ Adicionado aos favoritos' : 'Removido dos favoritos',
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['favorites'] });
      qc.invalidateQueries({ queryKey: ['favorites-count'] });
      qc.invalidateQueries({ queryKey: ['red-list'] });
    },
  });
}