import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ClassGoal {
  id: string;
  turma_id: string;
  titulo: string;
  descricao?: string | null;
  created_at: string;
  updated_at: string;
  due_at?: string | null;
  created_by: string;
  targets?: ClassGoalTarget[];
  assignments?: ClassGoalAssignment[];
}

export interface ClassGoalTarget {
  id: string;
  goal_id: string;
  target_type: 'folder' | 'list';
  target_id: string;
  percent_required: number;
  created_at: string;
  // Enriched data
  target_title?: string;
}

export interface ClassGoalAssignment {
  id: string;
  goal_id: string;
  aluno_id: string;
  status: 'assigned' | 'submitted' | 'approved' | 'needs_revision';
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewer_notes?: string | null;
  created_at: string;
  updated_at: string;
  // Enriched data
  aluno_nome?: string;
  aluno_ape_id?: string;
}

// Fetch class goals for a turma
export function useClassGoals(turmaId: string | null) {
  return useQuery({
    queryKey: ['class-goals', turmaId],
    queryFn: async () => {
      if (!turmaId) return [];

      // Fetch goals with targets
      const { data: goals, error } = await supabase
        .from('class_goals')
        .select(`
          *,
          class_goal_targets (*),
          class_goal_assignments (*)
        `)
        .eq('turma_id', turmaId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich targets with titles
      const enrichedGoals = await Promise.all((goals || []).map(async (goal: any) => {
        // Enrich targets
        const enrichedTargets = await Promise.all((goal.class_goal_targets || []).map(async (target: any) => {
          let title = 'Desconhecido';
          if (target.target_type === 'folder') {
            const { data } = await supabase
              .from('folders')
              .select('title')
              .eq('id', target.target_id)
              .single();
            title = data?.title || 'Pasta não encontrada';
          } else if (target.target_type === 'list') {
            const { data } = await supabase
              .from('lists')
              .select('title')
              .eq('id', target.target_id)
              .single();
            title = data?.title || 'Lista não encontrada';
          }
          return { ...target, target_title: title };
        }));

        // Enrich assignments with student names
        const studentIds = (goal.class_goal_assignments || []).map((a: any) => a.aluno_id);
        let profileMap = new Map();
        if (studentIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, ape_id')
            .in('id', studentIds);
          profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        }

        const enrichedAssignments = (goal.class_goal_assignments || []).map((assignment: any) => {
          const profile = profileMap.get(assignment.aluno_id);
          return {
            ...assignment,
            aluno_nome: profile?.first_name || 'Aluno',
            aluno_ape_id: profile?.ape_id || 'N/A',
          };
        });

        return {
          ...goal,
          targets: enrichedTargets,
          assignments: enrichedAssignments,
        };
      }));

      return enrichedGoals as ClassGoal[];
    },
    enabled: !!turmaId,
  });
}

// Fetch student's class goal assignments
export function useMyClassGoalAssignments(turmaId: string | null) {
  return useQuery({
    queryKey: ['my-class-goal-assignments', turmaId],
    queryFn: async () => {
      if (!turmaId) return [];

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('class_goal_assignments')
        .select(`
          *,
          class_goals!inner (
            id,
            titulo,
            descricao,
            turma_id,
            due_at,
            class_goal_targets (*)
          )
        `)
        .eq('aluno_id', user.id)
        .eq('class_goals.turma_id', turmaId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!turmaId,
  });
}

// Create a new class goal
export function useCreateClassGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      turma_id,
      titulo,
      descricao,
      due_at,
      targets,
      aluno_ids,
    }: {
      turma_id: string;
      titulo: string;
      descricao?: string;
      due_at?: string;
      targets: { target_type: 'folder' | 'list'; target_id: string; percent_required: number }[];
      aluno_ids: string[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Create goal
      const { data: goal, error: goalError } = await supabase
        .from('class_goals')
        .insert({
          turma_id,
          titulo,
          descricao,
          due_at,
          created_by: user.id,
        })
        .select()
        .single();

      if (goalError) throw goalError;

      // Create targets
      if (targets.length > 0) {
        const targetInserts = targets.map(t => ({
          goal_id: goal.id,
          target_type: t.target_type,
          target_id: t.target_id,
          percent_required: t.percent_required,
        }));

        const { error: targetError } = await supabase
          .from('class_goal_targets')
          .insert(targetInserts);

        if (targetError) throw targetError;
      }

      // Create assignments for each student
      if (aluno_ids.length > 0) {
        const assignmentInserts = aluno_ids.map(aluno_id => ({
          goal_id: goal.id,
          aluno_id,
          status: 'assigned' as const,
        }));

        const { error: assignmentError } = await supabase
          .from('class_goal_assignments')
          .insert(assignmentInserts);

        if (assignmentError) throw assignmentError;
      }

      return goal;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['class-goals', variables.turma_id] });
      toast.success('✅ Meta criada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('❌ ' + (error.message || 'Erro ao criar meta'));
    },
  });
}

// Submit assignment (student)
export function useSubmitClassGoalAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ assignment_id }: { assignment_id: string }) => {
      const { data, error } = await supabase
        .from('class_goal_assignments')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', assignment_id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-class-goal-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['class-goals'] });
      toast.success('✅ Meta entregue ao professor!');
    },
    onError: (error: any) => {
      toast.error('❌ ' + (error.message || 'Erro ao entregar meta'));
    },
  });
}

// Review assignment (teacher)
export function useReviewClassGoalAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assignment_id,
      status,
      reviewer_notes,
    }: {
      assignment_id: string;
      status: 'approved' | 'needs_revision';
      reviewer_notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('class_goal_assignments')
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewer_notes,
        })
        .eq('id', assignment_id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-goals'] });
      toast.success('✅ Revisão salva!');
    },
    onError: (error: any) => {
      toast.error('❌ ' + (error.message || 'Erro ao revisar'));
    },
  });
}

// Delete class goal
export function useDeleteClassGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ goal_id, turma_id }: { goal_id: string; turma_id: string }) => {
      const { error } = await supabase
        .from('class_goals')
        .delete()
        .eq('id', goal_id);

      if (error) throw error;
      return { turma_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['class-goals', data.turma_id] });
      toast.success('✅ Meta excluída!');
    },
    onError: (error: any) => {
      toast.error('❌ ' + (error.message || 'Erro ao excluir meta'));
    },
  });
}
