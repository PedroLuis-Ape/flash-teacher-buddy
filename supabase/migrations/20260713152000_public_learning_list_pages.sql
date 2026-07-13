BEGIN;

-- Extend the privacy-safe publication registry to individual public lists.
DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.public_entity_publications'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%entity_type%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.public_entity_publications DROP CONSTRAINT %I',
      constraint_row.conname
    );
  END LOOP;
END;
$$;

ALTER TABLE public.public_entity_publications
  ADD CONSTRAINT public_entity_publications_entity_type_check
  CHECK (entity_type IN ('teacher', 'learning_resource', 'learning_list'));

ALTER TABLE public.public_entity_publications
  ADD COLUMN IF NOT EXISTS parent_id uuid;

CREATE INDEX IF NOT EXISTS idx_public_entity_publications_parent
  ON public.public_entity_publications (entity_type, parent_id)
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_public_learning_list_discovery
  ON public.lists (updated_at DESC, id)
  WHERE visibility = 'class'
    AND class_id IS NULL
    AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.is_public_learning_list(_list_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lists l
    JOIN public.folders f ON f.id = l.folder_id
    JOIN public.profiles p ON p.id = f.owner_id
    WHERE l.id = _list_id
      AND l.owner_id = f.owner_id
      AND l.visibility = 'class'
      AND l.class_id IS NULL
      AND l.deleted_at IS NULL
      AND f.visibility = 'class'
      AND f.class_id IS NULL
      AND f.deleted_at IS NULL
      AND COALESCE(p.is_teacher, false) = true
      AND COALESCE(p.public_access_enabled, false) = true
      AND COALESCE(p.public_profile_searchable, false) = true
      AND NULLIF(BTRIM(p.public_slug), '') IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_public_learning_list(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.list_public_learning_list_entries(
  _limit integer DEFAULT 10000
)
RETURNS TABLE (
  id uuid,
  folder_id uuid,
  title text,
  description text,
  study_type text,
  lang_a text,
  lang_b text,
  labels_a text,
  labels_b text,
  tts_enabled boolean,
  created_at timestamptz,
  updated_at timestamptz,
  folder_title text,
  author_display_name text,
  author_slug text,
  author_avatar_url text,
  card_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    l.id,
    l.folder_id,
    l.title,
    NULLIF(BTRIM(l.description), '') AS description,
    l.study_type,
    l.lang_a,
    l.lang_b,
    l.labels_a,
    l.labels_b,
    l.tts_enabled,
    l.created_at,
    GREATEST(l.updated_at, COALESCE(MAX(fc.updated_at), l.updated_at)) AS updated_at,
    f.title AS folder_title,
    CASE
      WHEN LOWER(COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor')) LIKE 'professor %'
        THEN COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor')
      ELSE 'Professor ' || COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor')
    END AS author_display_name,
    p.public_slug AS author_slug,
    p.avatar_url AS author_avatar_url,
    COUNT(fc.id)::bigint AS card_count
  FROM public.lists l
  JOIN public.folders f ON f.id = l.folder_id
  JOIN public.profiles p ON p.id = f.owner_id
  LEFT JOIN public.flashcards fc
    ON fc.list_id = l.id
   AND fc.user_id = f.owner_id
   AND fc.deleted_at IS NULL
   AND fc.parent_card_id IS NULL
  WHERE l.owner_id = f.owner_id
    AND l.visibility = 'class'
    AND l.class_id IS NULL
    AND l.deleted_at IS NULL
    AND f.visibility = 'class'
    AND f.class_id IS NULL
    AND f.deleted_at IS NULL
    AND COALESCE(p.is_teacher, false) = true
    AND COALESCE(p.public_access_enabled, false) = true
    AND COALESCE(p.public_profile_searchable, false) = true
    AND NULLIF(BTRIM(p.public_slug), '') IS NOT NULL
  GROUP BY l.id, f.id, p.id
  ORDER BY updated_at DESC, l.title ASC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 10000), 1), 20000);
$$;

CREATE OR REPLACE FUNCTION public.get_public_learning_list(_id uuid)
RETURNS TABLE (
  id uuid,
  folder_id uuid,
  title text,
  description text,
  study_type text,
  lang_a text,
  lang_b text,
  labels_a text,
  labels_b text,
  tts_enabled boolean,
  created_at timestamptz,
  updated_at timestamptz,
  folder_title text,
  author_display_name text,
  author_slug text,
  author_avatar_url text,
  card_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT *
  FROM public.list_public_learning_list_entries(20000)
  WHERE id = _id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_public_learning_list_card_preview(
  _list_id uuid,
  _limit integer DEFAULT 24
)
RETURNS TABLE (
  id uuid,
  term text,
  translation text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    fc.id,
    fc.term,
    fc.translation,
    fc.created_at
  FROM public.flashcards fc
  JOIN public.lists l ON l.id = fc.list_id
  JOIN public.folders f ON f.id = l.folder_id
  JOIN public.profiles p ON p.id = f.owner_id
  WHERE fc.list_id = _list_id
    AND fc.user_id = f.owner_id
    AND fc.deleted_at IS NULL
    AND fc.parent_card_id IS NULL
    AND l.owner_id = f.owner_id
    AND l.visibility = 'class'
    AND l.class_id IS NULL
    AND l.deleted_at IS NULL
    AND f.visibility = 'class'
    AND f.class_id IS NULL
    AND f.deleted_at IS NULL
    AND COALESCE(p.is_teacher, false) = true
    AND COALESCE(p.public_access_enabled, false) = true
    AND COALESCE(p.public_profile_searchable, false) = true
    AND NULLIF(BTRIM(p.public_slug), '') IS NOT NULL
  ORDER BY fc.created_at ASC, fc.id ASC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 24), 1), 48);
