import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// =============================================
// TYPES
// =============================================

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  start_at: string;
  due_at: string | null;
  status: 'active' | 'paused' | 'completed' | 'expired';
  created_at: string;
  updated_at: string;
  steps?: GoalStep[];
}

export interface GoalStep {
  id: string;
  goal_id: string;
  user_id: string;
  list_id: string;
  mode: string | null; // null = modo livre
  target_count: number;
  current_count: number;
  order_index: number;
  created_at: string;
  updated_at: string;
  // Joined data
  list_title?: string;
}

export interface CreateGoalData {
  title: string;
  due_days?: number | null; // number of days from now
  steps: {
    list_id: string;
    mode: string | null;
    target_count: number;
  }[];
}

// =============================================
// HOOK: useGoals
// =============================================

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all goals with steps
  const fetchGoals = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch goals
      const { data: goalsData, error: goalsError } = await supabase
        .from('user_goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (goalsError) throw goalsError;

      if (!goalsData || goalsData.length === 0) {
        setGoals([]);
        return;
      }

      // Fetch steps for all goals
      const goalIds = goalsData.map(g => g.id);
      const { data: stepsData, error: stepsError } = await supabase
        .from('user_goal_steps')
        .select('*')
        .in('goal_id', goalIds)
        .order('order_index', { ascending: true });

      if (stepsError) throw stepsError;

      // Fetch list titles for steps
      const listIds = [...new Set((stepsData || []).map(s => s.list_id))];
      let listTitlesMap: Record<string, string> = {};
      
      if (listIds.length > 0) {
        const { data: listsData } = await supabase
          .from('lists')
          .select('id, title')
          .in('id', listIds);
        
        listTitlesMap = (listsData || []).reduce((acc, l) => {
          acc[l.id] = l.title;
          return acc;
        }, {} as Record<string, string>);
      }

      // Merge steps with list titles
      const stepsWithTitles = (stepsData || []).map(step => ({
        ...step,
        list_title: listTitlesMap[step.list_id] || 'Lista removida'
      })) as GoalStep[];

      // Group steps by goal
      const goalsWithSteps = goalsData.map(goal => ({
        ...goal,
        status: goal.status as Goal['status'],
        steps: stepsWithTitles.filter(s => s.goal_id === goal.id)
      }));

      setGoals(goalsWithSteps);
    } catch (error) {
      console.error('Error fetching goals:', error);
      toast.error('Erro ao carregar metas');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create a new goal
  const createGoal = useCallback(async (data: CreateGoalData): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Você precisa estar logado');
        return null;
      }

      // Calculate due_at
      let due_at: string | null = null;
      if (data.due_days && data.due_days > 0) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + data.due_days);
        due_at = dueDate.toISOString();
      }

      // Insert goal
      const { data: goal, error: goalError } = await supabase
        .from('user_goals')
        .insert({
          user_id: user.id,
          title: data.title,
          due_at,
          status: 'active'
        })
        .select()
        .single();

      if (goalError) throw goalError;

      // Insert steps
      const stepsToInsert = data.steps.map((step, index) => ({
        goal_id: goal.id,
        user_id: user.id,
        list_id: step.list_id,
        mode: step.mode,
        target_count: step.target_count,
        current_count: 0,
        order_index: index
      }));

      const { error: stepsError } = await supabase
        .from('user_goal_steps')
        .insert(stepsToInsert);

      if (stepsError) throw stepsError;

      toast.success('Meta criada com sucesso!');
      await fetchGoals();
      return goal.id;
    } catch (error) {
      console.error('Error creating goal:', error);
      toast.error('Erro ao criar meta');
      return null;
    }
  }, [fetchGoals]);

  // Update goal status
  const updateGoalStatus = useCallback(async (goalId: string, status: Goal['status']) => {
    try {
      const { error } = await supabase
        .from('user_goals')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', goalId);

      if (error) throw error;

      toast.success(
        status === 'paused' ? 'Meta pausada' :
        status === 'active' ? 'Meta retomada' :
        status === 'completed' ? 'Meta concluída!' :
        'Status atualizado'
      );
      await fetchGoals();
    } catch (error) {
      console.error('Error updating goal:', error);
      toast.error('Erro ao atualizar meta');
    }
  }, [fetchGoals]);

  // Delete goal
  const deleteGoal = useCallback(async (goalId: string) => {
    try {
      const { error } = await supabase
        .from('user_goals')
        .delete()
        .eq('id', goalId);

      if (error) throw error;

      toast.success('Meta removida');
      await fetchGoals();
    } catch (error) {
      console.error('Error deleting goal:', error);
      toast.error('Erro ao remover meta');
    }
  }, [fetchGoals]);

  // Load on mount
  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  return {
    goals,
    isLoading,
    fetchGoals,
    createGoal,
    updateGoalStatus,
    deleteGoal,
  };
}

// =============================================
// SERVICE: updateGoalProgress
// Called from useStudyEngine when a session completes
// =============================================

export async function updateGoalProgress(
  userId: string,
  sessionId: string,
  listId: string,
  mode: string
): Promise<{ updated: boolean; stepInfo?: string; goalCompleted?: boolean }> {
  try {
    // 1. Find active goals with steps matching this list
    const { data: steps, error: stepsError } = await supabase
      .from('user_goal_steps')
      .select(`
        id,
        goal_id,
        list_id,
        mode,
        target_count,
        current_count,
        user_goals!inner(id, status)
      `)
      .eq('user_id', userId)
      .eq('list_id', listId)
      .eq('user_goals.status', 'active');

    if (stepsError) throw stepsError;
    if (!steps || steps.length === 0) {
      return { updated: false };
    }

    let anyUpdated = false;
    let lastStepInfo = '';
    let anyGoalCompleted = false;

    for (const step of steps) {
      // 2. Check mode match (null = any mode)
      if (step.mode !== null && step.mode !== mode) {
        continue;
      }

      // 3. Check if this session already counted for this step
      const { data: existingCompletion } = await supabase
        .from('user_goal_step_completions')
        .select('id')
        .eq('step_id', step.id)
        .eq('study_session_id', sessionId)
        .maybeSingle();

      if (existingCompletion) {
        continue; // Already counted
      }

      // 4. Register completion
      const { error: insertError } = await supabase
        .from('user_goal_step_completions')
        .insert({
          step_id: step.id,
          study_session_id: sessionId,
          user_id: userId
        });

      if (insertError) {
        console.error('Error inserting completion:', insertError);
        continue;
      }

      // 5. Increment step count
      const newCount = step.current_count + 1;
      const { error: updateError } = await supabase
        .from('user_goal_steps')
        .update({ 
          current_count: newCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', step.id);

      if (updateError) {
        console.error('Error updating step:', updateError);
        continue;
      }

      anyUpdated = true;
      lastStepInfo = `${newCount}/${step.target_count}`;

      // 6. Check if all steps of this goal are completed
      if (newCount >= step.target_count) {
        const { data: allSteps } = await supabase
          .from('user_goal_steps')
          .select('current_count, target_count')
          .eq('goal_id', step.goal_id);

        const allCompleted = allSteps?.every(s => s.current_count >= s.target_count);

        if (allCompleted) {
          // Mark goal as completed
          await supabase
            .from('user_goals')
            .update({ 
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', step.goal_id);

          anyGoalCompleted = true;
        }
      }
    }

    return {
      updated: anyUpdated,
      stepInfo: lastStepInfo,
      goalCompleted: anyGoalCompleted
    };
  } catch (error) {
    console.error('Error updating goal progress:', error);
    return { updated: false };
  }
}
