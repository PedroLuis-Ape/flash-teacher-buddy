-- 1) Add deleted_at to folders, lists, flashcards
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.lists ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- 2) Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_folders_deleted_at ON public.folders (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lists_deleted_at ON public.lists (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_flashcards_deleted_at ON public.flashcards (deleted_at) WHERE deleted_at IS NOT NULL;

-- 3) Update get_lists_with_card_counts to exclude soft-deleted items
CREATE OR REPLACE FUNCTION public.get_lists_with_card_counts(_folder_id uuid)
RETURNS TABLE(id uuid, folder_id uuid, owner_id uuid, title text, description text, order_index integer, visibility text, lang text, class_id uuid, institution_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, card_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    l.id, l.folder_id, l.owner_id, l.title, l.description,
    l.order_index, l.visibility, l.lang, l.class_id, l.institution_id,
    l.created_at, l.updated_at,
    COUNT(f.id)::bigint AS card_count
  FROM public.lists l
  LEFT JOIN public.flashcards f ON f.list_id = l.id AND f.deleted_at IS NULL
  WHERE l.folder_id = _folder_id AND l.deleted_at IS NULL
  GROUP BY l.id
  ORDER BY l.order_index ASC, l.created_at ASC;
$$;

-- 4) Update portal functions to exclude soft-deleted
CREATE OR REPLACE FUNCTION public.get_portal_lists_with_counts(_folder_id uuid)
RETURNS TABLE(id uuid, folder_id uuid, owner_id uuid, title text, description text, order_index integer, visibility text, lang text, class_id uuid, institution_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, card_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    l.id, l.folder_id, l.owner_id, l.title, l.description,
    l.order_index, l.visibility, l.lang, l.class_id, l.institution_id,
    l.created_at, l.updated_at,
    COUNT(fc.id)::bigint AS card_count
  FROM public.lists l
  JOIN public.folders fld ON fld.id = l.folder_id
  JOIN public.profiles p ON p.id = fld.owner_id
  LEFT JOIN public.flashcards fc ON fc.list_id = l.id AND fc.deleted_at IS NULL
  WHERE l.folder_id = _folder_id
    AND l.deleted_at IS NULL
    AND fld.visibility = 'class'
    AND fld.deleted_at IS NULL
    AND COALESCE(p.public_access_enabled, false) = true
  GROUP BY l.id
  ORDER BY l.order_index ASC, l.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_portal_lists(_folder_id uuid)
RETURNS SETOF lists
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select l.*
  from public.lists l
  join public.folders f on f.id = l.folder_id
  join public.profiles p on p.id = f.owner_id
  where l.folder_id = _folder_id
    and l.deleted_at IS NULL
    and f.visibility = 'class'
    and f.deleted_at IS NULL
    and coalesce(p.public_access_enabled, false) = true
  order by l.order_index asc, l.created_at asc;
$$;

CREATE OR REPLACE FUNCTION public.get_portal_folders()
RETURNS SETOF folders
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select f.*
  from public.folders f
  join public.profiles p on p.id = f.owner_id
  where f.visibility = 'class'
    and f.deleted_at IS NULL
    and coalesce(p.public_access_enabled, false) = true
  order by f.created_at desc;
$$;

CREATE OR REPLACE FUNCTION public.get_portal_flashcards(_list_id uuid)
RETURNS SETOF flashcards
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT fc.*
  FROM public.flashcards fc
  JOIN public.lists l ON l.id = fc.list_id
  JOIN public.folders f ON f.id = l.folder_id
  JOIN public.profiles p ON p.id = f.owner_id
  WHERE fc.list_id = _list_id
    AND fc.deleted_at IS NULL
    AND l.deleted_at IS NULL
    AND f.visibility = 'class'
    AND f.deleted_at IS NULL
    AND COALESCE(p.public_access_enabled, false) = true
  ORDER BY fc.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_portal_counts(_folder_id uuid)
RETURNS TABLE(list_count integer, card_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select
    (
      select count(*)
      from public.lists l
      join public.folders f on f.id = l.folder_id
      join public.profiles p on p.id = f.owner_id
      where l.folder_id = _folder_id
        and l.deleted_at IS NULL
        and f.visibility = 'class'
        and f.deleted_at IS NULL
        and coalesce(p.public_access_enabled, false) = true
    )::int as list_count,
    (
      select count(*)
      from public.flashcards fc
      join public.lists l on l.id = fc.list_id
      join public.folders f on f.id = l.folder_id
      join public.profiles p on p.id = f.owner_id
      where l.folder_id = _folder_id
        and fc.deleted_at IS NULL
        and l.deleted_at IS NULL
        and f.visibility = 'class'
        and f.deleted_at IS NULL
        and coalesce(p.public_access_enabled, false) = true
    )::int as card_count;
$$;

-- 5) Function to soft-delete a folder and its children
CREATE OR REPLACE FUNCTION public.soft_delete_folder(p_folder_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  -- Verify ownership
  IF NOT EXISTS (SELECT 1 FROM public.folders WHERE id = p_folder_id AND owner_id = p_user_id AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  -- Soft delete flashcards in lists of this folder
  UPDATE public.flashcards SET deleted_at = v_now
  WHERE list_id IN (SELECT id FROM public.lists WHERE folder_id = p_folder_id AND deleted_at IS NULL)
    AND deleted_at IS NULL;

  -- Soft delete lists in this folder
  UPDATE public.lists SET deleted_at = v_now
  WHERE folder_id = p_folder_id AND deleted_at IS NULL;

  -- Soft delete folder
  UPDATE public.folders SET deleted_at = v_now WHERE id = p_folder_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 6) Function to soft-delete a list and its flashcards
CREATE OR REPLACE FUNCTION public.soft_delete_list(p_list_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lists WHERE id = p_list_id AND owner_id = p_user_id AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  UPDATE public.flashcards SET deleted_at = v_now
  WHERE list_id = p_list_id AND deleted_at IS NULL;

  UPDATE public.lists SET deleted_at = v_now WHERE id = p_list_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 7) Function to restore a folder and its children
CREATE OR REPLACE FUNCTION public.restore_folder(p_folder_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.folders WHERE id = p_folder_id AND owner_id = p_user_id AND deleted_at IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  UPDATE public.folders SET deleted_at = NULL WHERE id = p_folder_id;
  UPDATE public.lists SET deleted_at = NULL WHERE folder_id = p_folder_id AND deleted_at IS NOT NULL;
  UPDATE public.flashcards SET deleted_at = NULL
  WHERE list_id IN (SELECT id FROM public.lists WHERE folder_id = p_folder_id)
    AND deleted_at IS NOT NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 8) Function to restore a list and its flashcards
CREATE OR REPLACE FUNCTION public.restore_list(p_list_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_folder_id uuid;
BEGIN
  SELECT folder_id INTO v_folder_id FROM public.lists WHERE id = p_list_id AND owner_id = p_user_id AND deleted_at IS NOT NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  -- If parent folder is also deleted, restore it too
  UPDATE public.folders SET deleted_at = NULL WHERE id = v_folder_id AND deleted_at IS NOT NULL;

  UPDATE public.lists SET deleted_at = NULL WHERE id = p_list_id;
  UPDATE public.flashcards SET deleted_at = NULL WHERE list_id = p_list_id AND deleted_at IS NOT NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 9) Function to restore a flashcard
CREATE OR REPLACE FUNCTION public.restore_flashcard(p_flashcard_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_list_id uuid;
  v_folder_id uuid;
BEGIN
  SELECT list_id INTO v_list_id FROM public.flashcards WHERE id = p_flashcard_id AND user_id = p_user_id AND deleted_at IS NOT NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  -- Restore parent list and folder if needed
  SELECT folder_id INTO v_folder_id FROM public.lists WHERE id = v_list_id;
  UPDATE public.folders SET deleted_at = NULL WHERE id = v_folder_id AND deleted_at IS NOT NULL;
  UPDATE public.lists SET deleted_at = NULL WHERE id = v_list_id AND deleted_at IS NOT NULL;

  UPDATE public.flashcards SET deleted_at = NULL WHERE id = p_flashcard_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 10) Function to permanently delete expired trash items
CREATE OR REPLACE FUNCTION public.purge_expired_trash()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fc integer;
  v_lists integer;
  v_folders integer;
BEGIN
  DELETE FROM public.flashcards WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '7 days';
  GET DIAGNOSTICS v_fc = ROW_COUNT;

  DELETE FROM public.lists WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '7 days';
  GET DIAGNOSTICS v_lists = ROW_COUNT;

  DELETE FROM public.folders WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '7 days';
  GET DIAGNOSTICS v_folders = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'purged_flashcards', v_fc,
    'purged_lists', v_lists,
    'purged_folders', v_folders
  );
END;
$$;