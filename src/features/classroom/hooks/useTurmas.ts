import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { getFreshSession } from '@/lib/freshSession';
import { readTurmaCreateFunctionError } from '@/features/classroom/lib/turmaCreateErrors';
import { readTurmaUpdateFunctionError } from '@/features/classroom/lib/turmaUpdateErrors';

export function useTurmasMine() {
  return useQuery({
    queryKey: ['turmas', 'mine'],
    queryFn: async () => {
      if (!FEATURE_FLAGS.classes_enabled) return { turmas: [] };
      const session = await getFreshSession();
      if (!session) return { turmas: [] };

      const { data, error } = await supabase
        .from('turmas')
        .select('*, turma_membros(count)')
        .eq('owner_teacher_id', session.user.id)
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useTurmasMine] read failed; keeping the rest of the app available', error);
        return { turmas: [] };
      }
      return { turmas: data ?? [] };
    },
    enabled: FEATURE_FLAGS.classes_enabled,
  });
}

export function useTurmasAsAluno() {
  return useQuery({
    queryKey: ['turmas', 'as-aluno'],
    queryFn: async () => {
      if (!FEATURE_FLAGS.classes_enabled) return { turmas: [] };
      const session = await getFreshSession();
      if (!session) return { turmas: [] };

      const { data: memberships, error: membershipsError } = await supabase
        .from('turma_membros')
        .select('turma_id')
        .eq('user_id', session.user.id)
        .eq('ativo', true);

      if (membershipsError) {
        console.error('[useTurmasAsAluno] membership read failed; keeping the rest of the app available', membershipsError);
        return { turmas: [] };
      }
      const turmaIds = Array.from(new Set((memberships ?? []).map((item) => item.turma_id)));
      if (turmaIds.length === 0) return { turmas: [] };

      const { data, error } = await supabase
        .from('turmas')
        .select('*')
        .in('id', turmaIds)
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useTurmasAsAluno] class read failed; keeping the rest of the app available', error);
        return { turmas: [] };
      }
      return { turmas: data ?? [] };
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
    onSuccess: ({ turma }) => {
      queryClient.setQueryData(['turmas', 'mine'], (current: any) => {
        if (!current?.turmas || !turma?.id) return current;
        return {
          ...current,
          turmas: current.turmas.map((item: any) => item.id === turma.id ? { ...item, ...turma } : item),
        };
      });

      queryClient.setQueryData(['turma', turma.id], (current: any) => {
        if (!current?.turma) return current;
        return {
          ...current,
          turma: {
            ...current.turma,
            ...turma,
            turma_membros: current.turma.turma_membros,
          },
        };
      });

      void queryClient.invalidateQueries({ queryKey: ['turmas', 'mine'], refetchType: 'active' });
      void queryClient.invalidateQueries({ queryKey: ['public-turma', turma.id], refetchType: 'active' });
      void queryClient.invalidateQueries({ queryKey: ['public-teacher-turmas'], refetchType: 'active' });
    },
  });
}

export function useReorderPublicTurmas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ordered_ids }: { ordered_ids: string[] }) => {
      if (ordered_ids.length < 2) {
        throw new Error('São necessárias pelo menos duas turmas públicas para organizar.');
      }
      if (new Set(ordered_ids).size !== ordered_ids.length) {
        throw new Error('A sequência contém turmas repetidas.');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sua sessão expirou. Entre novamente para organizar as turmas.');

      const { data, error } = await (supabase.rpc as any)('reorder_public_turmas', {
        _ordered_ids: ordered_ids,
      });

      if (error) {
        const details = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
        if (error.code === 'PGRST202' || details.includes('reorder_public_turmas')) {
          throw new Error('A ordenação de turmas públicas ainda não foi instalada no servidor.');
        }
        throw new Error('Não foi possível salvar a ordem das turmas públicas.');
      }

      if (!data?.success) {
        const code = String(data?.error ?? 'UNKNOWN');
        if (code === 'CLASS_SET_MISMATCH') {
          throw new Error('A lista de turmas mudou. Feche a janela, abra novamente e tente outra vez.');
        }
        if (code === 'FORBIDDEN_CLASS') {
          throw new Error('Uma das turmas não pertence à sua conta ou deixou de ser pública.');
        }
        throw new Error('O servidor não confirmou a nova ordem das turmas.');
      }

      return data;
    },
    onSuccess: (_data, variables) => {
      const positionById = new Map(variables.ordered_ids.map((id, index) => [id, index + 1]));
      queryClient.setQueryData(['turmas', 'mine'], (current: any) => {
        if (!current?.turmas) return current;
        return {
          ...current,
          turmas: current.turmas.map((turma: any) => {
            const position = positionById.get(turma.id);
            return position ? { ...turma, public_order_index: position } : turma;
          }),
        };
      });

      void queryClient.invalidateQueries({ queryKey: ['turmas', 'mine'], refetchType: 'active' });
      void queryClient.invalidateQueries({ queryKey: ['public-teacher-turmas'], refetchType: 'active' });
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
