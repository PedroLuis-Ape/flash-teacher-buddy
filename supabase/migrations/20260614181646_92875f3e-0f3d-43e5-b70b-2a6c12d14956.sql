-- =====================================================================
-- CLARA MASTER P0 — Layered Favorites Cold Restart
-- =====================================================================

-- 1) Server-side RPC: scoped favorites returning CANONICAL group_id.
CREATE OR REPLACE FUNCTION public.get_scoped_flashcard_favorites(
  p_list_id        uuid DEFAULT NULL,
  p_collection_id  uuid DEFAULT NULL,
  p_folder_id      uuid DEFAULT NULL,
  p_institution_id uuid DEFAULT NULL
)
RETURNS TABLE (group_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_scopes  int  := (CASE WHEN p_list_id IS NOT NULL THEN 1 ELSE 0 END)
                  + (CASE WHEN p_collection_id IS NOT NULL THEN 1 ELSE 0 END)
                  + (CASE WHEN p_folder_id IS NOT NULL THEN 1 ELSE 0 END)
                  + (CASE WHEN p_institution_id IS NOT NULL THEN 1 ELSE 0 END);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF v_scopes <> 1 THEN
    RAISE EXCEPTION 'exactly one scope must be provided' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH scope_lists AS (
    SELECT l.id
    FROM public.lists l
    WHERE l.deleted_at IS NULL
      AND (
        (p_list_id IS NOT NULL AND l.id = p_list_id) OR
        (p_folder_id IS NOT NULL AND l.folder_id = p_folder_id) OR
        (p_institution_id IS NOT NULL AND l.institution_id = p_institution_id)
      )
  ),
  scope_cards AS (
    -- Every flashcard alive in the requested scope (principal + layers).
    SELECT f.id, f.parent_card_id
    FROM public.flashcards f
    WHERE f.deleted_at IS NULL
      AND (
        (p_collection_id IS NOT NULL AND f.collection_id = p_collection_id)
        OR (p_collection_id IS NULL AND f.list_id IN (SELECT id FROM scope_lists))
      )
  ),
  scope_groups AS (
    -- Canonical group id of each card in scope. Layered → parent, else self.
    SELECT DISTINCT COALESCE(sc.parent_card_id, sc.id) AS group_id
    FROM scope_cards sc
  ),
  user_fav_groups AS (
    -- Group id of every favorite the user has on a still-existing flashcard
    -- (covers both canonical writes and legacy per-layer writes).
    SELECT DISTINCT COALESCE(f.parent_card_id, f.id) AS group_id
    FROM public.user_favorites uf
    JOIN public.flashcards f ON f.id = uf.resource_id
    WHERE uf.user_id = v_user_id
      AND uf.resource_type = 'flashcard'
      AND f.deleted_at IS NULL
  )
  SELECT sg.group_id
  FROM scope_groups sg
  JOIN user_fav_groups ufg USING (group_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_scoped_flashcard_favorites(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_scoped_flashcard_favorites(uuid, uuid, uuid, uuid) TO authenticated;

-- 2) Server-side RPC: scoped red list returning CANONICAL group_id.
CREATE OR REPLACE FUNCTION public.get_scoped_flashcard_red_list(
  p_list_id        uuid DEFAULT NULL,
  p_collection_id  uuid DEFAULT NULL,
  p_folder_id      uuid DEFAULT NULL,
  p_institution_id uuid DEFAULT NULL
)
RETURNS TABLE (group_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_scopes  int  := (CASE WHEN p_list_id IS NOT NULL THEN 1 ELSE 0 END)
                  + (CASE WHEN p_collection_id IS NOT NULL THEN 1 ELSE 0 END)
                  + (CASE WHEN p_folder_id IS NOT NULL THEN 1 ELSE 0 END)
                  + (CASE WHEN p_institution_id IS NOT NULL THEN 1 ELSE 0 END);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF v_scopes <> 1 THEN
    RAISE EXCEPTION 'exactly one scope must be provided' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH scope_lists AS (
    SELECT l.id
    FROM public.lists l
    WHERE l.deleted_at IS NULL
      AND (
        (p_list_id IS NOT NULL AND l.id = p_list_id) OR
        (p_folder_id IS NOT NULL AND l.folder_id = p_folder_id) OR
        (p_institution_id IS NOT NULL AND l.institution_id = p_institution_id)
      )
  ),
  scope_cards AS (
    SELECT f.id, f.parent_card_id
    FROM public.flashcards f
    WHERE f.deleted_at IS NULL
      AND (
        (p_collection_id IS NOT NULL AND f.collection_id = p_collection_id)
        OR (p_collection_id IS NULL AND f.list_id IN (SELECT id FROM scope_lists))
      )
  ),
  scope_groups AS (
    SELECT DISTINCT COALESCE(sc.parent_card_id, sc.id) AS group_id
    FROM scope_cards sc
  ),
  user_red_groups AS (
    SELECT DISTINCT COALESCE(f.parent_card_id, f.id) AS group_id
    FROM public.user_red_list ur
    JOIN public.flashcards f ON f.id = ur.flashcard_id
    WHERE ur.user_id = v_user_id
      AND f.deleted_at IS NULL
  )
  SELECT sg.group_id
  FROM scope_groups sg
  JOIN user_red_groups urg USING (group_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_scoped_flashcard_red_list(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_scoped_flashcard_red_list(uuid, uuid, uuid, uuid) TO authenticated;

-- 3) Audit report table.
CREATE TABLE IF NOT EXISTS public.clara_favorites_backfill_report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  favorites_principal_inserted int NOT NULL,
  favorites_layer_deleted int NOT NULL,
  favorites_orphan_deleted int NOT NULL,
  red_principal_inserted int NOT NULL,
  red_layer_deleted int NOT NULL
);
GRANT SELECT ON public.clara_favorites_backfill_report TO authenticated;
GRANT ALL ON public.clara_favorites_backfill_report TO service_role;
ALTER TABLE public.clara_favorites_backfill_report ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "report readable by developer admins" ON public.clara_favorites_backfill_report;
CREATE POLICY "report readable by developer admins"
  ON public.clara_favorites_backfill_report
  FOR SELECT TO authenticated
  USING (public.is_developer_admin(auth.uid()));

-- 4) Backfill: layer-favorites → principal, idempotent and non-destructive.
DO $$
DECLARE
  v_fav_in   int := 0;
  v_fav_del  int := 0;
  v_fav_orph int := 0;
  v_red_in   int := 0;
  v_red_del  int := 0;
BEGIN
  -- 4a) Insert principal favorite for every layer-favorite (ON CONFLICT skip).
  WITH layer_favs AS (
    SELECT uf.user_id, f.parent_card_id AS principal_id
    FROM public.user_favorites uf
    JOIN public.flashcards f ON f.id = uf.resource_id
    WHERE uf.resource_type = 'flashcard'
      AND f.parent_card_id IS NOT NULL
  ),
  inserted AS (
    INSERT INTO public.user_favorites (user_id, resource_type, resource_id)
    SELECT user_id, 'flashcard', principal_id
    FROM layer_favs
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_fav_in FROM inserted;

  -- 4b) Delete layer-favorite rows now that the principal is guaranteed to exist.
  WITH deletable AS (
    SELECT uf.ctid
    FROM public.user_favorites uf
    JOIN public.flashcards f ON f.id = uf.resource_id
    JOIN public.user_favorites uf_principal
      ON uf_principal.user_id = uf.user_id
     AND uf_principal.resource_type = 'flashcard'
     AND uf_principal.resource_id = f.parent_card_id
    WHERE uf.resource_type = 'flashcard'
      AND f.parent_card_id IS NOT NULL
  )
  DELETE FROM public.user_favorites uf
  USING deletable d
  WHERE uf.ctid = d.ctid;
  GET DIAGNOSTICS v_fav_del = ROW_COUNT;

  -- 4c) Delete orphan favorites (resource_id no longer exists in flashcards).
  WITH orph AS (
    SELECT uf.ctid
    FROM public.user_favorites uf
    LEFT JOIN public.flashcards f ON f.id = uf.resource_id
    WHERE uf.resource_type = 'flashcard'
      AND f.id IS NULL
  )
  DELETE FROM public.user_favorites uf
  USING orph
  WHERE uf.ctid = orph.ctid;
  GET DIAGNOSTICS v_fav_orph = ROW_COUNT;

  -- 4d) Same backfill for red list (defensive — currently zero rows in layers).
  WITH layer_red AS (
    SELECT ur.user_id, f.parent_card_id AS principal_id
    FROM public.user_red_list ur
    JOIN public.flashcards f ON f.id = ur.flashcard_id
    WHERE f.parent_card_id IS NOT NULL
  ),
  inserted_red AS (
    INSERT INTO public.user_red_list (user_id, flashcard_id)
    SELECT user_id, principal_id
    FROM layer_red
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_red_in FROM inserted_red;

  WITH deletable_red AS (
    SELECT ur.ctid
    FROM public.user_red_list ur
    JOIN public.flashcards f ON f.id = ur.flashcard_id
    JOIN public.user_red_list ur_principal
      ON ur_principal.user_id = ur.user_id
     AND ur_principal.flashcard_id = f.parent_card_id
    WHERE f.parent_card_id IS NOT NULL
  )
  DELETE FROM public.user_red_list ur
  USING deletable_red d
  WHERE ur.ctid = d.ctid;
  GET DIAGNOSTICS v_red_del = ROW_COUNT;

  INSERT INTO public.clara_favorites_backfill_report (
    favorites_principal_inserted, favorites_layer_deleted, favorites_orphan_deleted,
    red_principal_inserted, red_layer_deleted
  )
  VALUES (v_fav_in, v_fav_del, v_fav_orph, v_red_in, v_red_del);
END $$;