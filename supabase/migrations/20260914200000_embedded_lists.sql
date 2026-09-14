BEGIN;

-- Combined/embedded lists are virtual study resources. They never clone or move
-- flashcards: membership points at the canonical root flashcard row.
CREATE TABLE IF NOT EXISTS public.embedded_lists (
  list_id uuid PRIMARY KEY REFERENCES public.lists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.embedded_list_cards (
  embedded_list_id uuid NOT NULL REFERENCES public.embedded_lists(list_id) ON DELETE CASCADE,
  flashcard_id uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  source_list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE RESTRICT,
  embedded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (embedded_list_id, flashcard_id)
);

CREATE INDEX IF NOT EXISTS idx_embedded_list_cards_source
  ON public.embedded_list_cards(embedded_list_id, source_list_id);
CREATE INDEX IF NOT EXISTS idx_embedded_list_cards_flashcard
  ON public.embedded_list_cards(flashcard_id);

ALTER TABLE public.embedded_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embedded_list_cards ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.embedded_lists FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.embedded_list_cards FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.embedded_lists TO authenticated;
GRANT SELECT ON TABLE public.embedded_list_cards TO authenticated;
GRANT ALL ON TABLE public.embedded_lists TO service_role;
GRANT ALL ON TABLE public.embedded_list_cards TO service_role;

DROP POLICY IF EXISTS embedded_lists_select_own ON public.embedded_lists;
CREATE POLICY embedded_lists_select_own
ON public.embedded_lists
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.lists list_row
    WHERE list_row.id = embedded_lists.list_id
      AND list_row.owner_id = (SELECT auth.uid())
      AND list_row.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS embedded_list_cards_select_own ON public.embedded_list_cards;
CREATE POLICY embedded_list_cards_select_own
ON public.embedded_list_cards
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.lists list_row
    WHERE list_row.id = embedded_list_cards.embedded_list_id
      AND list_row.owner_id = (SELECT auth.uid())
      AND list_row.deleted_at IS NULL
  )
);

