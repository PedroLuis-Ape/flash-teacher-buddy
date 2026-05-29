-- Bulk soft delete RPCs for lists and folders
-- Both validate ownership and operate in single set-based statements.

CREATE OR REPLACE FUNCTION public.bulk_soft_delete_lists(
  p_list_ids uuid[],
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamptz := now();
  v_valid_ids uuid[];
  v_deleted_lists int := 0;
  v_deleted_cards int := 0;
  v_input_count int := COALESCE(array_length(p_list_ids, 1), 0);
BEGIN
  IF p_user_id IS NULL OR v_input_count = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'deleted_lists_count', 0,
      'deleted_cards_count', 0,
      'skipped_count', v_input_count
    );
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_valid_ids
  FROM public.lists
  WHERE id = ANY(p_list_ids)
    AND owner_id = p_user_id
    AND deleted_at IS NULL;

  IF COALESCE(array_length(v_valid_ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'deleted_lists_count', 0,
      'deleted_cards_count', 0,
      'skipped_count', v_input_count
    );
  END IF;

  UPDATE public.flashcards SET deleted_at = v_now
  WHERE list_id = ANY(v_valid_ids) AND deleted_at IS NULL;
  GET DIAGNOSTICS v_deleted_cards = ROW_COUNT;

  UPDATE public.lists SET deleted_at = v_now
  WHERE id = ANY(v_valid_ids) AND deleted_at IS NULL;
  GET DIAGNOSTICS v_deleted_lists = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_lists_count', v_deleted_lists,
    'deleted_cards_count', v_deleted_cards,
    'skipped_count', v_input_count - v_deleted_lists
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_soft_delete_folders(
  p_folder_ids uuid[],
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamptz := now();
  v_valid_folder_ids uuid[];
  v_list_ids uuid[];
  v_deleted_folders int := 0;
  v_deleted_lists int := 0;
  v_deleted_cards int := 0;
  v_input_count int := COALESCE(array_length(p_folder_ids, 1), 0);
BEGIN
  IF p_user_id IS NULL OR v_input_count = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'deleted_folders_count', 0,
      'deleted_lists_count', 0,
      'deleted_cards_count', 0,
      'skipped_count', v_input_count
    );
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_valid_folder_ids
  FROM public.folders
  WHERE id = ANY(p_folder_ids)
    AND owner_id = p_user_id
    AND deleted_at IS NULL;

  IF COALESCE(array_length(v_valid_folder_ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'deleted_folders_count', 0,
      'deleted_lists_count', 0,
      'deleted_cards_count', 0,
      'skipped_count', v_input_count
    );
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_list_ids
  FROM public.lists
  WHERE folder_id = ANY(v_valid_folder_ids) AND deleted_at IS NULL;

  IF COALESCE(array_length(v_list_ids, 1), 0) > 0 THEN
    UPDATE public.flashcards SET deleted_at = v_now
    WHERE list_id = ANY(v_list_ids) AND deleted_at IS NULL;
    GET DIAGNOSTICS v_deleted_cards = ROW_COUNT;

    UPDATE public.lists SET deleted_at = v_now
    WHERE id = ANY(v_list_ids) AND deleted_at IS NULL;
    GET DIAGNOSTICS v_deleted_lists = ROW_COUNT;
  END IF;

  UPDATE public.folders SET deleted_at = v_now
  WHERE id = ANY(v_valid_folder_ids) AND deleted_at IS NULL;
  GET DIAGNOSTICS v_deleted_folders = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_folders_count', v_deleted_folders,
    'deleted_lists_count', v_deleted_lists,
    'deleted_cards_count', v_deleted_cards,
    'skipped_count', v_input_count - v_deleted_folders
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_soft_delete_lists(uuid[], uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bulk_soft_delete_folders(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_soft_delete_lists(uuid[], uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bulk_soft_delete_folders(uuid[], uuid) TO authenticated, service_role;