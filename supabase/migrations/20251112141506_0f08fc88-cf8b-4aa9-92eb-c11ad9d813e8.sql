-- Function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient_id UUID,
  p_tipo TEXT,
  p_titulo TEXT,
  p_mensagem TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notificacoes (recipient_id, tipo, titulo, mensagem, metadata)
  VALUES (p_recipient_id, p_tipo, p_titulo, p_mensagem, p_metadata)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Trigger function when assignment is completed
CREATE OR REPLACE FUNCTION public.notify_assignment_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id UUID;
  v_student_name TEXT;
  v_assignment_title TEXT;
  v_turma_id UUID;
BEGIN
  -- Only notify when status changes to 'concluido'
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    -- Get teacher, student name, and assignment details
    SELECT 
      t.owner_teacher_id,
      p.first_name,
      a.titulo,
      a.turma_id
    INTO v_teacher_id, v_student_name, v_assignment_title, v_turma_id
    FROM public.atribuicoes a
    JOIN public.turmas t ON t.id = a.turma_id
    JOIN public.profiles p ON p.id = NEW.aluno_id
    WHERE a.id = NEW.atribuicao_id;
    
    -- Create notification for teacher
    IF v_teacher_id IS NOT NULL THEN
      PERFORM public.create_notification(
        v_teacher_id,
        'atribuicao_concluida',
        'Atribuição concluída',
        v_student_name || ' concluiu: ' || v_assignment_title,
        jsonb_build_object(
          'atribuicao_id', NEW.atribuicao_id,
          'aluno_id', NEW.aluno_id,
          'turma_id', v_turma_id,
          'student_name', v_student_name
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function when message is sent
CREATE OR REPLACE FUNCTION public.notify_message_sent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_id UUID;
  v_sender_name TEXT;
  v_turma_nome TEXT;
BEGIN
  -- Get sender name
  SELECT first_name INTO v_sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;
  
  -- Get turma name
  SELECT nome INTO v_turma_nome
  FROM public.turmas
  WHERE id = NEW.turma_id;
  
  -- For DM threads, notify the other participant
  IF NEW.thread_tipo = 'dm' THEN
    -- Get the DM participants
    SELECT 
      CASE 
        WHEN teacher_id = NEW.sender_id THEN aluno_id
        ELSE teacher_id
      END INTO v_recipient_id
    FROM public.dms
    WHERE id::text = NEW.thread_chave AND turma_id = NEW.turma_id;
    
    IF v_recipient_id IS NOT NULL THEN
      PERFORM public.create_notification(
        v_recipient_id,
        'mensagem_recebida',
        'Nova mensagem',
        v_sender_name || ' enviou uma mensagem',
        jsonb_build_object(
          'mensagem_id', NEW.id,
          'turma_id', NEW.turma_id,
          'thread_tipo', NEW.thread_tipo,
          'thread_chave', NEW.thread_chave,
          'sender_id', NEW.sender_id,
          'sender_name', v_sender_name,
          'turma_nome', v_turma_nome
        )
      );
    END IF;
  END IF;
  
  -- For turma threads, notify the teacher
  IF NEW.thread_tipo = 'turma' THEN
    SELECT owner_teacher_id INTO v_recipient_id
    FROM public.turmas
    WHERE id = NEW.turma_id;
    
    -- Don't notify if sender is the teacher
    IF v_recipient_id IS NOT NULL AND v_recipient_id != NEW.sender_id THEN
      PERFORM public.create_notification(
        v_recipient_id,
        'mensagem_recebida',
        'Nova mensagem na turma',
        v_sender_name || ' enviou uma mensagem em ' || v_turma_nome,
        jsonb_build_object(
          'mensagem_id', NEW.id,
          'turma_id', NEW.turma_id,
          'thread_tipo', NEW.thread_tipo,
          'thread_chave', NEW.thread_chave,
          'sender_id', NEW.sender_id,
          'sender_name', v_sender_name,
          'turma_nome', v_turma_nome
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_notify_assignment_completed ON public.atribuicoes_status;
CREATE TRIGGER trigger_notify_assignment_completed
AFTER UPDATE ON public.atribuicoes_status
FOR EACH ROW
EXECUTE FUNCTION public.notify_assignment_completed();

DROP TRIGGER IF EXISTS trigger_notify_message_sent ON public.mensagens;
CREATE TRIGGER trigger_notify_message_sent
AFTER INSERT ON public.mensagens
FOR EACH ROW
EXECUTE FUNCTION public.notify_message_sent();