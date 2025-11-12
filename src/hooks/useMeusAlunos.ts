import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

export function useStudentsList(q?: string) {
  return useQuery({
    queryKey: ['professor-students', q],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('professor-students-list', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { q: q || '' },
      });

      if (error) throw error;
      return data || { students: [], nextCursor: null, hasMore: false };
    },
    enabled: FEATURE_FLAGS.meus_alunos_enabled && q !== undefined,
  });
}

export function useAddStudentsToClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ turma_id, student_ids }: { turma_id: string; student_ids: string[] }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('professor-students-add-to-class', {
        body: { turma_id, student_ids },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turmas'] });
      queryClient.invalidateQueries({ queryKey: ['professor-students'] });
    },
  });
}

export function useAssignToStudents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      student_ids: string[];
      titulo: string;
      descricao?: string;
      fonte_tipo: string;
      fonte_id: string;
      data_limite?: string;
      pontos_vale?: number;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('professor-students-assign', {
        body: params,
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

export function useStudentOverview(aluno_id: string | null) {
  return useQuery({
    queryKey: ['professor-student-overview', aluno_id],
    queryFn: async () => {
      if (!aluno_id) throw new Error('ID do aluno não fornecido');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const params = new URLSearchParams({ aluno_id });
      const { data, error } = await supabase.functions.invoke('professor-students-overview', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
    enabled: FEATURE_FLAGS.meus_alunos_enabled && !!aluno_id,
  });
}
