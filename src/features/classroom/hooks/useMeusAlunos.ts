import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

export function useStudentsList(q?: string, turmaId?: string) {
  const normalizedQuery = (q ?? '').trim().replace(/\s+/g, ' ');
  return useQuery({
    queryKey: ['professor-students', turmaId ?? null, normalizedQuery],
    queryFn: async () => {
      if (!turmaId || normalizedQuery.length < 2) {
        return { students: [], nextCursor: null, hasMore: false };
      }

      const { data, error } = await (supabase.rpc as any)('search_turma_people_v1', {
        p_kind: 'student',
        p_turma_id: turmaId,
        p_query: normalizedQuery,
        p_limit: 20,
        p_offset: 0,
      });
      if (error) throw error;

      const students = ((data ?? []) as any[]).map((person: any) => ({
        // The UI uses the public identifier; the gateway resolves it server-side.
        aluno_id: person.public_id,
        nome: person.display_name,
        ape_id: person.public_id,
        avatar_url: person.avatar_url,
        status: person.membership_status ?? 'disponível',
        origem: 'classroom-directory',
      }));

      return { students, nextCursor: null, hasMore: false };
    },
    enabled: FEATURE_FLAGS.meus_alunos_enabled && Boolean(turmaId) && normalizedQuery.length >= 2,
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

      const { data, error } = await supabase.functions.invoke('professor-students-overview', {
        body: { aluno_id },
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
