import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Set the favorite state of a layered-or-normal card GROUP in a single
 * atomic-ish operation. Replaces N parallel useToggleFavorite calls from
 * Study.tsx.
 *
 *   - enable = true  → DELETE legacy per-layer marks + INSERT canonical id
 *   - enable = false → DELETE every legacy mark of the group AND every
 *                      matching red-list entry (Favorite × RedList invariant)
 *
 * `cleanupIds` should include every id that could legitimately hold an old
 * mark for this group (canonical + per-layer + visible-layer). The hook
 * sends a single `.in(...)` per table.
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

      const allIds = Array.from(new Set([canonicalId, ...cleanupIds].filter(Boolean)));

      if (!enable) {
        // 1) remove every favorite mark of the group (canonical + legacy)
        const { error: favErr } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('resource_type', 'flashcard')
          .in('resource_id', allIds);
        if (favErr) throw favErr;
        // 2) Favorite×RedList invariant: drop every red-list entry of the group
        const { error: redErr } = await supabase
          .from('user_red_list' as any)
          .delete()
          .eq('user_id', user.id)
          .in('flashcard_id', allIds);
        if (redErr) console.warn('[favoriteGroup] red cleanup error', redErr);
        return { enabled: false, userId: user.id };
      }

      // ENABLE: scrub legacy per-layer marks first (everything except canonical),
      // then insert the canonical one. Tolerate unique-violation races.
      const legacy = allIds.filter((id) => id !== canonicalId);
      if (legacy.length > 0) {
        const { error: scrubErr } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('resource_type', 'flashcard')
          .in('resource_id', legacy);
        if (scrubErr) throw scrubErr;
      }
      const { error: insErr } = await supabase
        .from('user_favorites')
        .insert({
          user_id: user.id,
          resource_type: 'flashcard',
          resource_id: canonicalId,
        });
      if (insErr && (insErr as any).code !== '23505') throw insErr;
      return { enabled: true, userId: user.id };
    },

    onError: (err) => {
      console.error('[favoriteGroup] error', err);
      toast.error('Erro ao atualizar favorito');
    },
    onSuccess: (data) => {
      toast.success(
        data.enabled ? '⭐ Adicionado aos favoritos' : 'Removido dos favoritos',
      );
    },
    onSettled: (_d, _e, _v, _ctx) => {
      // Invalidate every scope — cheap, and guarantees consistency without
      // touching unrelated optimistic caches.
      qc.invalidateQueries({ queryKey: ['favorites'] });
      qc.invalidateQueries({ queryKey: ['favorites-count'] });
      qc.invalidateQueries({ queryKey: ['red-list'] });
    },
  });
}