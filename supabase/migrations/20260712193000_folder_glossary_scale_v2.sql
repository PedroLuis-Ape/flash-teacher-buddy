-- App Piteco — glossários grandes, paginação e importação set-based v2
-- Compatível com os fluxos v1 existentes. As novas RPCs entram de forma aditiva.

BEGIN;

CREATE OR REPLACE FUNCTION public.folder_glossary_clean_text_v2(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          normalize(COALESCE(_value, ''), NFKC),
          U&'[\2018\2019\201B\2032\FF07]',
          '''',
          'g'
        ),
        U&'[\2010\2011\2012\2013\2014\2212]',
        '-',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.folder_glossary_identity_v2(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT lower(public.folder_glossary_clean_text_v2(_value));
$$;

CREATE OR REPLACE FUNCTION public.folder_glossary_merge_alternatives_v2(
  _primary text,
  _existing text[],
  _incoming_primary text,
  _incoming text[]
) RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  WITH candidates AS (
    SELECT public.folder_glossary_clean_text_v2(value) AS clean
    FROM unnest(
      COALESCE(_existing, '{}'::text[])
      || COALESCE(_incoming, '{}'::text[])
      || CASE
           WHEN public.folder_glossary_identity_v2(_incoming_primary)
                <> public.folder_glossary_identity_v2(_primary)
             THEN ARRAY[public.folder_glossary_clean_text_v2(_incoming_primary)]
           ELSE '{}'::text[]
         END
    ) AS values_table(value)
  ), deduplicated AS (
    SELECT DISTINCT ON (public.folder_glossary_identity_v2(clean)) clean
    FROM candidates
    WHERE clean <> ''
      AND public.folder_glossary_identity_v2(clean)
          <> public.folder_glossary_identity_v2(_primary)
    ORDER BY public.folder_glossary_identity_v2(clean), clean
  )
  SELECT COALESCE(array_agg(clean ORDER BY clean), '{}'::text[])
  FROM deduplicated;
$$;

ALTER TABLE public.folder_glossary
  ADD COLUMN IF NOT EXISTS identity_key text;

UPDATE public.folder_glossary
SET identity_key = public.folder_glossary_identity_v2(original_text)
WHERE identity_key IS DISTINCT FROM public.folder_glossary_identity_v2(original_text);

-- Une duplicatas históricas que diferem apenas por espaços internos, Unicode,
-- apóstrofos, hífens ou capitalização. A tradução principal da entrada mais
-- antiga é preservada e as demais traduções viram alternativas.
DO $$
DECLARE
  duplicate_group record;
  keep_id uuid;
  keep_primary text;
  merged_alternatives text[];
BEGIN
  FOR duplicate_group IN
    SELECT
      folder_id,
      side,
      identity_key,
      array_agg(id ORDER BY created_at, id) AS ids
    FROM public.folder_glossary
    GROUP BY folder_id, side, identity_key
    HAVING count(*) > 1
  LOOP
    keep_id := duplicate_group.ids[1];

    SELECT primary_translation
    INTO keep_primary
    FROM public.folder_glossary
    WHERE id = keep_id;

    SELECT COALESCE(array_agg(clean ORDER BY clean), '{}'::text[])
    INTO merged_alternatives
    FROM (
      SELECT DISTINCT ON (public.folder_glossary_identity_v2(clean)) clean
      FROM (
        SELECT public.folder_glossary_clean_text_v2(g.primary_translation) AS clean
        FROM public.folder_glossary g
        WHERE g.id = ANY(duplicate_group.ids)

        UNION ALL

        SELECT public.folder_glossary_clean_text_v2(alternative) AS clean
        FROM public.folder_glossary g
        CROSS JOIN LATERAL unnest(COALESCE(g.alternative_translations, '{}'::text[])) AS alternatives(alternative)
        WHERE g.id = ANY(duplicate_group.ids)
      ) candidates
      WHERE clean <> ''
        AND public.folder_glossary_identity_v2(clean)
            <> public.folder_glossary_identity_v2(keep_primary)
      ORDER BY public.folder_glossary_identity_v2(clean), clean
    ) deduplicated;

    UPDATE public.folder_glossary AS target
    SET alternative_translations = merged_alternatives,
        note = COALESCE(
          target.note,
          (
            SELECT g.note
            FROM public.folder_glossary g
            WHERE g.id = ANY(duplicate_group.ids)
              AND g.note IS NOT NULL
            ORDER BY g.created_at, g.id
            LIMIT 1
          )
        ),
        source_language = COALESCE(
          target.source_language,
          (
            SELECT g.source_language
            FROM public.folder_glossary g
            WHERE g.id = ANY(duplicate_group.ids)
              AND g.source_language IS NOT NULL
            ORDER BY g.created_at, g.id
            LIMIT 1
          )
        ),
        target_language = COALESCE(
          target.target_language,
          (
            SELECT g.target_language
            FROM public.folder_glossary g
            WHERE g.id = ANY(duplicate_group.ids)
              AND g.target_language IS NOT NULL
            ORDER BY g.created_at, g.id
            LIMIT 1
          )
        ),
        is_active = (
          SELECT bool_or(g.is_active)
          FROM public.folder_glossary g
          WHERE g.id = ANY(duplicate_group.ids)
        ),
        identity_key = duplicate_group.identity_key,
        updated_at = now()
    WHERE target.id = keep_id;

    DELETE FROM public.folder_glossary
    WHERE id = ANY(duplicate_group.ids)
      AND id <> keep_id;
  END LOOP;
END;
$$;

ALTER TABLE public.folder_glossary
  ALTER COLUMN identity_key SET NOT NULL;

DROP INDEX IF EXISTS public.idx_folder_glossary_term_identity;
DROP INDEX IF EXISTS public.idx_folder_glossary_term_identity_v2;

CREATE UNIQUE INDEX idx_folder_glossary_term_identity_v2
  ON public.folder_glossary(folder_id, side, identity_key);

CREATE INDEX IF NOT EXISTS idx_folder_glossary_page_v2
  ON public.folder_glossary(folder_id, side, identity_key, id);

CREATE INDEX IF NOT EXISTS idx_folder_glossary_active_v2
  ON public.folder_glossary(folder_id, is_active);

CREATE OR REPLACE FUNCTION public.folder_glossary_sync_owner_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT f.owner_id
  INTO v_owner_id
  FROM public.folders f
  WHERE f.id = NEW.folder_id
    AND f.deleted_at IS NULL;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Pasta inválida ou removida.' USING ERRCODE = '23503';
  END IF;

  NEW.owner_id := v_owner_id;
  NEW.original_text := public.folder_glossary_clean_text_v2(NEW.original_text);
  NEW.primary_translation := public.folder_glossary_clean_text_v2(NEW.primary_translation);
  NEW.identity_key := public.folder_glossary_identity_v2(NEW.original_text);
  NEW.alternative_translations := public.folder_glossary_merge_alternatives_v2(
    NEW.primary_translation,
    '{}'::text[],
    NULL,
    COALESCE(NEW.alternative_translations, '{}'::text[])
  );
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_folder_glossary_summary_v2(_folder_id uuid)
RETURNS TABLE (
  total_count bigint,
  active_count bigint,
  can_edit boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    count(*)::bigint AS total_count,
    count(*) FILTER (WHERE g.is_active)::bigint AS active_count,
    public.can_manage_folder_glossary_v1(_folder_id, auth.uid()) AS can_edit
  FROM public.folder_glossary g
  WHERE g.folder_id = _folder_id
    AND public.can_read_folder_glossary_v1(_folder_id, auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.search_folder_glossary_page_v2(
  _folder_id uuid,
  _search text DEFAULT NULL,
  _side text DEFAULT NULL,
  _limit integer DEFAULT 60,
  _offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_search text := NULLIF(public.folder_glossary_clean_text_v2(_search), '');
  v_side text := CASE WHEN upper(COALESCE(_side, '')) IN ('A', 'B') THEN upper(_side) ELSE NULL END;
  v_limit integer := LEAST(GREATEST(COALESCE(_limit, 60), 1), 200);
  v_offset integer := GREATEST(COALESCE(_offset, 0), 0);
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_read_folder_glossary_v1(_folder_id, auth.uid()) THEN
    RAISE EXCEPTION 'Pasta inválida ou sem permissão para ler o glossário.' USING ERRCODE = '42501';
  END IF;

  WITH filtered AS MATERIALIZED (
    SELECT g.*
    FROM public.folder_glossary g
    WHERE g.folder_id = _folder_id
      AND (v_side IS NULL OR g.side = v_side)
      AND (
        v_search IS NULL
        OR g.original_text ILIKE '%' || v_search || '%'
        OR g.primary_translation ILIKE '%' || v_search || '%'
        OR COALESCE(array_to_string(g.alternative_translations, ' '), '') ILIKE '%' || v_search || '%'
        OR COALESCE(g.note, '') ILIKE '%' || v_search || '%'
      )
  ), page_rows AS (
    SELECT *
    FROM filtered
    ORDER BY identity_key, side, created_at, id
    LIMIT v_limit
    OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'entries', COALESCE(
      (
        SELECT jsonb_agg(
          to_jsonb(page_row) - 'identity_key'
          ORDER BY page_row.identity_key, page_row.side, page_row.created_at, page_row.id
        )
        FROM page_rows page_row
      ),
      '[]'::jsonb
    ),
    'total', (SELECT count(*) FROM filtered),
    'can_edit', public.can_manage_folder_glossary_v1(_folder_id, auth.uid()),
    'limit', v_limit,
    'offset', v_offset
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_folder_glossary_for_list_v2(_list_id uuid)
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
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    g.id,
    g.owner_id,
    g.original_text,
    array_to_string(
      ARRAY[g.primary_translation] || COALESCE(g.alternative_translations, '{}'::text[]),
      ', '
    ) AS translated_text,
    g.note,
    g.side,
    g.is_active,
    g.created_at,
    g.updated_at
  FROM public.lists l
  JOIN public.folder_glossary g ON g.folder_id = l.folder_id
  WHERE l.id = _list_id
    AND l.deleted_at IS NULL
    AND g.is_active = true
  ORDER BY g.identity_key, g.side, g.created_at, g.id;
$$;

CREATE OR REPLACE FUNCTION public.import_folder_glossary_v2(
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
  v_total integer := 0;
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

  v_total := jsonb_array_length(_entries);

  DROP TABLE IF EXISTS pg_temp.folder_glossary_import_raw_v2;
  DROP TABLE IF EXISTS pg_temp.folder_glossary_import_stage_v2;

  CREATE TEMP TABLE folder_glossary_import_raw_v2 (
    ordinal bigint NOT NULL,
    identity_key text NOT NULL,
    side text NOT NULL,
    original_text text NOT NULL,
    primary_translation text NOT NULL,
    alternative_translations text[] NOT NULL,
    note text,
    source_language text,
    target_language text,
    is_active boolean NOT NULL
  ) ON COMMIT DROP;

  WITH source_rows AS (
    SELECT value AS payload, ordinality
    FROM jsonb_array_elements(_entries) WITH ORDINALITY
  ), parsed AS (
    SELECT
      ordinality,
      payload,
      public.folder_glossary_clean_text_v2(COALESCE(
        payload->>'term',
        payload->>'original_text'
      )) AS original_text,
      public.folder_glossary_clean_text_v2(COALESCE(
        payload->>'translation',
        payload->>'primary_translation',
        payload #>> '{translations,0}'
      )) AS primary_translation,
      CASE WHEN upper(COALESCE(payload->>'side', 'A')) = 'B' THEN 'B' ELSE 'A' END AS side,
      NULLIF(public.folder_glossary_clean_text_v2(payload->>'note'), '') AS note,
      NULLIF(public.folder_glossary_clean_text_v2(COALESCE(
        payload->>'source_language',
        payload->>'sourceLanguage'
      )), '') AS source_language,
      NULLIF(public.folder_glossary_clean_text_v2(COALESCE(
        payload->>'target_language',
        payload->>'targetLanguage'
      )), '') AS target_language,
      COALESCE(
        (payload->>'active')::boolean,
        (payload->>'is_active')::boolean,
        true
      ) AS is_active
    FROM source_rows
  )
  INSERT INTO folder_glossary_import_raw_v2(
    ordinal,
    identity_key,
    side,
    original_text,
    primary_translation,
    alternative_translations,
    note,
    source_language,
    target_language,
    is_active
  )
  SELECT
    parsed.ordinality,
    public.folder_glossary_identity_v2(parsed.original_text),
    parsed.side,
    parsed.original_text,
    parsed.primary_translation,
    COALESCE(
      (
        SELECT array_agg(clean ORDER BY clean)
        FROM (
          SELECT DISTINCT ON (public.folder_glossary_identity_v2(clean)) clean
          FROM (
            SELECT public.folder_glossary_clean_text_v2(alternative_value) AS clean
            FROM jsonb_array_elements_text(
              CASE
                WHEN jsonb_typeof(parsed.payload->'alternatives') = 'array'
                  THEN parsed.payload->'alternatives'
                WHEN jsonb_typeof(parsed.payload->'alternative_translations') = 'array'
                  THEN parsed.payload->'alternative_translations'
                WHEN jsonb_typeof(parsed.payload->'translations') = 'array'
                  THEN parsed.payload->'translations'
                ELSE '[]'::jsonb
              END
            ) AS alternatives_table(alternative_value)
          ) cleaned
          WHERE clean <> ''
            AND public.folder_glossary_identity_v2(clean)
                <> public.folder_glossary_identity_v2(parsed.primary_translation)
          ORDER BY public.folder_glossary_identity_v2(clean), clean
        ) deduplicated
      ),
      '{}'::text[]
    ),
    parsed.note,
    parsed.source_language,
    parsed.target_language,
    parsed.is_active
  FROM parsed
  WHERE parsed.original_text <> ''
    AND parsed.primary_translation <> '';

  CREATE TEMP TABLE folder_glossary_import_stage_v2 (
    identity_key text NOT NULL,
    side text NOT NULL,
    original_text text NOT NULL,
    primary_translation text NOT NULL,
    alternative_translations text[] NOT NULL,
    note text,
    source_language text,
    target_language text,
    is_active boolean NOT NULL,
    PRIMARY KEY(identity_key, side)
  ) ON COMMIT DROP;

  INSERT INTO folder_glossary_import_stage_v2(
    identity_key,
    side,
    original_text,
    primary_translation,
    alternative_translations,
    note,
    source_language,
    target_language,
    is_active
  )
  SELECT
    grouped.identity_key,
    grouped.side,
    first_entry.original_text,
    first_entry.primary_translation,
    COALESCE(
      (
        SELECT array_agg(clean ORDER BY clean)
        FROM (
          SELECT DISTINCT ON (public.folder_glossary_identity_v2(clean)) clean
          FROM (
            SELECT
              public.folder_glossary_clean_text_v2(raw_entry.primary_translation) AS clean,
              raw_entry.ordinal * 2 AS sort_order
            FROM folder_glossary_import_raw_v2 raw_entry
            WHERE raw_entry.identity_key = grouped.identity_key
              AND raw_entry.side = grouped.side

            UNION ALL

            SELECT
              public.folder_glossary_clean_text_v2(alternative) AS clean,
              raw_entry.ordinal * 2 + 1 AS sort_order
            FROM folder_glossary_import_raw_v2 raw_entry
            CROSS JOIN LATERAL unnest(raw_entry.alternative_translations) AS alternatives(alternative)
            WHERE raw_entry.identity_key = grouped.identity_key
              AND raw_entry.side = grouped.side
          ) candidates
          WHERE clean <> ''
            AND public.folder_glossary_identity_v2(clean)
                <> public.folder_glossary_identity_v2(first_entry.primary_translation)
          ORDER BY public.folder_glossary_identity_v2(clean), sort_order, clean
        ) deduplicated
      ),
      '{}'::text[]
    ),
    (
      SELECT raw_entry.note
      FROM folder_glossary_import_raw_v2 raw_entry
      WHERE raw_entry.identity_key = grouped.identity_key
        AND raw_entry.side = grouped.side
        AND raw_entry.note IS NOT NULL
      ORDER BY raw_entry.ordinal
      LIMIT 1
    ),
    (
      SELECT raw_entry.source_language
      FROM folder_glossary_import_raw_v2 raw_entry
      WHERE raw_entry.identity_key = grouped.identity_key
        AND raw_entry.side = grouped.side
        AND raw_entry.source_language IS NOT NULL
      ORDER BY raw_entry.ordinal
      LIMIT 1
    ),
    (
      SELECT raw_entry.target_language
      FROM folder_glossary_import_raw_v2 raw_entry
      WHERE raw_entry.identity_key = grouped.identity_key
        AND raw_entry.side = grouped.side
        AND raw_entry.target_language IS NOT NULL
      ORDER BY raw_entry.ordinal
      LIMIT 1
    ),
    (
      SELECT raw_entry.is_active
      FROM folder_glossary_import_raw_v2 raw_entry
      WHERE raw_entry.identity_key = grouped.identity_key
        AND raw_entry.side = grouped.side
      ORDER BY raw_entry.ordinal DESC
      LIMIT 1
    )
  FROM (
    SELECT identity_key, side
    FROM folder_glossary_import_raw_v2
    GROUP BY identity_key, side
  ) grouped
  CROSS JOIN LATERAL (
    SELECT raw_entry.original_text, raw_entry.primary_translation
    FROM folder_glossary_import_raw_v2 raw_entry
    WHERE raw_entry.identity_key = grouped.identity_key
      AND raw_entry.side = grouped.side
    ORDER BY raw_entry.ordinal
    LIMIT 1
  ) first_entry;

  IF _mode = 'replace' THEN
    SELECT count(*)::integer
    INTO v_removed
    FROM public.folder_glossary
    WHERE folder_id = _folder_id;

    SELECT count(*)::integer
    INTO v_inserted
    FROM folder_glossary_import_stage_v2;

    v_skipped := GREATEST(v_total - v_inserted, 0);

    IF NOT _dry_run THEN
      DELETE FROM public.folder_glossary
      WHERE folder_id = _folder_id;

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
        is_active,
        identity_key
      )
      SELECT
        _folder_id,
        auth.uid(),
        stage.original_text,
        stage.primary_translation,
        stage.alternative_translations,
        stage.note,
        stage.side,
        stage.source_language,
        stage.target_language,
        stage.is_active,
        stage.identity_key
      FROM folder_glossary_import_stage_v2 stage;
    END IF;
  ELSE
    SELECT
      count(*) FILTER (WHERE existing.id IS NULL)::integer,
      count(*) FILTER (
        WHERE existing.id IS NOT NULL
          AND (
            existing.alternative_translations IS DISTINCT FROM public.folder_glossary_merge_alternatives_v2(
              existing.primary_translation,
              existing.alternative_translations,
              stage.primary_translation,
              stage.alternative_translations
            )
            OR existing.note IS DISTINCT FROM COALESCE(stage.note, existing.note)
            OR existing.source_language IS DISTINCT FROM COALESCE(stage.source_language, existing.source_language)
            OR existing.target_language IS DISTINCT FROM COALESCE(stage.target_language, existing.target_language)
            OR existing.is_active IS DISTINCT FROM stage.is_active
          )
      )::integer
    INTO v_inserted, v_updated
    FROM folder_glossary_import_stage_v2 stage
    LEFT JOIN public.folder_glossary existing
      ON existing.folder_id = _folder_id
     AND existing.side = stage.side
     AND existing.identity_key = stage.identity_key;

    v_skipped := GREATEST(v_total - v_inserted - v_updated, 0);

    IF NOT _dry_run THEN
      INSERT INTO public.folder_glossary AS existing(
        folder_id,
        owner_id,
        original_text,
        primary_translation,
        alternative_translations,
        note,
        side,
        source_language,
        target_language,
        is_active,
        identity_key
      )
      SELECT
        _folder_id,
        auth.uid(),
        stage.original_text,
        stage.primary_translation,
        stage.alternative_translations,
        stage.note,
        stage.side,
        stage.source_language,
        stage.target_language,
        stage.is_active,
        stage.identity_key
      FROM folder_glossary_import_stage_v2 stage
      ON CONFLICT (folder_id, side, identity_key)
      DO UPDATE SET
        alternative_translations = public.folder_glossary_merge_alternatives_v2(
          existing.primary_translation,
          existing.alternative_translations,
          EXCLUDED.primary_translation,
          EXCLUDED.alternative_translations
        ),
        note = COALESCE(EXCLUDED.note, existing.note),
        source_language = COALESCE(EXCLUDED.source_language, existing.source_language),
        target_language = COALESCE(EXCLUDED.target_language, existing.target_language),
        is_active = EXCLUDED.is_active,
        updated_at = now()
      WHERE existing.alternative_translations IS DISTINCT FROM public.folder_glossary_merge_alternatives_v2(
              existing.primary_translation,
              existing.alternative_translations,
              EXCLUDED.primary_translation,
              EXCLUDED.alternative_translations
            )
         OR existing.note IS DISTINCT FROM COALESCE(EXCLUDED.note, existing.note)
         OR existing.source_language IS DISTINCT FROM COALESCE(EXCLUDED.source_language, existing.source_language)
         OR existing.target_language IS DISTINCT FROM COALESCE(EXCLUDED.target_language, existing.target_language)
         OR existing.is_active IS DISTINCT FROM EXCLUDED.is_active;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'folder_id', _folder_id,
    'mode', _mode,
    'dry_run', _dry_run,
    'inserted', v_inserted,
    'updated', v_updated,
    'skipped', v_skipped,
    'removed', v_removed,
    'received', v_total,
    'compacted', (SELECT count(*) FROM folder_glossary_import_stage_v2)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_folder_glossary_summary_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_folder_glossary_page_v2(uuid,text,text,integer,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_folder_glossary_for_list_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_folder_glossary_v2(uuid,jsonb,text,boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_folder_glossary_summary_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_folder_glossary_page_v2(uuid,text,text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_folder_glossary_for_list_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_folder_glossary_v2(uuid,jsonb,text,boolean) TO authenticated;

COMMIT;
