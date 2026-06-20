-- ============================================================
-- 1) 20260616143000_add_public_turmas.sql
-- ============================================================
ALTER TABLE public.turmas
ADD COLUMN IF NOT EXISTS public BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_turmas_public_active
ON public.turmas (created_at DESC)
WHERE public = true AND ativo = true;

COMMENT ON COLUMN public.turmas.public IS
'When true, classroom metadata and assigned study content may be viewed anonymously in read-only mode.';

CREATE OR REPLACE VIEW public.public_turmas
WITH (security_barrier = true)
AS
SELECT
  t.id, t.nome, t.descricao, t.created_at,
  COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor') AS teacher_name
FROM public.turmas t
LEFT JOIN public.profiles p ON p.id = t.owner_teacher_id
WHERE t.public = true AND t.ativo = true;

CREATE OR REPLACE VIEW public.public_turma_atribuicoes
WITH (security_barrier = true)
AS
SELECT
  a.id, a.turma_id, a.titulo, a.descricao,
  a.fonte_tipo::TEXT AS fonte_tipo,
  a.order_index, a.created_at,
  CASE
    WHEN a.fonte_tipo::TEXT = 'lista' THEN (
      SELECT COUNT(*)::INTEGER
      FROM public.lists li
      JOIN public.flashcards fc ON fc.list_id = li.id
      WHERE li.id = a.fonte_id
        AND li.owner_id = t.owner_teacher_id
        AND li.class_id = t.id
        AND li.visibility = 'class'
        AND li.deleted_at IS NULL
        AND fc.user_id = t.owner_teacher_id
        AND fc.deleted_at IS NULL
    )
    WHEN a.fonte_tipo::TEXT = 'pasta' THEN (
      SELECT COUNT(*)::INTEGER
      FROM public.folders fo
      JOIN public.lists li ON li.folder_id = fo.id
      JOIN public.flashcards fc ON fc.list_id = li.id
      WHERE fo.id = a.fonte_id
        AND fo.owner_id = t.owner_teacher_id
        AND fo.class_id = t.id
        AND fo.visibility = 'class'
        AND fo.deleted_at IS NULL
        AND li.owner_id = t.owner_teacher_id
        AND li.class_id = t.id
        AND li.visibility = 'class'
        AND li.deleted_at IS NULL
        AND fc.user_id = t.owner_teacher_id
        AND fc.deleted_at IS NULL
    )
    ELSE 0
  END AS card_count
FROM public.atribuicoes a
JOIN public.turmas t ON t.id = a.turma_id
WHERE t.public = true AND t.ativo = true;

CREATE OR REPLACE VIEW public.public_turma_lists
WITH (security_barrier = true)
AS
SELECT a.turma_id, a.id AS atribuicao_id, l.id AS list_id, l.title, l.description, l.order_index
FROM public.atribuicoes a
JOIN public.turmas t ON t.id = a.turma_id AND t.public = true AND t.ativo = true
JOIN public.lists l ON a.fonte_tipo::TEXT = 'lista'
  AND l.id = a.fonte_id AND l.owner_id = t.owner_teacher_id
  AND l.class_id = t.id AND l.visibility = 'class'
WHERE l.deleted_at IS NULL
UNION ALL
SELECT a.turma_id, a.id AS atribuicao_id, l.id AS list_id, l.title, l.description, l.order_index
FROM public.atribuicoes a
JOIN public.turmas t ON t.id = a.turma_id AND t.public = true AND t.ativo = true
JOIN public.folders f ON a.fonte_tipo::TEXT = 'pasta'
  AND f.id = a.fonte_id AND f.owner_id = t.owner_teacher_id
  AND f.class_id = t.id AND f.visibility = 'class'
JOIN public.lists l ON l.folder_id = f.id
  AND l.owner_id = t.owner_teacher_id AND l.class_id = t.id AND l.visibility = 'class'
