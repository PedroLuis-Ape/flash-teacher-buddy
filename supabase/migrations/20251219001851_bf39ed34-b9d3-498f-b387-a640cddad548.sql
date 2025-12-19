-- Atomic RPC to swap A/B sides for a list
-- Swaps: lang_a <-> lang_b, labels_a <-> labels_b on lists
-- Swaps: term <-> translation on flashcards

CREATE OR REPLACE FUNCTION public.swap_list_sides(_list_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list RECORD;
  v_cards_affected integer;
BEGIN
  -- Get list and check permissions
  SELECT l.*, t.owner_teacher_id
  INTO v_list
  FROM public.lists l
  LEFT JOIN public.turmas t ON t.id = l.class_id
  WHERE l.id = _list_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_FOUND',
      'message', 'Lista não encontrada.'
    );
  END IF;

  -- Check permission: must be list owner OR turma owner (if list belongs to a turma)
  IF v_list.owner_id != auth.uid() THEN
    -- Check if list belongs to a turma and user is the turma owner
    IF v_list.class_id IS NULL OR v_list.owner_teacher_id != auth.uid() THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'PERMISSION_DENIED',
        'message', 'Você não tem permissão para inverter esta lista.'
      );
    END IF;
  END IF;

  -- Swap list language/label fields atomically
  UPDATE public.lists
  SET 
    lang_a = v_list.lang_b,
    lang_b = v_list.lang_a,
    labels_a = v_list.labels_b,
    labels_b = v_list.labels_a,
    updated_at = now()
  WHERE id = _list_id;

  -- Swap flashcard term <-> translation atomically
  -- PostgreSQL evaluates SET values from the OLD row, so this is safe
  UPDATE public.flashcards
  SET 
    term = translation,
    translation = term,
    updated_at = now()
  WHERE list_id = _list_id;

  GET DIAGNOSTICS v_cards_affected = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'cards_swapped', v_cards_affected,
    'message', format('A/B invertidos! %s cards atualizados.', v_cards_affected)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'INTERNAL_ERROR',
    'message', 'Erro ao inverter A/B. Tente novamente.'
  );
END;
$$;