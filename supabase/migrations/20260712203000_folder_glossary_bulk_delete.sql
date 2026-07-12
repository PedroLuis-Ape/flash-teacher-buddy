-- Exclusão em massa segura para glossários grandes.
-- Permite apagar IDs marcados, todos os resultados de um filtro ou a pasta inteira
-- sem carregar milhares de identificadores no navegador.

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_folder_glossary_bulk_v1(
  _folder_id uuid,
  _scope text,
  _ids uuid[] DEFAULT NULL,
  _search text DEFAULT NULL,
  _side text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scope text := lower(btrim(COALESCE(_scope, '')));
  v_search text := NULLIF(public.folder_glossary_clean_text_v2(_search), '');
  v_side text := CASE
    WHEN upper(COALESCE(_side, '')) IN ('A', 'B') THEN upper(_side)
    ELSE NULL
  END;
  v_deleted integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_manage_folder_glossary_v1(_folder_id, auth.uid()) THEN
    RAISE EXCEPTION 'Pasta inválida ou sem permissão para apagar o glossário.' USING ERRCODE = '42501';
  END IF;

  IF v_scope NOT IN ('ids', 'filter', 'all') THEN
    RAISE EXCEPTION 'Escopo de exclusão inválido.' USING ERRCODE = '22023';
  END IF;

  IF v_scope = 'ids' THEN
    IF cardinality(COALESCE(_ids, '{}'::uuid[])) = 0 THEN
      RAISE EXCEPTION 'Selecione pelo menos uma entrada.' USING ERRCODE = '22023';
    END IF;

    DELETE FROM public.folder_glossary g
    WHERE g.folder_id = _folder_id
      AND g.id = ANY(_ids);

  ELSIF v_scope = 'filter' THEN
    IF v_search IS NULL AND v_side IS NULL THEN
      RAISE EXCEPTION 'Use uma busca ou filtro de lado antes de apagar resultados.' USING ERRCODE = '22023';
    END IF;

    DELETE FROM public.folder_glossary g
    WHERE g.folder_id = _folder_id
      AND (v_side IS NULL OR g.side = v_side)
      AND (
        v_search IS NULL
        OR g.original_text ILIKE '%' || v_search || '%'
        OR g.primary_translation ILIKE '%' || v_search || '%'
        OR COALESCE(array_to_string(g.alternative_translations, ' '), '') ILIKE '%' || v_search || '%'
        OR COALESCE(g.note, '') ILIKE '%' || v_search || '%'
      );

  ELSE
    DELETE FROM public.folder_glossary g
    WHERE g.folder_id = _folder_id;
  END IF;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted', v_deleted,
    'scope', v_scope,
    'folder_id', _folder_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_folder_glossary_bulk_v1(uuid,text,uuid[],text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_folder_glossary_bulk_v1(uuid,text,uuid[],text,text) TO authenticated;

COMMIT;
