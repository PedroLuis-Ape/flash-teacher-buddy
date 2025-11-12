import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

export function useStudentsList(q?: string) {
  return useQuery({
    queryKey: ['professor-students', q],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      // Buscar inscrições onde o usuário atual é o professor
      const { data: subs, error: subsError } = await supabase
        .from('subscriptions')
        .select('student_id, created_at')
        .eq('teacher_id', session.user.id)
        .order('created_at', { ascending: false });

      if (subsError) throw subsError;
      if (!subs || subs.length === 0) {
        return { students: [], nextCursor: null, hasMore: false };
      }

      const studentIds = subs.map((s: any) => s.student_id).filter(Boolean);
      if (studentIds.length === 0) {
        return { students: [], nextCursor: null, hasMore: false };
      }

      const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('id, first_name, ape_id, avatar_skin_id')
        .in('id', studentIds);

      if (profError) throw profError;

      const profilesById: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { profilesById[p.id] = p; });

      let students = subs.map((sub: any) => ({
        aluno_id: sub.student_id,
        nome: profilesById[sub.student_id]?.first_name || 'Sem nome',
        ape_id: profilesById[sub.student_id]?.ape_id || '',
        avatar_skin_id: profilesById[sub.student_id]?.avatar_skin_id,
        desde_em: sub.created_at,
        status: 'ativo',
        origem: 'follow',
      }));

      if (q && q.trim()) {
        const qLower = q.toLowerCase();
        students = students.filter((s: any) =>
          (s.nome || '').toLowerCase().includes(qLower) ||
          (s.ape_id || '').toLowerCase().includes(qLower)
        );
      }

      return { students, nextCursor: null, hasMore: false };
    },
    enabled: FEATURE_FLAGS.meus_alunos_enabled,
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
