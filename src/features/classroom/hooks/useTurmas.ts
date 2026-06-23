import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { readTurmaCreateFunctionError } from '@/features/classroom/lib/turmaCreateErrors';
import { readTurmaUpdateFunctionError } from '@/features/classroom/lib/turmaUpdateErrors';

export function useTurmasMine() {
  return useQuery({
    queryKey: ['turmas', 'mine'],
    queryFn: async () => {
      if (!FEATURE_FLAGS.classes_enabled) return { turmas: [] };
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { turmas: [] };
      const { data, error } = await supabase.functions.invoke('turmas-mine', {
        headers: { Authorization: `Bearer ${session.access_token}` },
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
        headers: { Authorization: `Bearer ${session.access_token}` },
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
    mutationFn: async ({ nome, descricao, public: isPublic }: { nome: string; descricao?: string; public?: boolean }) => {
      const normalizedName = nome.trim();
      if (!normalizedName) throw new Error('Nome é obrigatório');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sua sessão expirou. Entre novamente para criar a turma.');
      const { data, error } = await supabase.functions.invoke('turmas-create', {
        body: {
          nome: normalizedName,
          descricao: descricao?.trim() || undefined,
          public: isPublic === true,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw await readTurmaCreateFunctionError(error);
      if (!data?.turma?.id) throw new Error('O servidor não confirmou a criação da turma.');
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['turmas', 'mine'] }),
        queryClient.invalidateQueries({ queryKey: ['turmas'] }),
        queryClient.invalidateQueries({ queryKey: ['public-teacher-turmas'] }),
      ]);
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
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['turmas'] }),
  });
}

export function useUpdateTurma() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ turma_id, nome, descricao, public: isPublic }: {
      turma_id: string;
      nome?: string;
      descricao?: string;
      public?: boolean;
    }) => {
      const body: Record<string, string | boolean | null> = { turma_id };
      if (nome !== undefined) {
        const normalizedName = nome.trim();
        if (!normalizedName) throw new Error('Nome é obrigatório');
        body.nome = normalizedName;
      }
      if (descricao !== undefined) body.descricao = descricao.trim() || null;
      if (isPublic !== undefined) body.public = isPublic;
      if (Object.keys(body).length === 1) throw new Error('Nenhuma alteração válida foi enviada');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sua sessão expirou. Entre novamente para atualizar a turma.');
      const { data, error } = await supabase.functions.invoke('turmas-update', {
        body,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw await readTurmaUpdateFunctionError(error);

      const updated = data?.turma;
      if (!updated?.id) throw new Error('O servidor não confirmou a atualização da turma.');
      if (isPublic !== undefined && updated.public !== isPublic) {
        throw new Error('A visibilidade da turma não foi salva. Tente novamente.');
      }
      return { turma: updated };
    },
    onSuccess: async ({ turma }) => {
      queryClient.setQueryData(['turmas', 'mine'], (current: any) => {
        if (!current?.turmas || !turma?.id) return current;
        return {
          ...current,
          turmas: current.turmas.map((item: any) => item.id === turma.id ? { ...item, ...turma } : item),
        };
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['turmas'] }),
        queryClient.invalidateQueries({ queryKey: ['turma'] }),
        queryClient.invalidateQueries({ queryKey: ['public-turma'] }),
        queryClient.invalidateQueries({ queryKey: ['public-teacher-turmas'] }),
      ]);
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
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['turmas'] }),
  });
}

export function useRemoveTurmaMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ turma_id, user_id }: { turma_id: string; user_id: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');
      const { data, error } = await supabase.functions.invoke('turmas-remove-member', {
        body: { turma_id, user_id },
        headers: { Authorization: `Bearer ${session.access_token}` },
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
