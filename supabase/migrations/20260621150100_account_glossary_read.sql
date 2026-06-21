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
    v_uid = v_owner_id
    OR v_list_visibility = 'public'
    OR v_folder_visibility = 'public'
    OR (
      v_uid IS NOT NULL
      AND v_list_visibility = 'class'
      AND v_list_class_id IS NOT NULL
      AND (
        public.is_turma_owner(v_list_class_id, v_uid)
        OR public.is_turma_member(v_list_class_id, v_uid)
      )
    )
    OR (
      v_uid IS NOT NULL
      AND v_folder_visibility = 'class'
      AND v_folder_class_id IS NOT NULL
      AND (
        public.is_turma_owner(v_folder_class_id, v_uid)
        OR public.is_turma_member(v_folder_class_id, v_uid)
      )
    );

  IF NOT v_allowed THEN
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
  ORDER BY g.created_at ASC, g.id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_account_glossary_for_list_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_account_glossary_for_list_v1(uuid) TO anon, authenticated;

COMMIT;
