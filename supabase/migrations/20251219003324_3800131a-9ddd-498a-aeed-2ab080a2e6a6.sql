-- ========================================
-- FIX 2: Add notifications for class goal submissions
-- Trigger to notify teacher when student submits a class goal assignment
-- ========================================

-- Create trigger function to notify teacher when student submits a class goal
CREATE OR REPLACE FUNCTION public.notify_class_goal_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id UUID;
  v_student_name TEXT;
  v_goal_title TEXT;
  v_turma_id UUID;
  v_turma_nome TEXT;
BEGIN
  -- Only notify when status changes to 'submitted'
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    -- Get teacher, student name, goal details and turma info
    SELECT 
      t.owner_teacher_id,
      p.first_name,
      g.titulo,
      g.turma_id,
      t.nome
    INTO v_teacher_id, v_student_name, v_goal_title, v_turma_id, v_turma_nome
    FROM public.class_goals g
    JOIN public.turmas t ON t.id = g.turma_id
    JOIN public.profiles p ON p.id = NEW.aluno_id
    WHERE g.id = NEW.goal_id;
    
    -- Create notification for teacher
    IF v_teacher_id IS NOT NULL THEN
      PERFORM public.create_notification(
        v_teacher_id,
        'meta_entregue',
        'Meta entregue',
        COALESCE(v_student_name, 'Aluno') || ' entregou: ' || COALESCE(v_goal_title, 'Meta'),
        jsonb_build_object(
          'goal_id', NEW.goal_id,
          'assignment_id', NEW.id,
          'aluno_id', NEW.aluno_id,
          'turma_id', v_turma_id,
          'student_name', v_student_name,
          'turma_nome', v_turma_nome
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on class_goal_assignments
DROP TRIGGER IF EXISTS on_class_goal_assignment_submitted ON public.class_goal_assignments;
CREATE TRIGGER on_class_goal_assignment_submitted
  AFTER UPDATE ON public.class_goal_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_class_goal_submitted();