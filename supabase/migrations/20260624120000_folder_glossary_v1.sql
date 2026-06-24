-- App Piteco — glossário canônico por pasta
-- Mantém account_glossary/list_glossary como legado temporário, sem novas escritas pelo fluxo novo.

BEGIN;

CREATE TABLE IF NOT EXISTS public.folder_glossary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  original_text text NOT NULL,
  primary_translation text NOT NULL,
  alternative_translations text[] NOT NULL DEFAULT '{}'::text[],
  note text,
  side text NOT NULL DEFAULT 'A' CHECK (side IN ('A', 'B')),
  source_language text,
  target_language text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(btrim(original_text)) > 0),
  CHECK (length(btrim(primary_translation)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_folder_glossary_folder_id
  ON public.folder_glossary(folder_id);
CREATE INDEX IF NOT EXISTS idx_folder_glossary_owner_id
  ON public.folder_glossary(owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_folder_glossary_term_identity
  ON public.folder_glossary(folder_id, side, lower(btrim(original_text)));

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
  NEW.original_text := btrim(regexp_replace(NEW.original_text, '\s+', ' ', 'g'));
  NEW.primary_translation := btrim(regexp_replace(NEW.primary_translation, '\s+', ' ', 'g'));
  NEW.alternative_translations := COALESCE(
    ARRAY(
      SELECT DISTINCT btrim(regexp_replace(value, '\s+', ' ', 'g'))
      FROM unnest(COALESCE(NEW.alternative_translations, '{}'::text[])) value
      WHERE length(btrim(value)) > 0
        AND lower(btrim(value)) <> lower(NEW.primary_translation)
      ORDER BY 1
    ),
    '{}'::text[]
  );
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS folder_glossary_sync_owner ON public.folder_glossary;
CREATE TRIGGER folder_glossary_sync_owner
BEFORE INSERT OR UPDATE ON public.folder_glossary
FOR EACH ROW EXECUTE FUNCTION public.folder_glossary_sync_owner_v1();

CREATE OR REPLACE FUNCTION public.can_read_folder_glossary_v1(
  _folder_id uuid,
  _user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.folders f
    WHERE f.id = _folder_id
      AND f.deleted_at IS NULL
      AND (
        f.owner_id = _user_id
        OR (
          f.class_id IS NOT NULL
          AND (
            public.is_turma_owner(f.class_id, _user_id)
            OR public.is_turma_member(f.class_id, _user_id)
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_folder_glossary_v1(
  _folder_id uuid,
  _user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.folders f
    WHERE f.id = _folder_id
      AND f.deleted_at IS NULL
      AND (
        f.owner_id = _user_id
        OR (f.class_id IS NOT NULL AND public.is_turma_owner(f.class_id, _user_id))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_read_folder_glossary_v1(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_folder_glossary_v1(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_folder_glossary_v1(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_folder_glossary_v1(uuid,uuid) TO authenticated;

ALTER TABLE public.folder_glossary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS folder_glossary_read ON public.folder_glossary;
CREATE POLICY folder_glossary_read
ON public.folder_glossary
FOR SELECT TO authenticated
USING (public.can_read_folder_glossary_v1(folder_id, auth.uid()));

DROP POLICY IF EXISTS folder_glossary_insert ON public.folder_glossary;
CREATE POLICY folder_glossary_insert
ON public.folder_glossary
FOR INSERT TO authenticated
WITH CHECK (public.can_manage_folder_glossary_v1(folder_id, auth.uid()));

DROP POLICY IF EXISTS folder_glossary_update ON public.folder_glossary;
CREATE POLICY folder_glossary_update
ON public.folder_glossary
FOR UPDATE TO authenticated
USING (public.can_manage_folder_glossary_v1(folder_id, auth.uid()))
WITH CHECK (public.can_manage_folder_glossary_v1(folder_id, auth.uid()));

DROP POLICY IF EXISTS folder_glossary_delete ON public.folder_glossary;
CREATE POLICY folder_glossary_delete
ON public.folder_glossary
FOR DELETE TO authenticated
USING (public.can_manage_folder_glossary_v1(folder_id, auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.folder_glossary TO authenticated;

CREATE OR REPLACE FUNCTION public.get_folder_glossary_v1(_folder_id uuid)
RETURNS TABLE (
  id uuid,
  folder_id uuid,
  owner_id uuid,
  original_text text,
  primary_translation text,
  alternative_translations text[],
  note text,
  side text,
  source_language text,
  target_language text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  can_edit boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    g.id,
    g.folder_id,
    g.owner_id,
    g.original_text,
    g.primary_translation,
    g.alternative_translations,
    g.note,
    g.side,
    g.source_language,
    g.target_language,
    g.is_active,
    g.created_at,
    g.updated_at,
    public.can_manage_folder_glossary_v1(g.folder_id, auth.uid()) AS can_edit
  FROM public.folder_glossary g
  WHERE g.folder_id = _folder_id
  ORDER BY lower(g.original_text), g.side, g.created_at;
$$;

CREATE OR REPLACE FUNCTION public.get_folder_glossary_for_list_v1(_list_id uuid)
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
    translation.value AS translated_text,
    g.note,
    g.side,
    g.is_active,
    g.created_at,
    g.updated_at
  FROM public.lists l
  JOIN public.folder_glossary g ON g.folder_id = l.folder_id
  CROSS JOIN LATERAL unnest(
    array_prepend(g.primary_translation, COALESCE(g.alternative_translations, '{}'::text[]))
  ) AS translation(value)
  WHERE l.id = _list_id
    AND l.deleted_at IS NULL
    AND g.is_active = true
  ORDER BY lower(g.original_text),
    CASE WHEN translation.value = g.primary_translation THEN 0 ELSE 1 END,
    lower(translation.value);
$$;

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
    SELECT count(*)::integer INTO v_removed
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
    v_term := NULLIF(btrim(COALESCE(v_entry.value->>'term', v_entry.value->>'original_text')), '');
    v_primary := NULLIF(btrim(COALESCE(
      v_entry.value->>'translation',
      v_entry.value->>'primary_translation',
      v_entry.value #>> '{translations,0}'
    )), '');
    v_side := CASE WHEN upper(COALESCE(v_entry.value->>'side', 'A')) = 'B' THEN 'B' ELSE 'A' END;
    v_note := NULLIF(btrim(v_entry.value->>'note'), '');
    v_source_language := NULLIF(btrim(COALESCE(v_entry.value->>'source_language', v_entry.value->>'sourceLanguage')), '');
    v_target_language := NULLIF(btrim(COALESCE(v_entry.value->>'target_language', v_entry.value->>'targetLanguage')), '');

    IF v_term IS NULL OR v_primary IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT COALESCE(array_agg(DISTINCT clean ORDER BY clean), '{}'::text[])
    INTO v_alternatives
    FROM (
      SELECT btrim(regexp_replace(raw, '\s+', ' ', 'g')) AS clean
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(v_entry.value->'alternatives') = 'array' THEN v_entry.value->'alternatives'
          WHEN jsonb_typeof(v_entry.value->'alternative_translations') = 'array' THEN v_entry.value->'alternative_translations'
          WHEN jsonb_typeof(v_entry.value->'translations') = 'array' THEN v_entry.value->'translations'
          ELSE '[]'::jsonb
        END
      ) AS raw
    ) values_clean
    WHERE length(clean) > 0
      AND lower(clean) <> lower(v_primary);

    SELECT * INTO v_existing
    FROM public.folder_glossary
    WHERE folder_id = _folder_id
      AND side = v_side
      AND lower(btrim(original_text)) = lower(btrim(v_term))
    LIMIT 1;

    IF NOT FOUND THEN
      v_inserted := v_inserted + 1;
      IF NOT _dry_run THEN
        INSERT INTO public.folder_glossary(
          folder_id, owner_id, original_text, primary_translation,
          alternative_translations, note, side,
          source_language, target_language, is_active
        ) VALUES (
          _folder_id, auth.uid(), v_term, v_primary,
          v_alternatives, v_note, v_side,
          v_source_language, v_target_language,
          COALESCE((v_entry.value->>'active')::boolean, true)
        );
      END IF;
    ELSE
      SELECT COALESCE(array_agg(DISTINCT clean ORDER BY clean), '{}'::text[])
      INTO v_merged_alternatives
      FROM (
        SELECT btrim(value) AS clean
        FROM unnest(
          COALESCE(v_existing.alternative_translations, '{}'::text[])
          || v_alternatives
          || CASE
               WHEN lower(v_existing.primary_translation) <> lower(v_primary)
                 THEN ARRAY[v_primary]
               ELSE '{}'::text[]
             END
        ) value
      ) merged
      WHERE length(clean) > 0
        AND lower(clean) <> lower(v_existing.primary_translation);

      IF v_existing.primary_translation = v_primary
         AND COALESCE(v_existing.alternative_translations, '{}'::text[]) = v_merged_alternatives
         AND v_existing.note IS NOT DISTINCT FROM COALESCE(v_note, v_existing.note)
         AND v_existing.is_active IS NOT DISTINCT FROM COALESCE((v_entry.value->>'active')::boolean, v_existing.is_active) THEN
        v_skipped := v_skipped + 1;
      ELSE
        v_updated := v_updated + 1;
        IF NOT _dry_run THEN
          UPDATE public.folder_glossary
          SET alternative_translations = v_merged_alternatives,
              note = COALESCE(v_note, note),
              source_language = COALESCE(v_source_language, source_language),
              target_language = COALESCE(v_target_language, target_language),
              is_active = COALESCE((v_entry.value->>'active')::boolean, is_active),
              updated_at = now()
          WHERE id = v_existing.id;
        END IF;
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

ALTER TABLE public.global_import_items
  DROP CONSTRAINT IF EXISTS global_import_items_entity_type_check;
ALTER TABLE public.global_import_items
  ADD CONSTRAINT global_import_items_entity_type_check
  CHECK (entity_type IN (
    'folder', 'list', 'card', 'glossary', 'assignment',
    'folder_glossary_snapshot'
  ));

CREATE OR REPLACE FUNCTION public.sync_folder_glossaries_from_super_import_v1(
  _batch_id uuid,
  _payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_folder record;
  v_folder_id uuid;
  v_folder_path text;
  v_entries jsonb;
  v_snapshot jsonb;
  v_report jsonb;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.global_import_batches b
    WHERE b.id = _batch_id AND b.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Lote de importação inválido.' USING ERRCODE = '42501';
  END IF;

  FOR v_folder IN
    SELECT value, ordinality
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(_payload #> '{package,folders}') = 'array'
        THEN _payload #> '{package,folders}' ELSE '[]'::jsonb END
    ) WITH ORDINALITY
  LOOP
    v_folder_path := format('package.folders[%s]', v_folder.ordinality - 1);

    SELECT i.entity_id INTO v_folder_id
    FROM public.global_import_items i
    WHERE i.batch_id = _batch_id
      AND i.user_id = v_uid
      AND i.entity_type = 'folder'
      AND i.item_path = v_folder_path
      AND i.entity_id IS NOT NULL
    ORDER BY i.created_at DESC
    LIMIT 1;

    IF v_folder_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(jsonb_agg(entry), '[]'::jsonb)
    INTO v_entries
    FROM (
      SELECT value AS entry
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(v_folder.value->'glossary') = 'array'
          THEN v_folder.value->'glossary' ELSE '[]'::jsonb END
      )
      UNION ALL
      SELECT glossary_entry.value
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(v_folder.value->'lists') = 'array'
          THEN v_folder.value->'lists' ELSE '[]'::jsonb END
      ) list_entry
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(list_entry.value->'glossary') = 'array'
          THEN list_entry.value->'glossary' ELSE '[]'::jsonb END
      ) glossary_entry
    ) combined;

    IF jsonb_array_length(v_entries) = 0 THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(g) ORDER BY g.created_at, g.id), '[]'::jsonb)
    INTO v_snapshot
    FROM public.folder_glossary g
    WHERE g.folder_id = v_folder_id;

    INSERT INTO public.global_import_items(
      batch_id, user_id, entity_type, entity_id, action, item_path, metadata
    ) VALUES (
      _batch_id,
      v_uid,
      'folder_glossary_snapshot',
      v_folder_id,
      'replaced',
      v_folder_path || '.$folder_glossary',
      jsonb_build_object('folder_id', v_folder_id, 'rows', v_snapshot)
    );

    v_report := public.import_folder_glossary_v1(v_folder_id, v_entries, 'merge', false);
    v_inserted := v_inserted + COALESCE((v_report->>'inserted')::integer, 0);
    v_updated := v_updated + COALESCE((v_report->>'updated')::integer, 0);
    v_skipped := v_skipped + COALESCE((v_report->>'skipped')::integer, 0);
    v_folder_id := NULL;
  END LOOP;

  UPDATE public.global_import_batches
  SET summary = COALESCE(summary, '{}'::jsonb) || jsonb_build_object(
        'glossary_scope', 'folder',
        'glossary_created', v_inserted,
        'glossary_updated', v_updated,
        'glossary_skipped', v_skipped
      ),
      options = COALESCE(options, '{}'::jsonb) || jsonb_build_object('glossary_scope', 'folder')
  WHERE id = _batch_id AND user_id = v_uid;

  RETURN jsonb_build_object(
    'batch_id', _batch_id,
    'glossary_scope', 'folder',
    'glossary_created', v_inserted,
    'glossary_updated', v_updated,
    'glossary_skipped', v_skipped
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_folder_glossary_batch_v1(_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item record;
  v_row record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.global_import_batches b
    WHERE b.id = _batch_id AND b.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Lote de importação inválido.' USING ERRCODE = '42501';
  END IF;

  FOR v_item IN
    SELECT *
    FROM public.global_import_items
    WHERE batch_id = _batch_id
      AND user_id = v_uid
      AND entity_type = 'folder_glossary_snapshot'
    ORDER BY created_at DESC
  LOOP
    IF NOT public.can_manage_folder_glossary_v1(v_item.entity_id, v_uid) THEN
      CONTINUE;
    END IF;

    DELETE FROM public.folder_glossary WHERE folder_id = v_item.entity_id;

    FOR v_row IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(v_item.metadata->'rows', '[]'::jsonb))
    LOOP
      INSERT INTO public.folder_glossary(
        id, folder_id, owner_id, original_text, primary_translation,
        alternative_translations, note, side, source_language,
        target_language, is_active, created_at, updated_at
      ) VALUES (
        (v_row.value->>'id')::uuid,
        (v_row.value->>'folder_id')::uuid,
        (v_row.value->>'owner_id')::uuid,
        v_row.value->>'original_text',
        v_row.value->>'primary_translation',
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_row.value->'alternative_translations', '[]'::jsonb))),
        v_row.value->>'note',
        COALESCE(v_row.value->>'side', 'A'),
        v_row.value->>'source_language',
        v_row.value->>'target_language',
        COALESCE((v_row.value->>'is_active')::boolean, true),
        COALESCE((v_row.value->>'created_at')::timestamptz, now()),
        COALESCE((v_row.value->>'updated_at')::timestamptz, now())
      ) ON CONFLICT (id) DO UPDATE SET
        original_text = EXCLUDED.original_text,
        primary_translation = EXCLUDED.primary_translation,
        alternative_translations = EXCLUDED.alternative_translations,
        note = EXCLUDED.note,
        side = EXCLUDED.side,
        source_language = EXCLUDED.source_language,
        target_language = EXCLUDED.target_language,
        is_active = EXCLUDED.is_active,
        updated_at = EXCLUDED.updated_at;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.get_folder_glossary_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_folder_glossary_for_list_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_folder_glossary_v1(uuid,jsonb,text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_folder_glossaries_from_super_import_v1(uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_folder_glossary_batch_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_folder_glossary_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_folder_glossary_for_list_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_folder_glossary_v1(uuid,jsonb,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_folder_glossaries_from_super_import_v1(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_folder_glossary_batch_v1(uuid) TO authenticated;

COMMIT;
