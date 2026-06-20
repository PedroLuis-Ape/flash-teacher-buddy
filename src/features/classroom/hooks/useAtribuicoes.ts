import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

export function useAtribuicoesByTurma(turmaId: string | null) {
  return useQuery({
    queryKey: ['atribuicoes', 'by-turma', turmaId],
    queryFn: async () => {
      if (!FEATURE_FLAGS.classes_enabled || !turmaId) return { atribuicoes: [] };

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { atribuicoes: [] };

      const { data, error } = await supabase.functions.invoke('atribuicoes-by-turma', {
        body: { turma_id: turmaId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
    enabled: FEATURE_FLAGS.classes_enabled && !!turmaId,
  });
}

export function useAtribuicoesMinhas() {
  return useQuery({
    queryKey: ['atribuicoes', 'minhas'],
    queryFn: async () => {
      if (!FEATURE_FLAGS.classes_enabled) return { atribuicoes: [] };

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { atribuicoes: [] };

      const { data, error } = await supabase.functions.invoke('atribuicoes-minhas', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
    enabled: FEATURE_FLAGS.classes_enabled,
  });
}

export function useCreateAtribuicao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      turma_id: string;
      titulo: string;
      descricao?: string;
      fonte_tipo: 'lista' | 'pasta' | 'cardset';
      fonte_id: string;
      data_limite?: string;
      pontos_vale?: number;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('atribuicoes-create', {
        body: payload,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atribuicoes'] });
    },
  });
}

export function useUpdateAtribuicaoStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      atribuicao_id: string;
      status: 'pendente' | 'em_andamento' | 'concluida';
      progresso?: number;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('atribuicoes-update-status', {
        body: payload,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atribuicoes'] });
    },
  });
}

export function useDeleteAtribuicao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (atribuicao_id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('atribuicoes-delete', {
        body: { atribuicao_id },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atribuicoes'] });
    },
  });
}

export function useUpdateAtribuicao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      atribuicao_id: string;
      titulo?: string;
      descricao?: string;
      pontos_vale?: number;
      data_limite?: string | null;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase
        .from('atribuicoes')
        .update({
          titulo: payload.titulo,
          descricao: payload.descricao,
          pontos_vale: payload.pontos_vale,
          data_limite: payload.data_limite,
        })
        .eq('id', payload.atribuicao_id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atribuicoes'] });
    },
  });
}

export function useReorderAtribuicoes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { turma_id: string; ordered_ids: string[] }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const updates = await Promise.all(
        payload.ordered_ids.map(async (atribuicaoId, index) => {
          const { data, error } = await supabase
            .from('atribuicoes')
            .update({ order_index: index + 1 } as any)
            .eq('id', atribuicaoId)
            .eq('turma_id', payload.turma_id)
            .select('id, order_index')
            .single();

          if (error) throw error;
          return data;
        }),
      );

      return { ordered_ids: payload.ordered_ids, updates };
    },
    onMutate: async (payload) => {
      const queryKey = ['atribuicoes', 'by-turma', payload.turma_id];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<any>(queryKey);
      const orderMap = new Map(payload.ordered_ids.map((id, index) => [id, index + 1]));

      queryClient.setQueryData(queryKey, (current: any) => {
        if (!current?.atribuicoes) return current;
        return {
          ...current,
          atribuicoes: [...current.atribuicoes]
            .map((item: any) => ({
              ...item,
              order_index: orderMap.get(item.id) ?? item.order_index,
            }))
            .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0)),
        };
      });

      return { previous, queryKey };
    },
    onError: (_error, _payload, context) => {
      if (context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSettled: (_data, _error, payload) => {
      queryClient.invalidateQueries({ queryKey: ['atribuicoes', 'by-turma', payload.turma_id] });
      queryClient.invalidateQueries({ queryKey: ['public-turma', payload.turma_id] });
      queryClient.invalidateQueries({ queryKey: ['public-turma-assignment', payload.turma_id] });
      queryClient.invalidateQueries({ queryKey: ['public-teacher-turmas'] });
    },
  });
}

export function useReorderAtribuicao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { atribuicao_id: string; new_order_index: number }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase
        .from('atribuicoes')
        .update({ order_index: payload.new_order_index } as any)
        .eq('id', payload.atribuicao_id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atribuicoes'] });
    },
  });
}
