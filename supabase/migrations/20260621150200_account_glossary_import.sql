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
  v_total integer;
  v_exact integer;
  v_alternative integer;
  v_inserted integer := 0;
  v_lists integer;
  v_folders integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Voce precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.normalize_account_glossary_entries_v1(_entries);

  IF v_total = 0 THEN
    RAISE EXCEPTION 'Nenhuma entrada valida de glossario foi encontrada.';
  END IF;

  SELECT count(*) INTO v_exact
  FROM public.normalize_account_glossary_entries_v1(_entries) e
  JOIN public.account_glossary g
    ON g.owner_id = v_uid
   AND g.side = e.side
   AND lower(btrim(g.original_text)) = lower(e.original_text)
   AND lower(btrim(g.translated_text)) = lower(e.translated_text);

  SELECT count(*) INTO v_alternative
  FROM public.normalize_account_glossary_entries_v1(_entries) e
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.account_glossary exact_match
    WHERE exact_match.owner_id = v_uid
      AND exact_match.side = e.side
      AND lower(btrim(exact_match.original_text)) = lower(e.original_text)
      AND lower(btrim(exact_match.translated_text)) = lower(e.translated_text)
  )
  AND EXISTS (
    SELECT 1
    FROM public.account_glossary same_term
    WHERE same_term.owner_id = v_uid
      AND same_term.side = e.side
      AND lower(btrim(same_term.original_text)) = lower(e.original_text)
  );

  IF _dry_run THEN
    v_inserted := v_total - v_exact;
  ELSE
    INSERT INTO public.account_glossary (
      owner_id, original_text, translated_text, note, side, is_active
    )
    SELECT v_uid, e.original_text, e.translated_text, e.note, e.side, e.is_active
    FROM public.normalize_account_glossary_entries_v1(_entries) e
    ON CONFLICT (
      owner_id,
      side,
      lower(btrim(original_text)),
      lower(btrim(translated_text))
    ) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
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
    'skipped', v_total - v_inserted,
    'exact_existing', v_exact,
    'alternative_layers', v_alternative,
    'scope', 'account'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_account_glossary_v1(jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_account_glossary_v1(jsonb, boolean) TO authenticated;

COMMIT;
