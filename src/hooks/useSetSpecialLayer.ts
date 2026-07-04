import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { takePendingSpecialFocusDraft } from '@/features/study/lib/specialFocusDraft';
import type { SpecialFocusContext } from './useSpecialFlashcards';

function emptyToNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return value ?? null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeFocusContext(focus?: SpecialFocusContext | null) {
  if (!focus) return {};
  return {
    focus_text: emptyToNull(focus.focus_text),
    focus_side: focus.focus_side ?? null,
    focus_tag: focus.focus_tag ?? null,
    focus_note: emptyToNull(focus.focus_note),
  };
}

/**
 * Set the Special state of a SINGLE layer (per-layer semantic).
 *
 * Specials are deliberately per-layer — toggling layer 2 must never
 * touch layer 1 or 3. The hook operates exclusively on `visibleLayerId`.
 *
 * When `focus` is provided, the same mutation also stores the pedagogical
 * context that will later guide the IA export. If the caller is still using
 * the old no-argument signature, a pending modal draft may be consumed from
 * sessionStorage without changing the existing Study.tsx contract.
 */
export function useSetSpecialLayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      visibleLayerId,
      listId,
      enable,
      focus,
    }: {
      visibleLayerId: string;
      listId?: string | null;
      enable: boolean;
      focus?: SpecialFocusContext | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const pendingFocus = focus ?? takePendingSpecialFocusDraft();
      const shouldEnable = enable || Boolean(pendingFocus);

      if (!shouldEnable) {
        const { error } = await supabase
          .from('user_special_flashcards' as any)
          .delete()
          .eq('user_id', user.id)
          .eq('flashcard_id', visibleLayerId);
        if (error) throw error;
        return { enabled: false, userId: user.id, hadFocus: false };
      }

      const focusPayload = normalizeFocusContext(pendingFocus);
      const { error } = await supabase
        .from('user_special_flashcards' as any)
        .upsert({
          user_id: user.id,
          flashcard_id: visibleLayerId,
          list_id: listId ?? null,
          ...focusPayload,
        } as any, { onConflict: 'user_id,flashcard_id' });
      if (error) throw error;
      return {
        enabled: true,
        userId: user.id,
        hadFocus: Boolean(focusPayload.focus_text || focusPayload.focus_tag || focusPayload.focus_note),
      };
    },
    onMutate: async ({ visibleLayerId, enable }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await qc.cancelQueries({ queryKey: ['special-flashcards', user.id] });
      await qc.cancelQueries({ queryKey: ['special-flashcards-count', user.id] });
      const prevList = qc.getQueryData<string[]>(['special-flashcards', user.id]);
      const prevCount = qc.getQueryData<number>(['special-flashcards-count', user.id]);
      const alreadyInList = prevList?.includes(visibleLayerId) ?? false;
      qc.setQueryData<string[]>(['special-flashcards', user.id], (old = []) => {
        if (enable) return old.includes(visibleLayerId) ? old : [...old, visibleLayerId];
        return old.filter((id) => id !== visibleLayerId);
      });
      qc.setQueryData<number>(['special-flashcards-count', user.id], (old = 0) => {
        if (enable) return alreadyInList ? old : old + 1;
        return alreadyInList ? Math.max(0, old - 1) : old;
      });
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
      if (!data.enabled) {
        toast.success('Removido dos especiais');
        return;
      }
      toast.success(data.hadFocus ? '💎 Especial salvo com foco' : '💎 Salvo nos especiais');
    },
    onSettled: (_d, _e, _v, _ctx) => {
      qc.invalidateQueries({ queryKey: ['special-flashcards'] });
      qc.invalidateQueries({ queryKey: ['special-flashcards-count'] });
      qc.invalidateQueries({ queryKey: ['special-flashcards-details'] });
    },
  });
}
