-- Stable layered-card identity v1.
-- Additive and safe to apply after the original status_group_uid migration.
-- Existing non-null identities are preserved so existing Favorite/Red List
-- rows keep pointing to the same groups. Only missing identities are filled.
BEGIN;

UPDATE public.flashcards
   SET status_group_uid = gen_random_uuid()
 WHERE status_group_uid IS NULL
   AND parent_card_id IS NULL;

UPDATE public.flashcards AS child
   SET status_group_uid = COALESCE(parent.status_group_uid, child.parent_card_id)
  FROM public.flashcards AS parent
 WHERE child.status_group_uid IS NULL
   AND child.parent_card_id = parent.id;

UPDATE public.flashcards
   SET status_group_uid = COALESCE(status_group_uid, gen_random_uuid())
 WHERE status_group_uid IS NULL;

CREATE OR REPLACE FUNCTION public.flashcards_sync_status_group_uid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_status_group_uid uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.parent_card_id IS NOT NULL THEN
      SELECT status_group_uid
        INTO parent_status_group_uid
        FROM public.flashcards
       WHERE id = NEW.parent_card_id;
      NEW.status_group_uid := COALESCE(parent_status_group_uid, NEW.status_group_uid, NEW.parent_card_id, gen_random_uuid());
    ELSE
      NEW.status_group_uid := COALESCE(NEW.status_group_uid, gen_random_uuid());
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.parent_card_id IS DISTINCT FROM OLD.parent_card_id THEN
    IF NEW.parent_card_id IS NULL THEN
      -- Unmerging creates a new standalone group identity. The unmerge RPC
      -- transfers the previous Favorite/Red List state explicitly.
      NEW.status_group_uid := gen_random_uuid();
    ELSE
      SELECT status_group_uid
        INTO parent_status_group_uid
        FROM public.flashcards
       WHERE id = NEW.parent_card_id;
      NEW.status_group_uid := COALESCE(parent_status_group_uid, NEW.parent_card_id, gen_random_uuid());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flashcards_sync_status_group_uid ON public.flashcards;
CREATE TRIGGER trg_flashcards_sync_status_group_uid
  BEFORE INSERT OR UPDATE OF parent_card_id ON public.flashcards
  FOR EACH ROW
  EXECUTE FUNCTION public.flashcards_sync_status_group_uid();

COMMENT ON COLUMN public.flashcards.status_group_uid IS
  'Stable status-group identity used by Favorite/Red List. Existing identities are preserved; new standalone groups receive UUIDs, and merge/unmerge transitions are handled by the transactional RPCs.';

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
  v_new_group uuid;
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
    FROM public.flashcards
   WHERE id = p_card_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'card_not_found' USING ERRCODE = '23503';
  END IF;
  IF v_owner <> v_uid THEN
    RAISE EXCEPTION 'not_owner' USING ERRCODE = '42501';
  END IF;
  IF v_parent IS NULL THEN
    RETURN jsonb_build_object('success', true, 'no_op', true, 'status_group_uid', v_old_group);
  END IF;

  UPDATE public.flashcards
     SET parent_card_id = NULL
   WHERE id = p_card_id
   RETURNING status_group_uid INTO v_new_group;

  INSERT INTO public.user_flashcard_group_status
    (user_id, status_group_uid, is_favorite, is_red_list, last_operation_id)
  SELECT v_uid, v_new_group, s.is_favorite, s.is_red_list, gen_random_uuid()
    FROM public.user_flashcard_group_status AS s
   WHERE s.user_id = v_uid
     AND s.status_group_uid = v_old_group
  ON CONFLICT (user_id, status_group_uid) DO UPDATE
    SET is_favorite = public.user_flashcard_group_status.is_favorite OR EXCLUDED.is_favorite,
        is_red_list = public.user_flashcard_group_status.is_red_list OR EXCLUDED.is_red_list,
        last_operation_id = EXCLUDED.last_operation_id,
        updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'card_id', p_card_id,
    'new_status_group_uid', v_new_group,
    'previous_status_group_uid', v_old_group
  );
END;
$$;

REVOKE ALL ON FUNCTION public.unmerge_flashcard_from_group(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unmerge_flashcard_from_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unmerge_flashcard_from_group(uuid) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
