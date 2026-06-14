import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Set the Special state of a SINGLE layer (per-layer semantic).
 *
 * Specials are deliberately per-layer — toggling layer 2 must never
 * touch layer 1 or 3. The hook operates exclusively on `visibleLayerId`.
 */
export function useSetSpecialLayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      visibleLayerId,
      listId,
      enable,
    }: {
      visibleLayerId: string;
      listId?: string | null;
      enable: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      if (!enable) {
        const { error } = await supabase
          .from('user_special_flashcards' as any)
          .delete()
          .eq('user_id', user.id)
          .eq('flashcard_id', visibleLayerId);
        if (error) throw error;
        return { enabled: false, userId: user.id };
      }
      const { error } = await supabase
        .from('user_special_flashcards' as any)
        .insert({
          user_id: user.id,
          flashcard_id: visibleLayerId,
          list_id: listId ?? null,
        } as any);
      if (error && (error as any).code !== '23505') throw error;
      return { enabled: true, userId: user.id };
    },
    onMutate: async ({ visibleLayerId, enable }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await qc.cancelQueries({ queryKey: ['special-flashcards', user.id] });
      await qc.cancelQueries({ queryKey: ['special-flashcards-count', user.id] });
      const prevList = qc.getQueryData<string[]>(['special-flashcards', user.id]);
      const prevCount = qc.getQueryData<number>(['special-flashcards-count', user.id]);
      qc.setQueryData<string[]>(['special-flashcards', user.id], (old = []) => {
        if (enable) return old.includes(visibleLayerId) ? old : [...old, visibleLayerId];
        return old.filter((id) => id !== visibleLayerId);
      });
      qc.setQueryData<number>(['special-flashcards-count', user.id], (old = 0) =>
        enable ? old + 1 : Math.max(0, old - 1),
      );
      return { prevList, prevCount, userId: user.id };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.userId) {
        if (ctx.prevList !== undefined) qc.setQueryData(['special-flashcards', ctx.userId], ctx.prevList);
        if (ctx.prevCount !== undefined) qc.setQueryData(['special-flashcards-count', ctx.userId], ctx.prevCount);
      }
      console.error('[specialLayer] error', err);
      toast.error('Erro ao atualizar especiais');
    },
    onSuccess: (data) => {
      toast.success(data.enabled ? '💎 Salvo nos especiais' : 'Removido dos especiais');
    },
    onSettled: (_d, _e, _v, _ctx) => {
      qc.invalidateQueries({ queryKey: ['special-flashcards'] });
      qc.invalidateQueries({ queryKey: ['special-flashcards-count'] });
      qc.invalidateQueries({ queryKey: ['special-flashcards-details'] });
    },
  });
}