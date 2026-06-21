BEGIN;

CREATE OR REPLACE FUNCTION public.get_account_glossary_for_list_v1(_list_id uuid)
RETURNS TABLE (
  id uuid,
  owner_id uuid,
  original_text text,
  translated_text text,
  note text,
  side text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner_id uuid;
  v_list_visibility text;
  v_list_class_id uuid;
  v_folder_visibility text;
  v_folder_class_id uuid;
  v_allowed boolean := false;
  v_class_allowed boolean := false;
BEGIN
  SELECT
    l.owner_id,
    l.visibility::text,
    l.class_id,
    f.visibility::text,
    f.class_id
  INTO
    v_owner_id,
    v_list_visibility,
    v_list_class_id,
    v_folder_visibility,
    v_folder_class_id
  FROM public.lists l
  LEFT JOIN public.folders f
    ON f.id = l.folder_id
   AND f.deleted_at IS NULL
  WHERE l.id = _list_id
    AND l.deleted_at IS NULL;

  IF v_owner_id IS NULL THEN
    RETURN;
  END IF;

  v_allowed :=
    COALESCE(v_uid = v_owner_id, false)
    OR COALESCE(v_list_visibility = 'public', false)
    OR COALESCE(v_folder_visibility = 'public', false);

  IF NOT v_allowed
     AND v_uid IS NOT NULL
     AND to_regprocedure('public.is_turma_owner(uuid,uuid)') IS NOT NULL
     AND to_regprocedure('public.is_turma_member(uuid,uuid)') IS NOT NULL THEN
    IF v_list_visibility = 'class' AND v_list_class_id IS NOT NULL THEN
      EXECUTE
        'SELECT public.is_turma_owner($1, $2) OR public.is_turma_member($1, $2)'
      INTO v_class_allowed
      USING v_list_class_id, v_uid;
      v_allowed := COALESCE(v_class_allowed, false);
    END IF;

    IF NOT v_allowed
       AND v_folder_visibility = 'class'
       AND v_folder_class_id IS NOT NULL THEN
      EXECUTE
        'SELECT public.is_turma_owner($1, $2) OR public.is_turma_member($1, $2)'
      INTO v_class_allowed
      USING v_folder_class_id, v_uid;
      v_allowed := COALESCE(v_class_allowed, false);
    END IF;
  END IF;

  IF NOT COALESCE(v_allowed, false) THEN
    RAISE EXCEPTION 'Lista invalida ou sem permissao.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    g.id,
    g.owner_id,
    g.original_text,
    g.translated_text,
    g.note,
    g.side,
    g.is_active,
    g.created_at,
    g.updated_at
  FROM public.account_glossary g
  WHERE g.owner_id = v_owner_id
    AND g.is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.flashcards c
      WHERE c.list_id = _list_id
        AND c.deleted_at IS NULL
        AND (
          (
            g.side = 'A'
            AND strpos(
              ' ' || regexp_replace(lower(c.term), '[^[:alnum:]_]+', ' ', 'g') || ' ',
              ' ' || regexp_replace(lower(g.original_text), '[^[:alnum:]_]+', ' ', 'g') || ' '
            ) > 0
          )
          OR (
            g.side = 'B'
            AND strpos(
              ' ' || regexp_replace(lower(c.translation), '[^[:alnum:]_]+', ' ', 'g') || ' ',
              ' ' || regexp_replace(lower(g.original_text), '[^[:alnum:]_]+', ' ', 'g') || ' '
            ) > 0
          )
        )
    )
  ORDER BY g.created_at ASC, g.id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_account_glossary_for_list_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_account_glossary_for_list_v1(uuid) TO anon, authenticated;

COMMIT;
