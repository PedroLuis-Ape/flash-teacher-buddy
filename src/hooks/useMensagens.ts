import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

export function useChatMessages(turmaId: string | null, threadTipo: string, threadChave: string) {
  return useQuery({
    queryKey: ['mensagens', turmaId, threadTipo, threadChave],
    queryFn: async () => {
      if (!FEATURE_FLAGS.class_comms_enabled || !turmaId) return { messages: [] };
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { messages: [] };

      const { data, error } = await supabase.functions.invoke('classes-chat-list', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
    enabled: FEATURE_FLAGS.class_comms_enabled && !!turmaId && !!threadChave,
    refetchInterval: 5000, // Poll every 5 seconds
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      turma_id: string;
      thread_tipo: 'turma' | 'atribuicao' | 'dm';
      thread_chave: string;
      texto: string;
      anexos?: any;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('classes-chat-send', {
        body: payload,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['mensagens', variables.turma_id, variables.thread_tipo, variables.thread_chave] 
      });
    },
  });
}

export function useMarkMessagesRead() {
  return useMutation({
    mutationFn: async (payload: {
      turma_id: string;
      thread_tipo: string;
      thread_chave: string;
      last_message_id: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('classes-chat-mark-read', {
        body: payload,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
  });
}

export function useOpenDM() {
  return useMutation({
    mutationFn: async (payload: { turma_id: string; aluno_id: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('classes-dm-open', {
        body: payload,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
  });
}

export function useDMsList(turmaId: string | null) {
  return useQuery({
    queryKey: ['dms', turmaId],
    queryFn: async () => {
      if (!FEATURE_FLAGS.class_comms_enabled || !turmaId) return { dms: [] };
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { dms: [] };

      const { data, error } = await supabase.functions.invoke('classes-dm-list', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
    enabled: FEATURE_FLAGS.class_comms_enabled && !!turmaId,
  });
}