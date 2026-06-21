BEGIN;

CREATE OR REPLACE FUNCTION public.import_account_glossary_v1(
  _entries jsonb,
  _dry_run boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_total integer := 0;
  v_exact integer := 0;
  v_alternative integer := 0;
  v_inserted integer := 0;
  v_lists integer := 0;
  v_folders integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Voce precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(_entries) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Glossario invalido: entries deve ser um array.';
  END IF;

  WITH normalized AS (
    SELECT DISTINCT ON (
      upper(CASE WHEN side = 'B' THEN 'B' ELSE 'A' END),
      lower(btrim(original_text)),
      lower(btrim(translated_text))
    )
      btrim(original_text) AS original_text,
      btrim(translated_text) AS translated_text,
      NULLIF(btrim(note), '') AS note,
      upper(CASE WHEN side = 'B' THEN 'B' ELSE 'A' END) AS side,
      COALESCE(is_active, true) AS is_active
    FROM jsonb_to_recordset(_entries) AS item(
      original_text text,
      translated_text text,
      note text,
      side text,
      is_active boolean
    )
    WHERE NULLIF(btrim(original_text), '') IS NOT NULL
      AND NULLIF(btrim(translated_text), '') IS NOT NULL
    ORDER BY
      upper(CASE WHEN side = 'B' THEN 'B' ELSE 'A' END),
      lower(btrim(original_text)),
      lower(btrim(translated_text))
  )
  SELECT count(*) INTO v_total FROM normalized;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'Nenhuma entrada valida de glossario foi encontrada.';
  END IF;

  WITH normalized AS (
    SELECT DISTINCT
      btrim(original_text) AS original_text,
      btrim(translated_text) AS translated_text,
      upper(CASE WHEN side = 'B' THEN 'B' ELSE 'A' END) AS side
    FROM jsonb_to_recordset(_entries) AS item(
      original_text text,
      translated_text text,
      note text,
      side text,
      is_active boolean
    )
    WHERE NULLIF(btrim(original_text), '') IS NOT NULL
      AND NULLIF(btrim(translated_text), '') IS NOT NULL
  )
  SELECT count(*) INTO v_exact
  FROM normalized e
  JOIN public.account_glossary g
    ON g.owner_id = v_uid
   AND g.side = e.side
   AND lower(btrim(g.original_text)) = lower(e.original_text)
   AND lower(btrim(g.translated_text)) = lower(e.translated_text);

  WITH normalized AS (
    SELECT DISTINCT
      btrim(original_text) AS original_text,
      btrim(translated_text) AS translated_text,
      upper(CASE WHEN side = 'B' THEN 'B' ELSE 'A' END) AS side
    FROM jsonb_to_recordset(_entries) AS item(
      original_text text,
      translated_text text,
      note text,
      side text,
      is_active boolean
    )
    WHERE NULLIF(btrim(original_text), '') IS NOT NULL
      AND NULLIF(btrim(translated_text), '') IS NOT NULL
  )
  SELECT count(*) INTO v_alternative
  FROM normalized e
  WHERE NOT EXISTS (
    SELECT 1 FROM public.account_glossary exact_match
    WHERE exact_match.owner_id = v_uid
      AND exact_match.side = e.side
      AND lower(btrim(exact_match.original_text)) = lower(e.original_text)
      AND lower(btrim(exact_match.translated_text)) = lower(e.translated_text)
  )
  AND EXISTS (
    SELECT 1 FROM public.account_glossary same_term
    WHERE same_term.owner_id = v_uid
      AND same_term.side = e.side
      AND lower(btrim(same_term.original_text)) = lower(e.original_text)
  );

  IF NOT _dry_run THEN
    INSERT INTO public.account_glossary (
      owner_id, original_text, translated_text, note, side, is_active
    )
    SELECT DISTINCT ON (
      upper(CASE WHEN side = 'B' THEN 'B' ELSE 'A' END),
      lower(btrim(original_text)),
      lower(btrim(translated_text))
    )
      v_uid,
      btrim(original_text),
      btrim(translated_text),
      NULLIF(btrim(note), ''),
      upper(CASE WHEN side = 'B' THEN 'B' ELSE 'A' END),
      COALESCE(is_active, true)
    FROM jsonb_to_recordset(_entries) AS item(
      original_text text,
      translated_text text,
      note text,
      side text,
      is_active boolean
    )
    WHERE NULLIF(btrim(original_text), '') IS NOT NULL
      AND NULLIF(btrim(translated_text), '') IS NOT NULL
    ORDER BY
      upper(CASE WHEN side = 'B' THEN 'B' ELSE 'A' END),
      lower(btrim(original_text)),
      lower(btrim(translated_text))
    ON CONFLICT (
      owner_id,
      side,
      lower(btrim(original_text)),
      lower(btrim(translated_text))
    ) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  ELSE
    v_inserted := v_total - v_exact;
  END IF;

  SELECT count(*) INTO v_lists
  FROM public.lists WHERE owner_id = v_uid AND deleted_at IS NULL;

  SELECT count(*) INTO v_folders
  FROM public.folders WHERE owner_id = v_uid AND deleted_at IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'dry_run', _dry_run,
    'requires_confirmation', false,
    'selected_folders', v_folders,
    'target_lists', v_lists,
    'glossary_entries', v_total,
    'planned_applications', v_total,
    'inserted', v_inserted,
    'updated', 0,
    'skipped', CASE WHEN _dry_run THEN v_exact ELSE v_total - v_inserted END,
    'exact_existing', v_exact,
    'alternative_layers', v_alternative,
    'scope', 'account'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_account_glossary_v1(jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_account_glossary_v1(jsonb, boolean) TO authenticated;

COMMIT;
