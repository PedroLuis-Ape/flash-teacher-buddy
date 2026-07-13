BEGIN;

-- Persist only entities that have actually been published. This lets the
-- delivery layer distinguish a withdrawn public URL (410) from an arbitrary or
-- never-published identifier (404) without exposing private table existence.
CREATE TABLE IF NOT EXISTS public.public_entity_publications (
  entity_type text NOT NULL CHECK (entity_type IN ('teacher', 'learning_resource')),
  entity_key text NOT NULL,
  source_id uuid,
  owner_id uuid,
  canonical_path text NOT NULL,
  first_published_at timestamptz NOT NULL DEFAULT now(),
  last_published_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  current_public boolean NOT NULL DEFAULT true,
  PRIMARY KEY (entity_type, entity_key)
);

CREATE INDEX IF NOT EXISTS idx_public_entity_publications_source
  ON public.public_entity_publications (entity_type, source_id);

CREATE INDEX IF NOT EXISTS idx_public_entity_publications_owner
  ON public.public_entity_publications (owner_id, entity_type)
  WHERE current_public = true;

ALTER TABLE public.public_entity_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_entity_publications FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_public_profile_discoverable(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _profile_id
      AND COALESCE(p.is_teacher, false) = true
      AND COALESCE(p.public_access_enabled, false) = true
      AND COALESCE(p.public_profile_searchable, false) = true
      AND NULLIF(BTRIM(p.public_slug), '') IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_public_profile_discoverable(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.sync_folder_publication_registry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_is_public boolean;
  v_folder_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.public_entity_publications
    SET current_public = false,
        withdrawn_at = COALESCE(withdrawn_at, v_now)
    WHERE entity_type = 'learning_resource'
      AND source_id = OLD.id
      AND current_public = true;
    RETURN OLD;
  END IF;

  v_folder_id := NEW.id;
  v_is_public := NEW.visibility = 'class'
    AND NEW.class_id IS NULL
    AND NEW.deleted_at IS NULL
    AND public.is_public_profile_discoverable(NEW.owner_id);

  IF v_is_public THEN
    INSERT INTO public.public_entity_publications (
      entity_type,
      entity_key,
      source_id,
      owner_id,
      canonical_path,
      first_published_at,
      last_published_at,
      withdrawn_at,
      current_public
    ) VALUES (
      'learning_resource',
      NEW.id::text,
      NEW.id,
      NEW.owner_id,
      '/portal/folder/' || NEW.id::text,
      v_now,
      v_now,
      NULL,
      true
    )
    ON CONFLICT (entity_type, entity_key) DO UPDATE
    SET source_id = EXCLUDED.source_id,
        owner_id = EXCLUDED.owner_id,
        canonical_path = EXCLUDED.canonical_path,
        last_published_at = v_now,
        withdrawn_at = NULL,
        current_public = true;
  ELSE
    UPDATE public.public_entity_publications
    SET owner_id = NEW.owner_id,
        current_public = false,
        withdrawn_at = COALESCE(withdrawn_at, v_now)
    WHERE entity_type = 'learning_resource'
      AND source_id = v_folder_id
      AND current_public = true;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_folder_publication_registry() FROM PUBLIC;

DROP TRIGGER IF EXISTS sync_folder_publication_registry_trigger ON public.folders;
CREATE TRIGGER sync_folder_publication_registry_trigger
AFTER INSERT OR UPDATE OF owner_id, visibility, class_id, deleted_at
ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.sync_folder_publication_registry();

DROP TRIGGER IF EXISTS sync_folder_publication_registry_delete_trigger ON public.folders;
CREATE TRIGGER sync_folder_publication_registry_delete_trigger
AFTER DELETE ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.sync_folder_publication_registry();

CREATE OR REPLACE FUNCTION public.sync_profile_publication_registry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_slug text;
  v_old_slug text;
  v_is_public boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.public_entity_publications
    SET current_public = false,
        withdrawn_at = COALESCE(withdrawn_at, v_now)
    WHERE (
      entity_type = 'teacher' AND source_id = OLD.id
    ) OR (
      entity_type = 'learning_resource' AND owner_id = OLD.id
    );
    RETURN OLD;
  END IF;

  v_slug := NULLIF(LOWER(BTRIM(NEW.public_slug)), '');
  v_old_slug := CASE
    WHEN TG_OP = 'UPDATE' THEN NULLIF(LOWER(BTRIM(OLD.public_slug)), '')
    ELSE NULL
  END;

  IF v_old_slug IS NOT NULL AND v_old_slug IS DISTINCT FROM v_slug THEN
    UPDATE public.public_entity_publications
    SET current_public = false,
        withdrawn_at = COALESCE(withdrawn_at, v_now)
    WHERE entity_type = 'teacher'
      AND entity_key = v_old_slug
      AND source_id = NEW.id
      AND current_public = true;
  END IF;

  v_is_public := COALESCE(NEW.is_teacher, false) = true
    AND COALESCE(NEW.public_access_enabled, false) = true
    AND COALESCE(NEW.public_profile_searchable, false) = true
    AND v_slug IS NOT NULL;

  IF v_is_public THEN
    INSERT INTO public.public_entity_publications (
      entity_type,
      entity_key,
      source_id,
      owner_id,
      canonical_path,
      first_published_at,
      last_published_at,
      withdrawn_at,
      current_public
    ) VALUES (
      'teacher',
      v_slug,
      NEW.id,
      NEW.id,
      '/portal/professor/' || v_slug,
      v_now,
      v_now,
      NULL,
      true
    )
    ON CONFLICT (entity_type, entity_key) DO UPDATE
    SET source_id = EXCLUDED.source_id,
        owner_id = EXCLUDED.owner_id,
        canonical_path = EXCLUDED.canonical_path,
        last_published_at = v_now,
        withdrawn_at = NULL,
        current_public = true;

    INSERT INTO public.public_entity_publications (
      entity_type,
      entity_key,
      source_id,
      owner_id,
      canonical_path,
      first_published_at,
      last_published_at,
      withdrawn_at,
      current_public
    )
    SELECT
      'learning_resource',
      f.id::text,
      f.id,
      f.owner_id,
      '/portal/folder/' || f.id::text,
      v_now,
      v_now,
      NULL,
      true
    FROM public.folders f
    WHERE f.owner_id = NEW.id
      AND f.visibility = 'class'
      AND f.class_id IS NULL
      AND f.deleted_at IS NULL
    ON CONFLICT (entity_type, entity_key) DO UPDATE
    SET source_id = EXCLUDED.source_id,
        owner_id = EXCLUDED.owner_id,
        canonical_path = EXCLUDED.canonical_path,
        last_published_at = v_now,
        withdrawn_at = NULL,
        current_public = true;

    UPDATE public.public_entity_publications publication
    SET current_public = false,
        withdrawn_at = COALESCE(publication.withdrawn_at, v_now)
    WHERE publication.entity_type = 'learning_resource'
      AND publication.owner_id = NEW.id
      AND publication.current_public = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.folders f
        WHERE f.id = publication.source_id
          AND f.owner_id = NEW.id
          AND f.visibility = 'class'
          AND f.class_id IS NULL
          AND f.deleted_at IS NULL
      );
  ELSE
    UPDATE public.public_entity_publications
    SET current_public = false,
        withdrawn_at = COALESCE(withdrawn_at, v_now)
    WHERE current_public = true
      AND (
        (entity_type = 'teacher' AND source_id = NEW.id)
        OR (entity_type = 'learning_resource' AND owner_id = NEW.id)
      );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_profile_publication_registry() FROM PUBLIC;

DROP TRIGGER IF EXISTS sync_profile_publication_registry_trigger ON public.profiles;
CREATE TRIGGER sync_profile_publication_registry_trigger
AFTER INSERT OR UPDATE OF is_teacher, public_access_enabled, public_profile_searchable, public_slug
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_publication_registry();

DROP TRIGGER IF EXISTS sync_profile_publication_registry_delete_trigger ON public.profiles;
CREATE TRIGGER sync_profile_publication_registry_delete_trigger
AFTER DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_publication_registry();

-- Backfill only entities that are public at migration time. Private entities
-- that have never been published deliberately do not receive a registry row.
INSERT INTO public.public_entity_publications (
  entity_type,
  entity_key,
  source_id,
  owner_id,
  canonical_path,
  first_published_at,
  last_published_at,
  withdrawn_at,
  current_public
)
SELECT
  'teacher',
  LOWER(BTRIM(p.public_slug)),
  p.id,
  p.id,
  '/portal/professor/' || LOWER(BTRIM(p.public_slug)),
  now(),
  now(),
  NULL,
  true
FROM public.profiles p
WHERE COALESCE(p.is_teacher, false) = true
  AND COALESCE(p.public_access_enabled, false) = true
  AND COALESCE(p.public_profile_searchable, false) = true
  AND NULLIF(BTRIM(p.public_slug), '') IS NOT NULL
ON CONFLICT (entity_type, entity_key) DO UPDATE
SET source_id = EXCLUDED.source_id,
    owner_id = EXCLUDED.owner_id,
    canonical_path = EXCLUDED.canonical_path,
    last_published_at = now(),
    withdrawn_at = NULL,
    current_public = true;

INSERT INTO public.public_entity_publications (
  entity_type,
  entity_key,
  source_id,
  owner_id,
  canonical_path,
  first_published_at,
  last_published_at,
  withdrawn_at,
  current_public
)
SELECT
  'learning_resource',
  f.id::text,
  f.id,
  f.owner_id,
  '/portal/folder/' || f.id::text,
  now(),
  now(),
  NULL,
  true
FROM public.folders f
JOIN public.profiles p ON p.id = f.owner_id
WHERE f.visibility = 'class'
  AND f.class_id IS NULL
  AND f.deleted_at IS NULL
  AND COALESCE(p.is_teacher, false) = true
  AND COALESCE(p.public_access_enabled, false) = true
  AND COALESCE(p.public_profile_searchable, false) = true
  AND NULLIF(BTRIM(p.public_slug), '') IS NOT NULL
ON CONFLICT (entity_type, entity_key) DO UPDATE
SET source_id = EXCLUDED.source_id,
    owner_id = EXCLUDED.owner_id,
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
    WHERE input.entity_type IN ('teacher', 'learning_resource')
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

COMMENT ON TABLE public.public_entity_publications IS
  'Lifecycle registry for URLs that were intentionally public; used to return privacy-safe 404/410 responses.';
COMMENT ON FUNCTION public.get_public_entity_http_status(text, text) IS
  'Returns 200 for currently public URLs, 410 for previously published URLs, and 404 for never-published keys.';

COMMIT;
