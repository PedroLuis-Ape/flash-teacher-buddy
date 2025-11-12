import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

export function useTurmasMine() {
  return useQuery({
    queryKey: ['turmas', 'mine'],
    queryFn: async () => {
      if (!FEATURE_FLAGS.classes_enabled) return { turmas: [] };
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { turmas: [] };

      const { data, error } = await supabase.functions.invoke('turmas-mine', {
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

export function useTurmasAsAluno() {
  return useQuery({
    queryKey: ['turmas', 'as-aluno'],
    queryFn: async () => {
      if (!FEATURE_FLAGS.classes_enabled) return { turmas: [] };
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { turmas: [] };

      const { data, error } = await supabase.functions.invoke('turmas-as-aluno', {
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

export function useCreateTurma() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nome, descricao }: { nome: string; descricao?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('turmas-create', {
        body: { nome, descricao },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turmas', 'mine'] });
    },
  });
}

export function useEnrollAluno() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ turma_id, ape_id }: { turma_id: string; ape_id: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('turmas-enroll', {
        body: { turma_id, ape_id },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turmas'] });
    },
  });
}

export function useUpdateTurma() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ turma_id, nome, descricao }: { turma_id: string; nome?: string; descricao?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('turmas-update', {
        body: { turma_id, nome, descricao },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turmas'] });
      queryClient.invalidateQueries({ queryKey: ['turma'] });
    },
  });
}

export function useDeleteTurma() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (turma_id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('turmas-delete', {
        body: { turma_id },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turmas'] });
    },
  });
}