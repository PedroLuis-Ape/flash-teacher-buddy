
-- =========================================================================
-- Clara Master — Fase 7: merge / unmerge transacional com transferência de
-- status (favorito + lista vermelha) entre grupos.
-- Aditivo: nenhuma função existente é alterada.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.merge_flashcard_into_group(
  p_child_id uuid,
  p_parent_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old_group uuid;
  v_new_group uuid;
  v_owner_child uuid;
  v_owner_parent uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_child_id IS NULL OR p_parent_id IS NULL OR p_child_id = p_parent_id THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  -- Both rows must exist, both must belong to the caller.
  SELECT user_id, status_group_uid INTO v_owner_child, v_old_group
    FROM public.flashcards WHERE id = p_child_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'child_not_found' USING ERRCODE = '23503';
  END IF;
  SELECT user_id, status_group_uid INTO v_owner_parent, v_new_group
    FROM public.flashcards WHERE id = p_parent_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'parent_not_found' USING ERRCODE = '23503';
  END IF;
  IF v_owner_child <> v_uid OR v_owner_parent <> v_uid THEN
    RAISE EXCEPTION 'not_owner' USING ERRCODE = '42501';
  END IF;

  -- Move the child. The Phase-2 BEFORE-UPDATE trigger recomputes
  -- status_group_uid because parent_card_id is changing.
  UPDATE public.flashcards
     SET parent_card_id = p_parent_id
   WHERE id = p_child_id;

  -- If the child's old group had per-user status, merge it into the new
  -- group's status (logical OR), then drop the orphan row.
  IF v_old_group IS NOT NULL AND v_old_group <> v_new_group THEN
    WITH old_status AS (
      SELECT is_favorite, is_red_list
        FROM public.user_flashcard_group_status
       WHERE user_id = v_uid AND status_group_uid = v_old_group
       FOR UPDATE
    ),
    new_merged AS (
      SELECT
        COALESCE((SELECT is_favorite FROM old_status), false) AS old_fav,
        COALESCE((SELECT is_red_list FROM old_status), false) AS old_red
    )
    INSERT INTO public.user_flashcard_group_status AS u
      (user_id, status_group_uid, is_favorite, is_red_list, last_operation_id)
    SELECT
      v_uid,
      v_new_group,
      new_merged.old_fav,
      (new_merged.old_red AND new_merged.old_fav),
      gen_random_uuid()
    FROM new_merged
    WHERE new_merged.old_fav OR new_merged.old_red
    ON CONFLICT (user_id, status_group_uid) DO UPDATE
      SET is_favorite = u.is_favorite OR EXCLUDED.is_favorite,
          is_red_list = (u.is_red_list OR EXCLUDED.is_red_list)
                        AND (u.is_favorite OR EXCLUDED.is_favorite),
          updated_at  = now();

    -- Old group is now empty for this user (the child moved out and there
    -- are no other holders of that uid). Only delete if no other flashcard
    -- still points to v_old_group; otherwise leave it.
    IF NOT EXISTS (
      SELECT 1 FROM public.flashcards
       WHERE status_group_uid = v_old_group
    ) THEN
      DELETE FROM public.user_flashcard_group_status
       WHERE user_id = v_uid AND status_group_uid = v_old_group;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'child_id', p_child_id,
    'new_status_group_uid', v_new_group,
    'previous_status_group_uid', v_old_group
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_flashcard_into_group(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_flashcard_into_group(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_flashcard_into_group(uuid, uuid) TO service_role;


CREATE OR REPLACE FUNCTION public.unmerge_flashcard_from_group(
  p_card_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old_group uuid;
  v_owner uuid;
  v_parent uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_card_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  SELECT user_id, status_group_uid, parent_card_id
    INTO v_owner, v_old_group, v_parent
    FROM public.flashcards WHERE id = p_card_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'card_not_found' USING ERRCODE = '23503';
  END IF;
  IF v_owner <> v_uid THEN
    RAISE EXCEPTION 'not_owner' USING ERRCODE = '42501';
  END IF;
  IF v_parent IS NULL THEN
    -- Already its own group, nothing to do.
    RETURN jsonb_build_object('success', true, 'no_op', true);
  END IF;

  -- Detach the card. Trigger from Phase 2 will set status_group_uid = id.
  UPDATE public.flashcards
     SET parent_card_id = NULL
   WHERE id = p_card_id;

  -- Copy the old group's status onto the new group so the user does not
  -- silently lose Favorite/Red List after unmerge.
  INSERT INTO public.user_flashcard_group_status
    (user_id, status_group_uid, is_favorite, is_red_list, last_operation_id)
  SELECT v_uid, p_card_id, s.is_favorite, s.is_red_list, gen_random_uuid()
    FROM public.user_flashcard_group_status s
   WHERE s.user_id = v_uid AND s.status_group_uid = v_old_group
  ON CONFLICT (user_id, status_group_uid) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'card_id', p_card_id,
    'new_status_group_uid', p_card_id,
    'previous_status_group_uid', v_old_group
  );
END;
$$;

REVOKE ALL ON FUNCTION public.unmerge_flashcard_from_group(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unmerge_flashcard_from_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unmerge_flashcard_from_group(uuid) TO service_role;