WHERE f.deleted_at IS NULL AND l.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.public_turma_flashcards
WITH (security_barrier = true)
AS
SELECT
  pl.turma_id, pl.atribuicao_id, pl.list_id,
  f.id, f.term, f.translation, f.hint, f.example_text, f.example_translation,
  f.short_explanation, f.detailed_explanation, f.image_url_a, f.image_url_b,
  f.audio_url, f.created_at
FROM public.public_turma_lists pl
JOIN public.turmas t ON t.id = pl.turma_id AND t.public = true AND t.ativo = true
JOIN public.flashcards f ON f.list_id = pl.list_id AND f.user_id = t.owner_teacher_id
WHERE f.deleted_at IS NULL;

REVOKE ALL ON public.public_turmas FROM PUBLIC;
REVOKE ALL ON public.public_turma_atribuicoes FROM PUBLIC;
REVOKE ALL ON public.public_turma_lists FROM PUBLIC;
REVOKE ALL ON public.public_turma_flashcards FROM PUBLIC;

GRANT SELECT ON public.public_turmas TO anon, authenticated;
GRANT SELECT ON public.public_turma_atribuicoes TO anon, authenticated;
GRANT SELECT ON public.public_turma_lists TO anon, authenticated;
GRANT SELECT ON public.public_turma_flashcards TO anon, authenticated;

-- ============================================================
-- 2) 20260616192000_public_teacher_directory.sql
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_bio text,
  ADD COLUMN IF NOT EXISTS public_specialties text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS public_profile_searchable boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.public_bio IS 'Optional biography shown on the anonymous public teacher profile.';
COMMENT ON COLUMN public.profiles.public_specialties IS 'Optional teaching specialties shown and searched in the public directory.';
COMMENT ON COLUMN public.profiles.public_profile_searchable IS 'When true, an already public teacher profile may appear in anonymous search results.';

UPDATE public.profiles
SET public_profile_searchable = true
WHERE COALESCE(is_teacher, false) = true
  AND COALESCE(public_access_enabled, false) = true
  AND public_slug IS NOT NULL
  AND BTRIM(public_slug) <> '';

CREATE INDEX IF NOT EXISTS idx_profiles_public_teacher_directory
  ON public.profiles (LOWER(public_slug))
  WHERE COALESCE(is_teacher, false) = true
    AND COALESCE(public_access_enabled, false) = true
    AND public_profile_searchable = true;

CREATE INDEX IF NOT EXISTS idx_profiles_public_specialties
  ON public.profiles USING GIN (public_specialties);

CREATE OR REPLACE FUNCTION public.search_public_teachers(_q text DEFAULT '', _limit integer DEFAULT 12)
RETURNS TABLE (display_name text, avatar_url text, public_slug text, public_bio text, public_specialties text[],
  folder_count bigint, list_count bigint, card_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    CASE
      WHEN LOWER(COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor')) LIKE 'professor %'
        THEN COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor')
      ELSE 'Professor ' || COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor')
    END AS display_name,
    p.avatar_url, p.public_slug,
    NULLIF(BTRIM(p.public_bio), '') AS public_bio,
    COALESCE(p.public_specialties, ARRAY[]::text[]) AS public_specialties,
    (SELECT COUNT(*) FROM public.folders f WHERE f.owner_id = p.id AND f.visibility = 'class' AND f.class_id IS NULL AND f.deleted_at IS NULL) AS folder_count,
    (SELECT COUNT(*) FROM public.folders f JOIN public.lists l ON l.folder_id = f.id WHERE f.owner_id = p.id AND f.visibility = 'class' AND f.class_id IS NULL AND f.deleted_at IS NULL AND l.owner_id = p.id AND l.visibility = 'class' AND l.class_id IS NULL AND l.deleted_at IS NULL) AS list_count,
    (SELECT COUNT(*) FROM public.folders f JOIN public.lists l ON l.folder_id = f.id JOIN public.flashcards fc ON fc.list_id = l.id WHERE f.owner_id = p.id AND f.visibility = 'class' AND f.class_id IS NULL AND f.deleted_at IS NULL AND l.owner_id = p.id AND l.visibility = 'class' AND l.class_id IS NULL AND l.deleted_at IS NULL AND fc.user_id = p.id AND fc.deleted_at IS NULL) AS card_count
  FROM public.profiles p
  WHERE COALESCE(p.is_teacher, false) = true
    AND COALESCE(p.public_access_enabled, false) = true
    AND p.public_profile_searchable = true
    AND p.public_slug IS NOT NULL
    AND BTRIM(p.public_slug) <> ''
    AND (
      BTRIM(COALESCE(_q, '')) = ''
      OR p.first_name ILIKE '%' || BTRIM(_q) || '%'
      OR p.public_slug ILIKE '%' || BTRIM(_q) || '%'
      OR COALESCE(p.public_bio, '') ILIKE '%' || BTRIM(_q) || '%'
      OR EXISTS (SELECT 1 FROM UNNEST(COALESCE(p.public_specialties, ARRAY[]::text[])) AS specialty WHERE specialty ILIKE '%' || BTRIM(_q) || '%')
    )
  ORDER BY
    CASE WHEN LOWER(COALESCE(p.first_name, '')) = LOWER(BTRIM(COALESCE(_q, ''))) THEN 0 ELSE 1 END,
    CASE WHEN LOWER(COALESCE(p.first_name, '')) LIKE LOWER(BTRIM(COALESCE(_q, ''))) || '%' THEN 0 ELSE 1 END,
    folder_count DESC, display_name ASC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 12), 1), 24);