$$;

REVOKE ALL ON FUNCTION public.list_public_learning_list_entries(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_learning_list(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_learning_list_card_preview(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_learning_list_entries(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_learning_list(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_learning_list_card_preview(uuid, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_learning_list_publication_registry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_is_public boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.public_entity_publications
    SET current_public = false,
        withdrawn_at = COALESCE(withdrawn_at, v_now)
    WHERE entity_type = 'learning_list'
      AND source_id = OLD.id
      AND current_public = true;
    RETURN OLD;
  END IF;

  v_is_public := public.is_public_learning_list(NEW.id);

  IF v_is_public THEN
    INSERT INTO public.public_entity_publications (
      entity_type,
      entity_key,
      source_id,
      owner_id,
      parent_id,
      canonical_path,
      first_published_at,
      last_published_at,
      withdrawn_at,
      current_public
    ) VALUES (
      'learning_list',
      NEW.id::text,
      NEW.id,
      NEW.owner_id,
      NEW.folder_id,
      '/portal/list/' || NEW.id::text,
      v_now,
      v_now,
      NULL,
      true
    )
    ON CONFLICT (entity_type, entity_key) DO UPDATE
    SET source_id = EXCLUDED.source_id,
        owner_id = EXCLUDED.owner_id,
        parent_id = EXCLUDED.parent_id,
        canonical_path = EXCLUDED.canonical_path,
        last_published_at = v_now,
        withdrawn_at = NULL,
        current_public = true;
  ELSE
    UPDATE public.public_entity_publications
    SET owner_id = NEW.owner_id,
        parent_id = NEW.folder_id,
        current_public = false,
        withdrawn_at = COALESCE(withdrawn_at, v_now)
    WHERE entity_type = 'learning_list'
      AND source_id = NEW.id
      AND current_public = true;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_learning_list_publication_registry() FROM PUBLIC;

DROP TRIGGER IF EXISTS sync_learning_list_publication_registry_trigger ON public.lists;
CREATE TRIGGER sync_learning_list_publication_registry_trigger
AFTER INSERT OR UPDATE OF owner_id, folder_id, visibility, class_id, deleted_at
ON public.lists
FOR EACH ROW
EXECUTE FUNCTION public.sync_learning_list_publication_registry();

DROP TRIGGER IF EXISTS sync_learning_list_publication_registry_delete_trigger ON public.lists;
CREATE TRIGGER sync_learning_list_publication_registry_delete_trigger
AFTER DELETE ON public.lists
FOR EACH ROW
EXECUTE FUNCTION public.sync_learning_list_publication_registry();

CREATE OR REPLACE FUNCTION public.sync_folder_learning_list_publications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_folder_id uuid := COALESCE(NEW.id, OLD.id);
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.public_entity_publications
    SET current_public = false,
        withdrawn_at = COALESCE(withdrawn_at, v_now)
    WHERE entity_type = 'learning_list'
      AND parent_id = OLD.id
      AND current_public = true;
    RETURN OLD;
  END IF;

  INSERT INTO public.public_entity_publications (
    entity_type,
    entity_key,
    source_id,
    owner_id,
    parent_id,
    canonical_path,
    first_published_at,
    last_published_at,
    withdrawn_at,
    current_public
  )
  SELECT
    'learning_list',
    l.id::text,
    l.id,
    l.owner_id,
    l.folder_id,
    '/portal/list/' || l.id::text,
    v_now,
    v_now,
    NULL,
    true
  FROM public.lists l
  WHERE l.folder_id = v_folder_id
    AND public.is_public_learning_list(l.id)
  ON CONFLICT (entity_type, entity_key) DO UPDATE
  SET source_id = EXCLUDED.source_id,
      owner_id = EXCLUDED.owner_id,
      parent_id = EXCLUDED.parent_id,
      canonical_path = EXCLUDED.canonical_path,
      last_published_at = v_now,
      withdrawn_at = NULL,
      current_public = true;

  UPDATE public.public_entity_publications publication
  SET current_public = false,
      withdrawn_at = COALESCE(publication.withdrawn_at, v_now)
  WHERE publication.entity_type = 'learning_list'
    AND publication.parent_id = v_folder_id
    AND publication.current_public = true
    AND NOT public.is_public_learning_list(publication.source_id);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_folder_learning_list_publications() FROM PUBLIC;

DROP TRIGGER IF EXISTS sync_folder_learning_list_publications_trigger ON public.folders;
CREATE TRIGGER sync_folder_learning_list_publications_trigger
AFTER INSERT OR UPDATE OF owner_id, visibility, class_id, deleted_at
ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.sync_folder_learning_list_publications();

DROP TRIGGER IF EXISTS sync_folder_learning_list_publications_delete_trigger ON public.folders;
CREATE TRIGGER sync_folder_learning_list_publications_delete_trigger
AFTER DELETE ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.sync_folder_learning_list_publications();

CREATE OR REPLACE FUNCTION public.sync_profile_learning_list_publications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_profile_id uuid := COALESCE(NEW.id, OLD.id);
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.public_entity_publications
    SET current_public = false,
        withdrawn_at = COALESCE(withdrawn_at, v_now)
    WHERE entity_type = 'learning_list'
      AND owner_id = OLD.id
      AND current_public = true;
    RETURN OLD;
  END IF;

  INSERT INTO public.public_entity_publications (
    entity_type,
    entity_key,
    source_id,
    owner_id,
    parent_id,
    canonical_path,
    first_published_at,
    last_published_at,
    withdrawn_at,
    current_public
  )
  SELECT
    'learning_list',
    l.id::text,
    l.id,
    l.owner_id,
    l.folder_id,
    '/portal/list/' || l.id::text,
    v_now,
    v_now,
    NULL,
    true
  FROM public.lists l
  WHERE l.owner_id = v_profile_id
    AND public.is_public_learning_list(l.id)
  ON CONFLICT (entity_type, entity_key) DO UPDATE
  SET source_id = EXCLUDED.source_id,
      owner_id = EXCLUDED.owner_id,
      parent_id = EXCLUDED.parent_id,
      canonical_path = EXCLUDED.canonical_path,
      last_published_at = v_now,
      withdrawn_at = NULL,
      current_public = true;

  UPDATE public.public_entity_publications publication
  SET current_public = false,
      withdrawn_at = COALESCE(publication.withdrawn_at, v_now)
  WHERE publication.entity_type = 'learning_list'
    AND publication.owner_id = v_profile_id
    AND publication.current_public = true
    AND NOT public.is_public_learning_list(publication.source_id);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_profile_learning_list_publications() FROM PUBLIC;

DROP TRIGGER IF EXISTS sync_profile_learning_list_publications_trigger ON public.profiles;
CREATE TRIGGER sync_profile_learning_list_publications_trigger
AFTER INSERT OR UPDATE OF is_teacher, public_access_enabled, public_profile_searchable, public_slug
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_learning_list_publications();

DROP TRIGGER IF EXISTS sync_profile_learning_list_publications_delete_trigger ON public.profiles;
CREATE TRIGGER sync_profile_learning_list_publications_delete_trigger
AFTER DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_learning_list_publications();

-- Backfill only lists that are public under the same strict editorial rules.
INSERT INTO public.public_entity_publications (
  entity_type,
  entity_key,
  source_id,
  owner_id,
  parent_id,
  canonical_path,
  first_published_at,
  last_published_at,
  withdrawn_at,
  current_public
)
SELECT
  'learning_list',
  l.id::text,
  l.id,
  l.owner_id,
  l.folder_id,
  '/portal/list/' || l.id::text,
  now(),
  now(),
  NULL,
  true
FROM public.lists l
WHERE public.is_public_learning_list(l.id)
ON CONFLICT (entity_type, entity_key) DO UPDATE
SET source_id = EXCLUDED.source_id,
    owner_id = EXCLUDED.owner_id,
    parent_id = EXCLUDED.parent_id,
    canonical_path = EXCLUDED.canonical_path,
    last_published_at = now(),
    withdrawn_at = NULL,
    current_public = true;

CREATE OR REPLACE FUNCTION public.get_public_entity_http_status(
  _entity_type text,
  _entity_key text
)
RETURNS TABLE (
  status_code integer,
  state text,
  canonical_path text,
  first_published_at timestamptz,
  last_published_at timestamptz,
  withdrawn_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH base_input AS (
    SELECT
      LOWER(BTRIM(COALESCE(_entity_type, ''))) AS entity_type,
      BTRIM(COALESCE(_entity_key, '')) AS raw_key
  ), normalized_input AS (
    SELECT
      entity_type,
      CASE WHEN entity_type = 'teacher' THEN LOWER(raw_key) ELSE raw_key END AS entity_key
    FROM base_input
  ), matched AS (
    SELECT publication.*
    FROM public.public_entity_publications publication
    JOIN normalized_input input
      ON input.entity_type = publication.entity_type
     AND input.entity_key = publication.entity_key
    WHERE input.entity_type IN ('teacher', 'learning_resource', 'learning_list')
      AND input.entity_key <> ''
    LIMIT 1
  )
  SELECT
    CASE WHEN matched.current_public THEN 200 ELSE 410 END,
    CASE WHEN matched.current_public THEN 'public' ELSE 'gone' END,
    matched.canonical_path,
    matched.first_published_at,
    matched.last_published_at,
    matched.withdrawn_at
  FROM matched

  UNION ALL

  SELECT
    404,
    'not_found',
    NULL::text,
    NULL::timestamptz,
    NULL::timestamptz,
    NULL::timestamptz
  WHERE NOT EXISTS (SELECT 1 FROM matched)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_entity_http_status(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_entity_http_status(text, text) TO anon, authenticated;

COMMENT ON FUNCTION public.list_public_learning_list_entries(integer) IS
  'Build-time discovery feed for canonical public lists outside classroom context.';
COMMENT ON FUNCTION public.get_public_learning_list(uuid) IS
  'Canonical metadata for one teacher-owned public list.';
COMMENT ON FUNCTION public.get_public_learning_list_card_preview(uuid, integer) IS
  'Limited principal-card preview for one canonical public list.';

COMMIT;
