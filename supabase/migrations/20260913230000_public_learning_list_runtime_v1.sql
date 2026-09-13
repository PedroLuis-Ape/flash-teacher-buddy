-- Torna a lista publica funcional em producao (correcao de P0).
--
-- Causa-raiz: a camada original de publicacao de listas nunca foi aplicada em
-- producao. Medido em 2026-09-13: get_public_learning_list responde 404 e a leitura
-- direta de lists como anon responde 401 (RLS), entao /portal/list/{id} cai no
-- estado Lista publica indisponivel.
--
-- Decisao: reutiliza a REGRA PUBLICA JA VIGENTE em producao:
-- visibility = class, class_id IS NULL, deleted_at IS NULL, dono com is_teacher,
-- public_access_enabled, public_profile_searchable e public_slug. Nao depende da
-- camada de registro (public_entity_publications), que nao existe em producao.
-- Mesma decisao arquitetural da Fase 4 para os materiais curados.
--
-- Backup de producao antes desta migration: as tres funcoes NAO existiam (0 de 3 em
-- pg_proc) e as tabelas public_entity_publications e public_learning_list_entries
-- tambem nao existem. Nao havia dado a preservar.
--
-- Rollback:
--   drop function if exists public.get_public_learning_list_card_preview(uuid, integer);
--   drop function if exists public.get_public_learning_list(uuid);
--   drop function if exists public.list_public_learning_list_entries(integer);

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
