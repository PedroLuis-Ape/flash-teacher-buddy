BEGIN;

CREATE OR REPLACE FUNCTION public.import_folder_glossary_v1(
  _folder_id uuid,
  _entries jsonb,
  _mode text DEFAULT 'merge',
  _dry_run boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entry record;
  v_existing public.folder_glossary%ROWTYPE;
  v_term text;
  v_primary text;
  v_side text;
  v_note text;
  v_source_language text;
  v_target_language text;
  v_alternatives text[];
  v_merged_alternatives text[];
  v_active boolean;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_removed integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_manage_folder_glossary_v1(_folder_id, auth.uid()) THEN
    RAISE EXCEPTION 'Pasta inválida ou sem permissão para editar o glossário.' USING ERRCODE = '42501';
  END IF;
  IF _mode NOT IN ('merge', 'replace') THEN
    RAISE EXCEPTION 'Modo inválido. Use merge ou replace.';
  END IF;
  IF jsonb_typeof(_entries) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'O glossário deve ser um array JSON.';
  END IF;

  IF _mode = 'replace' THEN
    SELECT count(*)::integer
    INTO v_removed
    FROM public.folder_glossary
    WHERE folder_id = _folder_id;

    IF NOT _dry_run THEN
      DELETE FROM public.folder_glossary WHERE folder_id = _folder_id;
    END IF;
  END IF;

  FOR v_entry IN
    SELECT value, ordinality
    FROM jsonb_array_elements(_entries) WITH ORDINALITY
  LOOP
    v_term := NULLIF(btrim(COALESCE(
      v_entry.value->>'term',
      v_entry.value->>'original_text'
    )), '');
    v_primary := NULLIF(btrim(COALESCE(
      v_entry.value->>'translation',
      v_entry.value->>'primary_translation',
      v_entry.value #>> '{translations,0}'
    )), '');
    v_side := CASE
      WHEN upper(COALESCE(v_entry.value->>'side', 'A')) = 'B' THEN 'B'
      ELSE 'A'
    END;
    v_note := NULLIF(btrim(v_entry.value->>'note'), '');
    v_source_language := NULLIF(btrim(COALESCE(
      v_entry.value->>'source_language',
      v_entry.value->>'sourceLanguage'
    )), '');
    v_target_language := NULLIF(btrim(COALESCE(
      v_entry.value->>'target_language',
      v_entry.value->>'targetLanguage'
    )), '');
    v_active := COALESCE(
      (v_entry.value->>'active')::boolean,
      (v_entry.value->>'is_active')::boolean,
      true
    );

    IF v_term IS NULL OR v_primary IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT COALESCE(array_agg(DISTINCT clean ORDER BY clean), '{}'::text[])
    INTO v_alternatives
    FROM (
      SELECT btrim(regexp_replace(alternative_value, '\s+', ' ', 'g')) AS clean
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(v_entry.value->'alternatives') = 'array'
            THEN v_entry.value->'alternatives'
          WHEN jsonb_typeof(v_entry.value->'alternative_translations') = 'array'
            THEN v_entry.value->'alternative_translations'
          WHEN jsonb_typeof(v_entry.value->'translations') = 'array'
            THEN v_entry.value->'translations'
          ELSE '[]'::jsonb
        END
      ) AS alternatives_table(alternative_value)
    ) normalized_alternatives
    WHERE length(clean) > 0
      AND lower(clean) <> lower(v_primary);

    SELECT *
    INTO v_existing
    FROM public.folder_glossary
    WHERE folder_id = _folder_id
      AND side = v_side
      AND lower(btrim(original_text)) = lower(btrim(v_term))
    LIMIT 1;

    IF NOT FOUND THEN
      v_inserted := v_inserted + 1;
      IF NOT _dry_run THEN
        INSERT INTO public.folder_glossary(
          folder_id,
          owner_id,
          original_text,
          primary_translation,
          alternative_translations,
          note,
          side,
          source_language,
          target_language,
          is_active
        ) VALUES (
          _folder_id,
          auth.uid(),
          v_term,
          v_primary,
          v_alternatives,
          v_note,
          v_side,
          v_source_language,
          v_target_language,
          v_active
        );
      END IF;
      CONTINUE;
    END IF;

    SELECT COALESCE(array_agg(DISTINCT clean ORDER BY clean), '{}'::text[])
    INTO v_merged_alternatives
    FROM (
      SELECT btrim(merged_value) AS clean
      FROM unnest(
        COALESCE(v_existing.alternative_translations, '{}'::text[])
        || v_alternatives
        || CASE
             WHEN lower(v_existing.primary_translation) <> lower(v_primary)
               THEN ARRAY[v_primary]
             ELSE '{}'::text[]
           END
      ) AS merged_values(merged_value)
    ) normalized_merged
    WHERE length(clean) > 0
      AND lower(clean) <> lower(v_existing.primary_translation);

    IF v_existing.primary_translation = v_primary
       AND COALESCE(v_existing.alternative_translations, '{}'::text[]) = v_merged_alternatives
       AND v_existing.note IS NOT DISTINCT FROM COALESCE(v_note, v_existing.note)
       AND v_existing.is_active IS NOT DISTINCT FROM v_active THEN
      v_skipped := v_skipped + 1;
    ELSE
      v_updated := v_updated + 1;
      IF NOT _dry_run THEN
        UPDATE public.folder_glossary
        SET alternative_translations = v_merged_alternatives,
            note = COALESCE(v_note, note),
            source_language = COALESCE(v_source_language, source_language),
            target_language = COALESCE(v_target_language, target_language),
            is_active = v_active,
            updated_at = now()
        WHERE id = v_existing.id;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'folder_id', _folder_id,
    'mode', _mode,
    'dry_run', _dry_run,
    'inserted', v_inserted,
    'updated', v_updated,
    'skipped', v_skipped,
    'removed', v_removed
  );
END;
$$;

COMMIT;
