import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Set the Red-List state of a GROUP atomically.
 *
 *   - enable = true  → DELETE legacy per-layer marks + INSERT canonical id.
 *                      Caller is responsible for ensuring the canonical id
 *                      is favorited first (the hook re-checks defensively).
 *   - enable = false → DELETE every legacy red mark of the group.
 */
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
      const allIds = Array.from(new Set([canonicalId, ...cleanupIds].filter(Boolean)));

      if (!enable) {
        const { error } = await supabase
          .from('user_red_list' as any)
          .delete()
          .eq('user_id', user.id)
          .in('flashcard_id', allIds);
        if (error) throw error;
        return { enabled: false, userId: user.id };
      }

      // Defensive: refuse to add to red list if the group is not favorited.
      const { data: favRow, error: favErr } = await supabase
        .from('user_favorites')
        .select('resource_id')
        .eq('user_id', user.id)
        .eq('resource_type', 'flashcard')
        .in('resource_id', allIds)
        .limit(1)
        .maybeSingle();
      if (favErr) throw favErr;
      if (!favRow) {
        throw new Error('Marque o card como favorito antes de adicionar à Lista Vermelha.');
      }

      const legacy = allIds.filter((id) => id !== canonicalId);
      if (legacy.length > 0) {
        const { error: scrubErr } = await supabase
          .from('user_red_list' as any)
          .delete()
          .eq('user_id', user.id)
          .in('flashcard_id', legacy);
        if (scrubErr) throw scrubErr;
      }
      const { error: insErr } = await supabase
        .from('user_red_list' as any)
        .insert({ user_id: user.id, flashcard_id: canonicalId } as any);
      if (insErr && (insErr as any).code !== '23505') throw insErr;
      return { enabled: true, userId: user.id };
    },

    onError: (err: any) => {
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