$$;

CREATE OR REPLACE FUNCTION public.get_public_teacher_folders(_slug text)
RETURNS TABLE (id uuid, title text, description text, list_count bigint, card_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT f.id, f.title, f.description,
    (SELECT COUNT(*) FROM public.lists l WHERE l.folder_id = f.id AND l.owner_id = p.id AND l.visibility = 'class' AND l.class_id IS NULL AND l.deleted_at IS NULL),
    (SELECT COUNT(*) FROM public.lists l JOIN public.flashcards fc ON fc.list_id = l.id WHERE l.folder_id = f.id AND l.owner_id = p.id AND l.visibility = 'class' AND l.class_id IS NULL AND l.deleted_at IS NULL AND fc.user_id = p.id AND fc.deleted_at IS NULL)
  FROM public.profiles p
  JOIN public.folders f ON f.owner_id = p.id
  WHERE COALESCE(p.is_teacher, false) = true
    AND COALESCE(p.public_access_enabled, false) = true
    AND p.public_slug IS NOT NULL
    AND LOWER(BTRIM(p.public_slug)) = LOWER(BTRIM(_slug))
    AND f.visibility = 'class'
    AND f.class_id IS NULL
    AND f.deleted_at IS NULL
  ORDER BY f.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.search_public_teachers(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_teacher_folders(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_teachers(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_teacher_folders(text) TO anon, authenticated;

-- ============================================================
-- 3+4) get_public_teacher_profile final version (settings-aware, direct lookup allowed)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_public_teacher_profile(_slug text)
RETURNS TABLE (display_name text, avatar_url text, public_slug text, public_bio text, public_specialties text[],
  folder_count bigint, list_count bigint, card_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    CASE
      WHEN LOWER(COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor')) LIKE 'professor %'
        THEN COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor')
      ELSE 'Professor ' || COALESCE(NULLIF(BTRIM(p.first_name), ''), 'Professor')
    END,
    p.avatar_url, p.public_slug,
    NULLIF(BTRIM(p.public_bio), ''),
    COALESCE(p.public_specialties, ARRAY[]::text[]),
    (SELECT COUNT(*) FROM public.folders f WHERE f.owner_id = p.id AND f.visibility = 'class' AND f.class_id IS NULL AND f.deleted_at IS NULL),
    (SELECT COUNT(*) FROM public.folders f JOIN public.lists l ON l.folder_id = f.id WHERE f.owner_id = p.id AND f.visibility = 'class' AND f.class_id IS NULL AND f.deleted_at IS NULL AND l.owner_id = p.id AND l.visibility = 'class' AND l.class_id IS NULL AND l.deleted_at IS NULL),
    (SELECT COUNT(*) FROM public.folders f JOIN public.lists l ON l.folder_id = f.id JOIN public.flashcards fc ON fc.list_id = l.id WHERE f.owner_id = p.id AND f.visibility = 'class' AND f.class_id IS NULL AND f.deleted_at IS NULL AND l.owner_id = p.id AND l.visibility = 'class' AND l.class_id IS NULL AND l.deleted_at IS NULL AND fc.user_id = p.id AND fc.deleted_at IS NULL)
  FROM public.profiles p
  WHERE COALESCE(p.is_teacher, false) = true
    AND COALESCE(p.public_access_enabled, false) = true
    AND p.public_slug IS NOT NULL
    AND LOWER(BTRIM(p.public_slug)) = LOWER(BTRIM(_slug))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_teacher_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_teacher_profile(text) TO anon, authenticated;

-- ============================================================
-- 4) Authenticated teacher settings RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_own_public_teacher_settings()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_profile public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED'); END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND OR COALESCE(v_profile.is_teacher, false) = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'TEACHER_REQUIRED');
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'first_name', v_profile.first_name, 'avatar_url', v_profile.avatar_url,
    'public_slug', v_profile.public_slug, 'public_bio', v_profile.public_bio,
    'public_specialties', COALESCE(v_profile.public_specialties, ARRAY[]::text[]),
    'public_access_enabled', COALESCE(v_profile.public_access_enabled, false),
    'public_profile_searchable', COALESCE(v_profile.public_profile_searchable, false)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_public_teacher_settings(
  _public_bio text, _public_specialties text[], _public_access_enabled boolean, _public_profile_searchable boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_teacher boolean; v_slug text; v_bio text;
  v_specialties text[]; v_specialty text; v_searchable boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED'); END IF;
  SELECT is_teacher, public_slug INTO v_is_teacher, v_slug FROM public.profiles WHERE id = auth.uid();
  IF COALESCE(v_is_teacher, false) = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'TEACHER_REQUIRED');
  END IF;
  v_bio := NULLIF(BTRIM(COALESCE(_public_bio, '')), '');
  IF LENGTH(COALESCE(v_bio, '')) > 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'BIO_TOO_LONG');
  END IF;
  SELECT COALESCE(ARRAY_AGG(value ORDER BY first_position), ARRAY[]::text[]) INTO v_specialties
  FROM (
    SELECT MIN(position) AS first_position, BTRIM(raw_value) AS value
    FROM UNNEST(COALESCE(_public_specialties, ARRAY[]::text[])) WITH ORDINALITY AS item(raw_value, position)
    WHERE BTRIM(COALESCE(raw_value, '')) <> ''
    GROUP BY LOWER(BTRIM(raw_value)), BTRIM(raw_value)
  ) normalized;
  IF COALESCE(ARRAY_LENGTH(v_specialties, 1), 0) > 8 THEN
    RETURN jsonb_build_object('success', false, 'error', 'TOO_MANY_SPECIALTIES');
  END IF;
  FOREACH v_specialty IN ARRAY v_specialties LOOP
    IF LENGTH(v_specialty) > 40 THEN
      RETURN jsonb_build_object('success', false, 'error', 'SPECIALTY_TOO_LONG');
    END IF;
  END LOOP;
  IF COALESCE(_public_access_enabled, false) = true AND NULLIF(BTRIM(COALESCE(v_slug, '')), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PUBLIC_SLUG_REQUIRED');
  END IF;
  v_searchable := COALESCE(_public_access_enabled, false) AND COALESCE(_public_profile_searchable, false);
  UPDATE public.profiles
  SET public_bio = v_bio, public_specialties = v_specialties,
      public_access_enabled = COALESCE(_public_access_enabled, false),
      public_profile_searchable = v_searchable, updated_at = now()
  WHERE id = auth.uid();
  RETURN jsonb_build_object('success', true, 'public_bio', v_bio, 'public_specialties', v_specialties,
    'public_access_enabled', COALESCE(_public_access_enabled, false),
    'public_profile_searchable', v_searchable);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_own_public_teacher_folders()
RETURNS TABLE (id uuid, title text, description text, is_public boolean, list_count bigint, card_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT f.id, f.title, f.description, f.visibility = 'class' AS is_public,
    (SELECT COUNT(*) FROM public.lists l WHERE l.folder_id = f.id AND l.owner_id = auth.uid() AND l.class_id IS NULL AND l.deleted_at IS NULL) AS list_count,
    (SELECT COUNT(*) FROM public.lists l JOIN public.flashcards fc ON fc.list_id = l.id WHERE l.folder_id = f.id AND l.owner_id = auth.uid() AND l.class_id IS NULL AND l.deleted_at IS NULL AND fc.user_id = auth.uid() AND fc.deleted_at IS NULL) AS card_count
  FROM public.folders f
  JOIN public.profiles p ON p.id = f.owner_id
  WHERE f.owner_id = auth.uid() AND COALESCE(p.is_teacher, false) = true
    AND f.class_id IS NULL AND f.deleted_at IS NULL
  ORDER BY f.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.set_public_teacher_folder_visibility(_folder_id uuid, _is_public boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_owner uuid; v_visibility text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED'); END IF;
  SELECT f.owner_id INTO v_owner FROM public.folders f
  JOIN public.profiles p ON p.id = f.owner_id
  WHERE f.id = _folder_id AND f.owner_id = auth.uid()
    AND f.class_id IS NULL AND f.deleted_at IS NULL
    AND COALESCE(p.is_teacher, false) = true;
  IF v_owner IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'FOLDER_NOT_FOUND'); END IF;
  v_visibility := CASE WHEN COALESCE(_is_public, false) THEN 'class' ELSE 'private' END;
  UPDATE public.folders SET visibility = v_visibility, updated_at = now()
    WHERE id = _folder_id AND owner_id = auth.uid();
  UPDATE public.lists SET visibility = v_visibility, updated_at = now()
    WHERE folder_id = _folder_id AND owner_id = auth.uid() AND class_id IS NULL AND deleted_at IS NULL;
  RETURN jsonb_build_object('success', true, 'is_public', COALESCE(_is_public, false));
END;
$$;

REVOKE ALL ON FUNCTION public.get_own_public_teacher_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_public_teacher_settings(text, text[], boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_own_public_teacher_folders() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_public_teacher_folder_visibility(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_own_public_teacher_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_public_teacher_settings(text, text[], boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_own_public_teacher_folders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_public_teacher_folder_visibility(uuid, boolean) TO authenticated;

-- ============================================================
-- 5) 20260620010000_public_teacher_turmas.sql
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_public_teacher_turmas(_slug text)
RETURNS TABLE (id uuid, nome text, descricao text, assignment_count bigint, card_count bigint, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.nome, t.descricao,
    (SELECT COUNT(*) FROM public.public_turma_atribuicoes pa WHERE pa.turma_id = t.id) AS assignment_count,
    (SELECT COUNT(*) FROM public.public_turma_flashcards pf WHERE pf.turma_id = t.id) AS card_count,
    t.created_at
  FROM public.profiles p
  JOIN public.turmas t ON t.owner_teacher_id = p.id
  WHERE COALESCE(p.is_teacher, false) = true
    AND COALESCE(p.public_access_enabled, false) = true
    AND COALESCE(p.public_profile_searchable, false) = true
    AND p.public_slug IS NOT NULL
    AND LOWER(BTRIM(p.public_slug)) = LOWER(BTRIM(COALESCE(_slug, '')))
    AND t.public = true AND t.ativo = true
  ORDER BY t.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_public_teacher_turmas(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_teacher_turmas(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_public_teacher_turmas(text) IS
  'Returns active public classrooms for a public teacher slug without exposing ownership, membership, email, progress, or administrative data.';
