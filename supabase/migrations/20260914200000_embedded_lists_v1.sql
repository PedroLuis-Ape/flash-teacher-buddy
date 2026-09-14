-- PENDENTE DE APLICAÇÃO — não aplicado a nenhum projeto Supabase remoto.
-- Destino final: supabase/migrations/20260914200000_embedded_lists_v1.sql
--
-- Listas combinadas (embedded lists) v1
--
-- Uma lista combinada é uma linha normal em public.lists marcada por
-- public.embedded_lists. A pertinência é SEMPRE por referência
-- (embedded_list_id -> flashcard_id). Nenhum flashcard é copiado, movido,
-- reescrito ou excluído por este recurso: remover ("desincorporar") apaga
-- apenas a linha de pertinência em public.embedded_list_cards.
--
-- Membros são snapshot: cards criados depois nas listas de origem não entram
-- automaticamente. A leitura de estudo devolve as linhas ORIGINAIS de
-- public.flashcards, de modo que edições posteriores aparecem imediatamente.

BEGIN;

CREATE TABLE IF NOT EXISTS public.embedded_lists (
  list_id uuid PRIMARY KEY REFERENCES public.lists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.embedded_list_cards (
  embedded_list_id uuid NOT NULL REFERENCES public.embedded_lists(list_id) ON DELETE CASCADE,
  flashcard_id uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  source_list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  embedded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (embedded_list_id, flashcard_id)
);

-- Redundante com a PK, mas declarado para deixar explícita a invariante:
-- UNIQUE(embedded_list_id, flashcard_id).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'embedded_list_cards_unique_membership'
  ) THEN
    ALTER TABLE public.embedded_list_cards
      ADD CONSTRAINT embedded_list_cards_unique_membership
      UNIQUE (embedded_list_id, flashcard_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS embedded_list_cards_embedded_list_id_idx
  ON public.embedded_list_cards (embedded_list_id);
CREATE INDEX IF NOT EXISTS embedded_list_cards_source_list_id_idx
  ON public.embedded_list_cards (source_list_id);
CREATE INDEX IF NOT EXISTS embedded_list_cards_flashcard_id_idx
  ON public.embedded_list_cards (flashcard_id);

-- Leitura para o dono; mutação apenas pelas RPCs validadas abaixo.
GRANT SELECT ON public.embedded_lists TO authenticated;
GRANT SELECT ON public.embedded_list_cards TO authenticated;
GRANT ALL ON public.embedded_lists TO service_role;
GRANT ALL ON public.embedded_list_cards TO service_role;

ALTER TABLE public.embedded_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embedded_list_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read their embedded list markers" ON public.embedded_lists;
CREATE POLICY "Owners read their embedded list markers"
ON public.embedded_lists
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lists owner_list
    WHERE owner_list.id = embedded_lists.list_id
      AND owner_list.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners read their embedded memberships" ON public.embedded_list_cards;
CREATE POLICY "Owners read their embedded memberships"
ON public.embedded_list_cards
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lists owner_list
    WHERE owner_list.id = embedded_list_cards.embedded_list_id
      AND owner_list.owner_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assert_owned_embedded_list(_embedded_list_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_folder_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão obrigatória para alterar uma lista combinada.';
  END IF;

  SELECT owner_list.folder_id INTO v_folder_id
  FROM public.lists owner_list
  JOIN public.embedded_lists marker ON marker.list_id = owner_list.id
  WHERE owner_list.id = _embedded_list_id
    AND owner_list.owner_id = auth.uid()
    AND owner_list.deleted_at IS NULL;

  IF v_folder_id IS NULL THEN
    RAISE EXCEPTION 'Lista combinada inexistente ou sem permissão.';
  END IF;

  RETURN v_folder_id;
END
$$;

REVOKE ALL ON FUNCTION public.assert_owned_embedded_list(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_owned_embedded_list(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Incorporar listas de origem (snapshot)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.embed_source_lists(
  _embedded_list_id uuid,
  _source_list_ids uuid[]
)
RETURNS TABLE (requested integer, added integer, already_present integer)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_folder_id uuid;
  v_ids uuid[];
  v_valid integer;
  v_requested integer;
  v_added integer;
BEGIN
  v_folder_id := public.assert_owned_embedded_list(_embedded_list_id);

  SELECT COALESCE(array_agg(DISTINCT source_id), '{}'::uuid[])
    INTO v_ids
  FROM unnest(COALESCE(_source_list_ids, '{}'::uuid[])) AS source_id
  WHERE source_id IS NOT NULL;

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0;
    RETURN;
  END IF;

  SELECT COUNT(*)::integer INTO v_valid
  FROM public.lists source_list
  WHERE source_list.id = ANY(v_ids)
    AND source_list.owner_id = auth.uid()
    AND source_list.deleted_at IS NULL
    AND source_list.system_kind = 'user'
    AND source_list.folder_id = v_folder_id
    AND source_list.id <> _embedded_list_id
    AND NOT EXISTS (
      SELECT 1 FROM public.embedded_lists nested WHERE nested.list_id = source_list.id
    );

  IF v_valid <> array_length(v_ids, 1) THEN
    RAISE EXCEPTION 'Lista de origem inválida: use listas normais suas, da mesma pasta.';
  END IF;

  SELECT COUNT(*)::integer INTO v_requested
  FROM public.flashcards card
  WHERE card.list_id = ANY(v_ids)
    AND card.deleted_at IS NULL
    AND card.parent_card_id IS NULL;

  INSERT INTO public.embedded_list_cards (embedded_list_id, flashcard_id, source_list_id)
  SELECT _embedded_list_id, card.id, card.list_id
  FROM public.flashcards card
  WHERE card.list_id = ANY(v_ids)
    AND card.deleted_at IS NULL
    AND card.parent_card_id IS NULL
  ON CONFLICT (embedded_list_id, flashcard_id) DO NOTHING;

  GET DIAGNOSTICS v_added = ROW_COUNT;

  RETURN QUERY SELECT v_requested, v_added, GREATEST(v_requested - v_added, 0);
END
$$;

REVOKE ALL ON FUNCTION public.embed_source_lists(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.embed_source_lists(uuid, uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- Incorporar cards específicos
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.embed_cards(
  _embedded_list_id uuid,
  _flashcard_ids uuid[]
)
RETURNS TABLE (requested integer, added integer, already_present integer)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_folder_id uuid;
  v_ids uuid[];
  v_requested integer;
  v_valid integer;
  v_added integer;
BEGIN
  v_folder_id := public.assert_owned_embedded_list(_embedded_list_id);

  SELECT COALESCE(array_agg(DISTINCT card_id), '{}'::uuid[])
    INTO v_ids
  FROM unnest(COALESCE(_flashcard_ids, '{}'::uuid[])) AS card_id
  WHERE card_id IS NOT NULL;

  v_requested := COALESCE(array_length(v_ids, 1), 0);
  IF v_requested = 0 THEN
    RETURN QUERY SELECT 0, 0, 0;
    RETURN;
  END IF;

  SELECT COUNT(*)::integer INTO v_valid
  FROM public.flashcards card
  JOIN public.lists source_list ON source_list.id = card.list_id
  WHERE card.id = ANY(v_ids)
    AND card.deleted_at IS NULL
    AND card.parent_card_id IS NULL
    AND source_list.owner_id = auth.uid()
    AND source_list.deleted_at IS NULL
    AND source_list.system_kind = 'user'
    AND source_list.folder_id = v_folder_id
    AND source_list.id <> _embedded_list_id
    AND NOT EXISTS (
      SELECT 1 FROM public.embedded_lists nested WHERE nested.list_id = source_list.id
    );

  IF v_valid <> v_requested THEN
    RAISE EXCEPTION 'Card inválido para incorporação: use cards seus, de listas normais da mesma pasta.';
  END IF;

  INSERT INTO public.embedded_list_cards (embedded_list_id, flashcard_id, source_list_id)
  SELECT _embedded_list_id, card.id, card.list_id
  FROM public.flashcards card
  WHERE card.id = ANY(v_ids)
  ON CONFLICT (embedded_list_id, flashcard_id) DO NOTHING;

  GET DIAGNOSTICS v_added = ROW_COUNT;

  RETURN QUERY SELECT v_requested, v_added, GREATEST(v_requested - v_added, 0);
END
$$;

REVOKE ALL ON FUNCTION public.embed_cards(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.embed_cards(uuid, uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- Criar lista combinada
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_embedded_list(
  _folder_id uuid,
  _title text,
  _description text DEFAULT NULL,
  _source_list_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS TABLE (list_id uuid, requested integer, added integer, already_present integer)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_folder public.folders;
  v_list_id uuid;
  v_title text;
  v_counts record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão obrigatória para criar uma lista combinada.';
  END IF;

  v_title := NULLIF(btrim(COALESCE(_title, '')), '');
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Informe um título para a lista combinada.';
  END IF;

  IF (
    SELECT COUNT(DISTINCT source_id)
    FROM unnest(COALESCE(_source_list_ids, '{}'::uuid[])) AS source_id
    WHERE source_id IS NOT NULL
  ) < 1 THEN
    RAISE EXCEPTION 'Selecione pelo menos uma lista de origem para a lista combinada.';
  END IF;

  -- v1: escopo privado do dono. Pastas de turma ficam fora.
  SELECT * INTO v_folder
  FROM public.folders
  WHERE id = _folder_id
    AND owner_id = auth.uid()
    AND deleted_at IS NULL
    AND system_kind = 'user'
    AND class_id IS NULL;

  IF v_folder.id IS NULL THEN
    RAISE EXCEPTION 'Pasta inexistente, de turma ou sem permissão.';
  END IF;

  INSERT INTO public.lists (
    folder_id, owner_id, title, description, order_index, visibility,
    study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled
  )
  VALUES (
    v_folder.id,
    auth.uid(),
    v_title,
    NULLIF(btrim(COALESCE(_description, '')), ''),
    COALESCE((SELECT MAX(order_index) + 1 FROM public.lists WHERE folder_id = v_folder.id), 0),
    'private',
    v_folder.study_type,
    v_folder.lang_a,
    v_folder.lang_b,
    v_folder.labels_a,
    v_folder.labels_b,
    v_folder.tts_enabled
  )
  RETURNING id INTO v_list_id;

  INSERT INTO public.embedded_lists (list_id) VALUES (v_list_id);

  SELECT * INTO v_counts
  FROM public.embed_source_lists(v_list_id, COALESCE(_source_list_ids, '{}'::uuid[]));

  RETURN QUERY SELECT v_list_id, v_counts.requested, v_counts.added, v_counts.already_present;
END
$$;

REVOKE ALL ON FUNCTION public.create_embedded_list(uuid, text, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_embedded_list(uuid, text, text, uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- Remover pertinência (NUNCA apaga flashcards)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.unembed_cards(
  _embedded_list_id uuid,
  _flashcard_ids uuid[]
)
RETURNS TABLE (requested integer, removed integer)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids uuid[];
  v_removed integer;
BEGIN
  PERFORM public.assert_owned_embedded_list(_embedded_list_id);

  SELECT COALESCE(array_agg(DISTINCT card_id), '{}'::uuid[])
    INTO v_ids
  FROM unnest(COALESCE(_flashcard_ids, '{}'::uuid[])) AS card_id
  WHERE card_id IS NOT NULL;

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  DELETE FROM public.embedded_list_cards
  WHERE embedded_list_id = _embedded_list_id
    AND flashcard_id = ANY(v_ids);

  GET DIAGNOSTICS v_removed = ROW_COUNT;

  RETURN QUERY SELECT array_length(v_ids, 1)::integer, v_removed;
END
$$;

REVOKE ALL ON FUNCTION public.unembed_cards(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unembed_cards(uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.unembed_source_list(
  _embedded_list_id uuid,
  _source_list_id uuid
)
RETURNS TABLE (removed integer)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_removed integer;
BEGIN
  PERFORM public.assert_owned_embedded_list(_embedded_list_id);

  DELETE FROM public.embedded_list_cards
  WHERE embedded_list_id = _embedded_list_id
    AND source_list_id = _source_list_id;

  GET DIAGNOSTICS v_removed = ROW_COUNT;

  RETURN QUERY SELECT v_removed;
END
$$;

REVOKE ALL ON FUNCTION public.unembed_source_list(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unembed_source_list(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_embedded_list(_embedded_list_id uuid)
RETURNS TABLE (removed integer)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_removed integer;
BEGIN
  PERFORM public.assert_owned_embedded_list(_embedded_list_id);

  DELETE FROM public.embedded_list_cards
  WHERE embedded_list_id = _embedded_list_id;

  GET DIAGNOSTICS v_removed = ROW_COUNT;

  RETURN QUERY SELECT v_removed;
END
$$;

REVOKE ALL ON FUNCTION public.clear_embedded_list(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_embedded_list(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Leitura de gerenciamento
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_embedded_list_members(_embedded_list_id uuid)
RETURNS TABLE (
  flashcard_id uuid,
  source_list_id uuid,
  source_list_title text,
  source_reference_id text,
  embedded_at timestamptz,
  term text,
  translation text,
  is_playable boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.assert_owned_embedded_list(_embedded_list_id);

  RETURN QUERY
  SELECT
    member.flashcard_id,
    member.source_list_id,
    source_list.title,
    source_list.reference_id,
    member.embedded_at,
    card.term,
    card.translation,
    (card.id IS NOT NULL AND card.deleted_at IS NULL) AS is_playable
  FROM public.embedded_list_cards member
  LEFT JOIN public.flashcards card ON card.id = member.flashcard_id
  LEFT JOIN public.lists source_list ON source_list.id = member.source_list_id
  WHERE member.embedded_list_id = _embedded_list_id
  ORDER BY source_list.title ASC NULLS LAST, member.embedded_at ASC, member.flashcard_id ASC;
END
$$;

REVOKE ALL ON FUNCTION public.get_embedded_list_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_embedded_list_members(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Leitura de estudo: devolve as linhas ORIGINAIS de flashcards
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_embedded_list_flashcards(_list_id uuid)
RETURNS SETOF public.flashcards
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.assert_owned_embedded_list(_list_id);

  RETURN QUERY
  SELECT card.*
  FROM public.flashcards card
  WHERE card.deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.embedded_list_cards member
        WHERE member.embedded_list_id = _list_id
          AND member.flashcard_id = card.id
      )
      OR (
        card.parent_card_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.embedded_list_cards member
          WHERE member.embedded_list_id = _list_id
            AND member.flashcard_id = card.parent_card_id
        )
      )
    )
  ORDER BY card.created_at ASC, card.id ASC;
END
$$;

REVOKE ALL ON FUNCTION public.get_embedded_list_flashcards(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_embedded_list_flashcards(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_embedded_list_card_count(_list_id uuid)
RETURNS TABLE (resource_exists boolean, raw_count bigint, playable_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_raw bigint;
  v_playable bigint;
BEGIN
  PERFORM public.assert_owned_embedded_list(_list_id);

  SELECT COUNT(*)::bigint INTO v_raw
  FROM public.embedded_list_cards member
  WHERE member.embedded_list_id = _list_id;

  SELECT COUNT(*)::bigint INTO v_playable
  FROM public.embedded_list_cards member
  JOIN public.flashcards card ON card.id = member.flashcard_id
  WHERE member.embedded_list_id = _list_id
    AND card.deleted_at IS NULL;

  RETURN QUERY SELECT true, v_raw, v_playable;
END
$$;

REVOKE ALL ON FUNCTION public.get_embedded_list_card_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_embedded_list_card_count(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Contagem na pasta: listas combinadas mostram os cards referenciados
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_lists_with_card_counts(uuid);

CREATE FUNCTION public.get_lists_with_card_counts(_folder_id uuid)
RETURNS TABLE (
  id uuid,
  folder_id uuid,
  owner_id uuid,
  title text,
  reference_id text,
  description text,
  order_index integer,
  visibility text,
  lang text,
  class_id uuid,
  institution_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  card_count bigint,
  last_activity timestamptz,
  is_embedded boolean,
  source_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    list_row.id,
    list_row.folder_id,
    list_row.owner_id,
    list_row.title,
    list_row.reference_id,
    list_row.description,
    list_row.order_index,
    list_row.visibility,
    list_row.lang,
    list_row.class_id,
    list_row.institution_id,
    list_row.created_at,
    list_row.updated_at,
    CASE
      WHEN marker.list_id IS NOT NULL THEN (
        SELECT COUNT(*)::bigint
        FROM public.embedded_list_cards member
        JOIN public.flashcards card ON card.id = member.flashcard_id
        WHERE member.embedded_list_id = list_row.id
          AND card.deleted_at IS NULL
          AND card.parent_card_id IS NULL
      )
      ELSE (
        SELECT COUNT(*)::bigint
        FROM public.flashcards card
        WHERE card.list_id = list_row.id
          AND card.deleted_at IS NULL
          AND card.parent_card_id IS NULL
      )
    END AS card_count,
    CASE
      WHEN list_row.class_id IS NULL
        THEN GREATEST(activity.last_studied_at, activity.last_opened_at)
      ELSE NULL
    END AS last_activity,
    (marker.list_id IS NOT NULL) AS is_embedded,
    CASE
      WHEN marker.list_id IS NOT NULL THEN (
        SELECT COUNT(DISTINCT member.source_list_id)::bigint
        FROM public.embedded_list_cards member
        WHERE member.embedded_list_id = list_row.id
      )
      ELSE 0::bigint
    END AS source_count
  FROM public.lists list_row
  LEFT JOIN public.embedded_lists marker
    ON marker.list_id = list_row.id
  LEFT JOIN public.user_list_activity activity
    ON activity.list_id = list_row.id
   AND activity.user_id = auth.uid()
  WHERE list_row.folder_id = _folder_id
    AND list_row.deleted_at IS NULL
  ORDER BY
    CASE
      WHEN list_row.class_id IS NULL
        THEN GREATEST(activity.last_studied_at, activity.last_opened_at)
      ELSE NULL
    END DESC NULLS LAST,
    list_row.order_index ASC NULLS LAST,
    list_row.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_lists_with_card_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lists_with_card_counts(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Defesa: listas combinadas permanecem privadas mesmo em atualização em massa
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.keep_embedded_lists_private()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.embedded_lists WHERE list_id = NEW.id) THEN
    NEW.visibility := 'private';
    NEW.class_id := NULL;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS keep_embedded_lists_private_trg ON public.lists;
CREATE TRIGGER keep_embedded_lists_private_trg
  BEFORE UPDATE OF visibility, class_id ON public.lists
  FOR EACH ROW
  EXECUTE FUNCTION public.keep_embedded_lists_private();

COMMIT;

NOTIFY pgrst, 'reload schema';
