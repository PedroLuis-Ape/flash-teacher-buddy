import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/** Set Red-List of a GROUP transactionally via RPC, with optimistic UI. */
export function useSetRedListGroup() {
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
      const { data, error } = await (supabase as any).rpc('set_flashcard_group_red_list', {
        p_canonical_id: canonicalId,
        p_cleanup_ids: cleanupIds ?? [],
        p_enabled: enable,
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.message || data.error || 'Falha ao atualizar Lista Vermelha');
      return { enabled: enable, userId: user.id };
    },

    onMutate: async ({ canonicalId, cleanupIds, enable }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const allIds = Array.from(new Set([canonicalId, ...(cleanupIds ?? [])].filter(Boolean)));
      await qc.cancelQueries({ queryKey: ['red-list', user.id] });
      const prev = qc.getQueriesData<string[]>({ queryKey: ['red-list', user.id] });
      qc.setQueriesData<string[]>({ queryKey: ['red-list', user.id] }, (old = []) => {
        const without = old.filter((id) => !allIds.includes(id));
        return enable ? [...without, canonicalId] : without;
      });
      return { prev };
    },

    onError: (err: any, _v, ctx) => {
      ctx?.prev?.forEach(([k, v]) => qc.setQueryData(k, v));
      console.error('[redListGroup] error', err);
      toast.error(err?.message ?? 'Erro ao atualizar Lista Vermelha');
    },
    onSuccess: (data) => {
      toast.success(
        data.enabled ? '🔴 Adicionado à Lista Vermelha' : 'Removido da Lista Vermelha',
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['red-list'] });
    },
  });
}