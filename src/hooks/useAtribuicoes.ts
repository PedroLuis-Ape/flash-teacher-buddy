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