-- Mutations are RPC-only. This helper is intentionally not granted to clients.
CREATE OR REPLACE FUNCTION public.require_owned_embedded_list(_embedded_list_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_folder_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT list_row.folder_id
    INTO v_folder_id
  FROM public.lists list_row
  JOIN public.embedded_lists embedded
    ON embedded.list_id = list_row.id
  WHERE list_row.id = _embedded_list_id
    AND list_row.owner_id = auth.uid()
    AND list_row.deleted_at IS NULL
    AND COALESCE(list_row.system_kind, 'user') = 'user';

  IF v_folder_id IS NULL THEN
    RAISE EXCEPTION 'Embedded list not found or not owned by current user'
      USING ERRCODE = '42501';
  END IF;

  RETURN v_folder_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.embed_source_lists(
  _embedded_list_id uuid,
  _source_list_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_folder_id uuid;
  v_sources uuid[];
  v_source_count integer := 0;
  v_valid_sources integer := 0;
  v_requested integer := 0;
  v_added integer := 0;
BEGIN
  v_folder_id := public.require_owned_embedded_list(_embedded_list_id);

  SELECT COALESCE(array_agg(source_id ORDER BY source_id), '{}'::uuid[])
    INTO v_sources
  FROM (
    SELECT DISTINCT source_id
    FROM unnest(COALESCE(_source_list_ids, '{}'::uuid[])) AS source_ids(source_id)
    WHERE source_id IS NOT NULL
  ) deduped;

  v_source_count := cardinality(v_sources);
  IF v_source_count = 0 THEN
    RETURN jsonb_build_object('requested', 0, 'added', 0, 'already_present', 0);
  END IF;

  SELECT count(*)::integer
    INTO v_valid_sources
  FROM public.lists source_list
  WHERE source_list.id = ANY(v_sources)
    AND source_list.folder_id = v_folder_id
    AND source_list.owner_id = auth.uid()
    AND source_list.deleted_at IS NULL
    AND COALESCE(source_list.system_kind, 'user') = 'user'
    AND NOT EXISTS (
      SELECT 1 FROM public.embedded_lists source_embedded
      WHERE source_embedded.list_id = source_list.id
    );

  IF v_valid_sources <> v_source_count THEN
    RAISE EXCEPTION 'Every source must be an owned normal list in the same folder'
      USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::integer
    INTO v_requested
  FROM public.flashcards card
  WHERE card.list_id = ANY(v_sources)
    AND card.deleted_at IS NULL
    AND card.parent_card_id IS NULL;

  INSERT INTO public.embedded_list_cards(
    embedded_list_id,
    flashcard_id,
    source_list_id
  )
  SELECT
    _embedded_list_id,
    card.id,
    card.list_id
  FROM public.flashcards card
  WHERE card.list_id = ANY(v_sources)
    AND card.deleted_at IS NULL
    AND card.parent_card_id IS NULL
  ON CONFLICT (embedded_list_id, flashcard_id) DO NOTHING;

  GET DIAGNOSTICS v_added = ROW_COUNT;

  RETURN jsonb_build_object(
    'requested', v_requested,
    'added', v_added,
    'already_present', GREATEST(v_requested - v_added, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.embed_cards(
  _embedded_list_id uuid,
  _flashcard_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_folder_id uuid;
  v_ids uuid[];
  v_requested integer := 0;
  v_valid integer := 0;
  v_added integer := 0;
BEGIN
  v_folder_id := public.require_owned_embedded_list(_embedded_list_id);

  SELECT COALESCE(array_agg(card_id ORDER BY card_id), '{}'::uuid[])
    INTO v_ids
  FROM (
    SELECT DISTINCT card_id
    FROM unnest(COALESCE(_flashcard_ids, '{}'::uuid[])) AS card_ids(card_id)
    WHERE card_id IS NOT NULL
  ) deduped;

  v_requested := cardinality(v_ids);
  IF v_requested = 0 THEN
    RETURN jsonb_build_object('requested', 0, 'added', 0, 'already_present', 0);
  END IF;

  SELECT count(*)::integer
    INTO v_valid
  FROM public.flashcards card
  JOIN public.lists source_list ON source_list.id = card.list_id
  WHERE card.id = ANY(v_ids)
    AND card.deleted_at IS NULL
    AND card.parent_card_id IS NULL
    AND source_list.folder_id = v_folder_id
    AND source_list.owner_id = auth.uid()
    AND source_list.deleted_at IS NULL
    AND COALESCE(source_list.system_kind, 'user') = 'user'
    AND NOT EXISTS (
      SELECT 1 FROM public.embedded_lists source_embedded
      WHERE source_embedded.list_id = source_list.id
    );

  IF v_valid <> v_requested THEN
    RAISE EXCEPTION 'Every card must be a root card from an owned normal list in the same folder'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.embedded_list_cards(
    embedded_list_id,
    flashcard_id,
    source_list_id
  )
  SELECT
    _embedded_list_id,
    card.id,
    card.list_id
  FROM public.flashcards card
  WHERE card.id = ANY(v_ids)
  ON CONFLICT (embedded_list_id, flashcard_id) DO NOTHING;

  GET DIAGNOSTICS v_added = ROW_COUNT;

  RETURN jsonb_build_object(
    'requested', v_requested,
    'added', v_added,
    'already_present', GREATEST(v_requested - v_added, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.unembed_cards(
  _embedded_list_id uuid,
  _flashcard_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_requested integer := 0;
  v_removed integer := 0;
BEGIN
  PERFORM public.require_owned_embedded_list(_embedded_list_id);

  SELECT count(*)::integer
    INTO v_requested
  FROM (
    SELECT DISTINCT card_id
    FROM unnest(COALESCE(_flashcard_ids, '{}'::uuid[])) AS card_ids(card_id)
    WHERE card_id IS NOT NULL
  ) deduped;

  DELETE FROM public.embedded_list_cards membership
  WHERE membership.embedded_list_id = _embedded_list_id
    AND membership.flashcard_id = ANY(COALESCE(_flashcard_ids, '{}'::uuid[]));

  GET DIAGNOSTICS v_removed = ROW_COUNT;
  RETURN jsonb_build_object('requested', v_requested, 'removed', v_removed);
END;
$$;

CREATE OR REPLACE FUNCTION public.unembed_source_list(
  _embedded_list_id uuid,
  _source_list_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_removed integer := 0;
BEGIN
  PERFORM public.require_owned_embedded_list(_embedded_list_id);

  DELETE FROM public.embedded_list_cards membership
  WHERE membership.embedded_list_id = _embedded_list_id
    AND membership.source_list_id = _source_list_id;

  GET DIAGNOSTICS v_removed = ROW_COUNT;
  RETURN jsonb_build_object('removed', v_removed);
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_embedded_list(_embedded_list_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_removed integer := 0;
BEGIN
  PERFORM public.require_owned_embedded_list(_embedded_list_id);

  DELETE FROM public.embedded_list_cards membership
  WHERE membership.embedded_list_id = _embedded_list_id;

  GET DIAGNOSTICS v_removed = ROW_COUNT;
  RETURN jsonb_build_object('removed', v_removed);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_embedded_list(
  _folder_id uuid,
  _title text,
  _description text,
  _source_list_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_list_id uuid;
  v_order_index integer;
  v_embed_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(btrim(COALESCE(_title, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Title is required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.folders folder_row
    WHERE folder_row.id = _folder_id
      AND folder_row.owner_id = auth.uid()
      AND folder_row.deleted_at IS NULL
      AND COALESCE(folder_row.system_kind, 'user') = 'user'
  ) THEN
    RAISE EXCEPTION 'Folder not found or not owned by current user'
      USING ERRCODE = '42501';
  END IF;

  IF cardinality(COALESCE(_source_list_ids, '{}'::uuid[])) = 0 THEN
    RAISE EXCEPTION 'Select at least one source list' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(max(list_row.order_index), -1) + 1
    INTO v_order_index
  FROM public.lists list_row
  WHERE list_row.folder_id = _folder_id
    AND list_row.deleted_at IS NULL;

  INSERT INTO public.lists(
    folder_id,
    owner_id,
    title,
    description,
    order_index,
    visibility,
    system_kind
  )
  VALUES (
    _folder_id,
    auth.uid(),
    btrim(_title),
    NULLIF(btrim(COALESCE(_description, '')), ''),
    v_order_index,
    'private',
    'user'
  )
  RETURNING id INTO v_list_id;

  INSERT INTO public.embedded_lists(list_id) VALUES (v_list_id);

  -- Any invalid source raises inside embed_source_lists and rolls this entire
  -- function call back, including the just-created list.
  v_embed_result := public.embed_source_lists(v_list_id, _source_list_ids);

  RETURN jsonb_build_object(
    'list_id', v_list_id,
    'requested', COALESCE((v_embed_result->>'requested')::integer, 0),
    'added', COALESCE((v_embed_result->>'added')::integer, 0),
    'already_present', COALESCE((v_embed_result->>'already_present')::integer, 0)
  );
END;
$$;

-- Returns canonical card rows (roots plus their layered children). The IDs are
-- never rewritten, so progress and card-linked features remain attached to the
-- original flashcards.
CREATE OR REPLACE FUNCTION public.get_embedded_flashcards(_embedded_list_id uuid)
RETURNS SETOF public.flashcards
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.require_owned_embedded_list(_embedded_list_id);

  RETURN QUERY
  SELECT card_row.*
  FROM public.embedded_list_cards membership
  JOIN public.flashcards root_card
    ON root_card.id = membership.flashcard_id
   AND root_card.deleted_at IS NULL
   AND root_card.parent_card_id IS NULL
  JOIN public.flashcards card_row
    ON (card_row.id = root_card.id OR card_row.parent_card_id = root_card.id)
   AND card_row.deleted_at IS NULL
  WHERE membership.embedded_list_id = _embedded_list_id
  ORDER BY
    membership.embedded_at ASC,
    root_card.created_at ASC,
    root_card.id ASC,
    CASE WHEN card_row.id = root_card.id THEN 0 ELSE 1 END ASC,
    card_row.created_at ASC,
    card_row.id ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_embedded_list_availability(_embedded_list_id uuid)
RETURNS TABLE(resource_exists boolean, raw_count bigint, playable_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exists boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.lists list_row
    JOIN public.embedded_lists embedded ON embedded.list_id = list_row.id
    WHERE list_row.id = _embedded_list_id
      AND list_row.owner_id = auth.uid()
      AND list_row.deleted_at IS NULL
  ) INTO v_exists;

  IF NOT v_exists THEN
    RETURN QUERY SELECT false, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    true,
    count(card_row.id)::bigint,
    count(DISTINCT membership.flashcard_id)::bigint
  FROM public.embedded_list_cards membership
  JOIN public.flashcards root_card
    ON root_card.id = membership.flashcard_id
   AND root_card.deleted_at IS NULL
   AND root_card.parent_card_id IS NULL
  LEFT JOIN public.flashcards card_row
    ON (card_row.id = root_card.id OR card_row.parent_card_id = root_card.id)
   AND card_row.deleted_at IS NULL
  WHERE membership.embedded_list_id = _embedded_list_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_embedded_list_members(_embedded_list_id uuid)
RETURNS TABLE(
  flashcard_id uuid,
  term text,
  definition text,
  source_list_id uuid,
  source_list_title text,
  embedded_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.require_owned_embedded_list(_embedded_list_id);

  RETURN QUERY
  SELECT
    root_card.id,
    root_card.term,
    root_card.definition,
    membership.source_list_id,
    source_list.title,
    membership.embedded_at
  FROM public.embedded_list_cards membership
  JOIN public.flashcards root_card
    ON root_card.id = membership.flashcard_id
   AND root_card.deleted_at IS NULL
   AND root_card.parent_card_id IS NULL
  JOIN public.lists source_list ON source_list.id = membership.source_list_id
  WHERE membership.embedded_list_id = _embedded_list_id
  ORDER BY membership.embedded_at ASC, root_card.created_at ASC, root_card.id ASC;
END;
$$;

-- Keep the folder listing contract canonical: normal lists count their root
-- cards; embedded lists count active referenced root cards.
DROP FUNCTION IF EXISTS public.get_lists_with_card_counts(uuid);
CREATE FUNCTION public.get_lists_with_card_counts(_folder_id uuid)
RETURNS TABLE (
  id uuid,
  folder_id uuid,
  owner_id uuid,
  title text,
  reference_id text,
  description text,
  order_index integer,
  visibility text,
  lang text,
  class_id uuid,
  institution_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  card_count bigint,
  last_activity timestamptz,
  is_embedded boolean,
  source_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    list_row.id,
    list_row.folder_id,
    list_row.owner_id,
    list_row.title,
    list_row.reference_id,
    list_row.description,
    list_row.order_index,
    list_row.visibility,
    list_row.lang,
    list_row.class_id,
    list_row.institution_id,
    list_row.created_at,
    list_row.updated_at,
    CASE
      WHEN embedded.list_id IS NOT NULL THEN (
        SELECT count(*)::bigint
        FROM public.embedded_list_cards membership
        JOIN public.flashcards root_card ON root_card.id = membership.flashcard_id
        WHERE membership.embedded_list_id = list_row.id
          AND root_card.deleted_at IS NULL
          AND root_card.parent_card_id IS NULL
      )
      ELSE count(card.id)::bigint
    END AS card_count,
    CASE
      WHEN list_row.class_id IS NULL
        THEN GREATEST(activity.last_studied_at, activity.last_opened_at)
      ELSE NULL
    END AS last_activity,
    (embedded.list_id IS NOT NULL) AS is_embedded,
    CASE
      WHEN embedded.list_id IS NOT NULL THEN (
        SELECT count(DISTINCT membership.source_list_id)::bigint
        FROM public.embedded_list_cards membership
        WHERE membership.embedded_list_id = list_row.id
      )
      ELSE 0::bigint
    END AS source_count
  FROM public.lists list_row
  LEFT JOIN public.embedded_lists embedded ON embedded.list_id = list_row.id
  LEFT JOIN public.flashcards card
    ON embedded.list_id IS NULL
   AND card.list_id = list_row.id
   AND card.deleted_at IS NULL
   AND card.parent_card_id IS NULL
  LEFT JOIN public.user_list_activity activity
    ON activity.list_id = list_row.id
   AND activity.user_id = auth.uid()
  WHERE list_row.folder_id = _folder_id
    AND list_row.deleted_at IS NULL
  GROUP BY
    list_row.id,
    embedded.list_id,
    activity.last_studied_at,
    activity.last_opened_at
  ORDER BY
    CASE
      WHEN list_row.class_id IS NULL
        THEN GREATEST(activity.last_studied_at, activity.last_opened_at)
      ELSE NULL
    END DESC NULLS LAST,
    list_row.order_index ASC NULLS LAST,
    list_row.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.require_owned_embedded_list(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.embed_source_lists(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.embed_cards(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unembed_cards(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unembed_source_list(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clear_embedded_list(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_embedded_list(uuid, text, text, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_embedded_flashcards(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_embedded_list_availability(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_embedded_list_members(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_lists_with_card_counts(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.embed_source_lists(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.embed_cards(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unembed_cards(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unembed_source_list(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_embedded_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_embedded_list(uuid, text, text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_embedded_flashcards(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_embedded_list_availability(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_embedded_list_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_lists_with_card_counts(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
