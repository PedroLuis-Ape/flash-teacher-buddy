-- Add every playable flashcard in one owned list to the authenticated user's
-- Special queue. Standalone cards are inserted once; layered-card children are
-- inserted individually; principal/aggregator rows are excluded.
CREATE OR REPLACE FUNCTION public.add_list_flashcards_to_specials(p_list_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_owner uuid;
  v_class_id uuid;
  v_is_class_owner boolean := false;
  v_eligible_count integer := 0;
  v_standalone_count integer := 0;
  v_layer_count integer := 0;
  v_inserted_count integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT l.owner_id, l.class_id
    INTO v_owner, v_class_id
    FROM public.lists l
   WHERE l.id = p_list_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'LIST_NOT_FOUND');
  END IF;

  IF v_owner <> v_user THEN
    IF v_class_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
          FROM public.turmas t
         WHERE t.id = v_class_id
           AND t.owner_teacher_id = v_user
      ) INTO v_is_class_owner;
    END IF;

    IF NOT v_is_class_owner THEN
      RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED');
    END IF;
  END IF;

  WITH active_cards AS (
    SELECT f.id, f.parent_card_id
      FROM public.flashcards f
     WHERE f.list_id = p_list_id
       AND f.deleted_at IS NULL
  ),
  parent_ids AS (
    SELECT DISTINCT a.parent_card_id AS id
      FROM active_cards a
     WHERE a.parent_card_id IS NOT NULL
  ),
  eligible AS (
    SELECT a.id, a.parent_card_id
      FROM active_cards a
     WHERE a.parent_card_id IS NOT NULL
        OR NOT EXISTS (SELECT 1 FROM parent_ids p WHERE p.id = a.id)
  ),
  counts AS (
    SELECT count(*)::integer AS eligible_count,
           count(*) FILTER (WHERE parent_card_id IS NULL)::integer AS standalone_count,
           count(*) FILTER (WHERE parent_card_id IS NOT NULL)::integer AS layer_count
      FROM eligible
  ),
  inserted AS (
    INSERT INTO public.user_special_flashcards (user_id, flashcard_id, list_id)
    SELECT v_user, e.id, p_list_id
      FROM eligible e
    ON CONFLICT (user_id, flashcard_id) DO NOTHING
    RETURNING flashcard_id
  )
  SELECT c.eligible_count,
         c.standalone_count,
         c.layer_count,
         (SELECT count(*)::integer FROM inserted)
    INTO v_eligible_count, v_standalone_count, v_layer_count, v_inserted_count
    FROM counts c;

  RETURN jsonb_build_object(
    'success', true,
    'eligible_count', v_eligible_count,
    'already_special_count', v_eligible_count - v_inserted_count,
    'inserted_count', v_inserted_count,
    'standalone_count', v_standalone_count,
    'layer_count', v_layer_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_list_flashcards_to_specials(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_list_flashcards_to_specials(uuid) TO authenticated;

COMMENT ON FUNCTION public.add_list_flashcards_to_specials(uuid) IS
  'Adds all playable units from one owned list to the current user Special queue, excluding layered-card aggregator rows.';
