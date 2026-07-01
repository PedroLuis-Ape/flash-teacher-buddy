-- App Piteco — integridade estrutural dos flashcards em camadas
BEGIN;

ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS smart_key text,
  ADD COLUMN IF NOT EXISTS is_layer_group boolean NOT NULL DEFAULT false;

UPDATE public.flashcards parent
SET is_layer_group = true
WHERE parent.parent_card_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.flashcards child
    WHERE child.parent_card_id = parent.id
  );

UPDATE public.flashcards
SET layer_index = NULL
WHERE parent_card_id IS NULL
  AND layer_index IS NOT NULL;

WITH ordered AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY parent_card_id
      ORDER BY layer_index NULLS LAST, created_at, id
    ) - 1 AS next_index
  FROM public.flashcards
  WHERE parent_card_id IS NOT NULL
)
UPDATE public.flashcards card
SET layer_index = ordered.next_index
FROM ordered
WHERE card.id = ordered.id;

ALTER TABLE public.flashcards
  DROP CONSTRAINT IF EXISTS flashcards_layer_linkage_check;

ALTER TABLE public.flashcards
  ADD CONSTRAINT flashcards_layer_linkage_check
  CHECK (
    (parent_card_id IS NULL AND layer_index IS NULL)
    OR
    (parent_card_id IS NOT NULL AND layer_index IS NOT NULL AND layer_index >= 0 AND is_layer_group = false)
  ) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcards_active_parent_layer_index
  ON public.flashcards(parent_card_id, layer_index)
  WHERE parent_card_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcards_active_smart_key
  ON public.flashcards(list_id, smart_key)
  WHERE smart_key IS NOT NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.validate_flashcard_layer_link_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent public.flashcards%ROWTYPE;
BEGIN
  IF NEW.parent_card_id IS NULL THEN
    IF NEW.layer_index IS NOT NULL THEN
      RAISE EXCEPTION 'layer_index só pode existir em uma camada.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS NOT NULL AND NEW.parent_card_id = NEW.id THEN
    RAISE EXCEPTION 'Um flashcard não pode ser pai de si mesmo.';
  END IF;
  IF NEW.layer_index IS NULL OR NEW.layer_index < 0 THEN
    RAISE EXCEPTION 'Toda camada precisa de layer_index não negativo.';
  END IF;
  IF NEW.is_layer_group THEN
    RAISE EXCEPTION 'Uma camada não pode ser marcada como grupo principal.';
  END IF;

  SELECT * INTO v_parent
  FROM public.flashcards
  WHERE id = NEW.parent_card_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card principal da camada não encontrado.';
  END IF;
  IF v_parent.parent_card_id IS NOT NULL THEN
    RAISE EXCEPTION 'Grupos em camadas não podem ser aninhados.';
  END IF;
  IF NOT v_parent.is_layer_group THEN
    RAISE EXCEPTION 'A camada precisa apontar para um grupo principal válido.';
  END IF;
  IF v_parent.list_id IS DISTINCT FROM NEW.list_id THEN
    RAISE EXCEPTION 'Card principal e camada precisam pertencer à mesma lista.';
  END IF;
  IF v_parent.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Card principal e camada precisam pertencer ao mesmo proprietário.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_flashcard_layer_link_v1 ON public.flashcards;
CREATE TRIGGER trg_validate_flashcard_layer_link_v1
BEFORE INSERT OR UPDATE OF parent_card_id, layer_index, list_id, user_id, is_layer_group
ON public.flashcards
FOR EACH ROW
EXECUTE FUNCTION public.validate_flashcard_layer_link_v1();

CREATE OR REPLACE FUNCTION public.assert_layer_group_size_v1(_parent_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF _parent_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.flashcards
    WHERE id = _parent_id
      AND deleted_at IS NULL
      AND is_layer_group = true
  ) THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.flashcards
  WHERE parent_card_id = _parent_id
    AND deleted_at IS NULL;

  IF v_count < 2 THEN
    RAISE EXCEPTION 'Um grupo em camadas precisa terminar a transação com pelo menos duas camadas.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_layer_group_size_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.assert_layer_group_size_v1(NEW.parent_card_id);
    IF NEW.is_layer_group THEN
      PERFORM public.assert_layer_group_size_v1(NEW.id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.assert_layer_group_size_v1(OLD.parent_card_id);
    IF OLD.is_layer_group THEN
      PERFORM public.assert_layer_group_size_v1(OLD.id);
    END IF;
  ELSE
    PERFORM public.assert_layer_group_size_v1(OLD.parent_card_id);
    IF NEW.parent_card_id IS DISTINCT FROM OLD.parent_card_id THEN
      PERFORM public.assert_layer_group_size_v1(NEW.parent_card_id);
    END IF;
    IF OLD.is_layer_group OR NEW.is_layer_group THEN
      PERFORM public.assert_layer_group_size_v1(NEW.id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_layer_group_size_v1 ON public.flashcards;
CREATE CONSTRAINT TRIGGER trg_validate_layer_group_size_v1
AFTER INSERT OR UPDATE OR DELETE ON public.flashcards
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.validate_layer_group_size_v1();

CREATE OR REPLACE FUNCTION public.merge_cards_into_layers(
  _list_id uuid,
  _card_ids uuid[],
  _title text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_list record;
  v_user_id uuid := auth.uid();
  v_title text := NULLIF(BTRIM(_title), '');
  v_card_count integer := COALESCE(array_length(_card_ids, 1), 0);
  v_unique_count integer;
  v_principal_id uuid;
  v_first_translation text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED', 'message', 'Você precisa estar logado.');
  END IF;
  IF v_card_count < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT', 'message', 'Selecione pelo menos 2 cards para mesclar.');
  END IF;
  IF v_title IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT', 'message', 'Defina um título para o card principal.');
  END IF;

  SELECT l.id, l.owner_id, l.class_id, t.owner_teacher_id
  INTO v_list
  FROM public.lists l
  LEFT JOIN public.turmas t ON t.id = l.class_id
  WHERE l.id = _list_id
    AND l.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Lista não encontrada.');
  END IF;
  IF v_list.owner_id <> v_user_id
     AND (v_list.class_id IS NULL OR v_list.owner_teacher_id IS DISTINCT FROM v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Você não tem permissão para mesclar cards desta lista.');
  END IF;

  SELECT count(DISTINCT card_id)::integer
  INTO v_unique_count
  FROM unnest(_card_ids) AS selected(card_id);

  IF v_unique_count <> v_card_count THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT', 'message', 'Há cards repetidos na seleção.');
  END IF;

  SELECT count(*)::integer
  INTO v_unique_count
  FROM public.flashcards f
  WHERE f.id = ANY(_card_ids)
    AND f.list_id = _list_id
    AND f.user_id = v_user_id
    AND f.deleted_at IS NULL
    AND f.parent_card_id IS NULL
    AND f.is_layer_group = false;

  IF v_unique_count <> v_card_count THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT', 'message', 'Alguns cards não podem ser mesclados ou já pertencem a camadas.');
  END IF;

  SELECT f.translation
  INTO v_first_translation
  FROM unnest(_card_ids) WITH ORDINALITY AS input(card_id, ord)
  JOIN public.flashcards f ON f.id = input.card_id
  ORDER BY input.ord
  LIMIT 1;

  INSERT INTO public.flashcards(
    list_id, user_id, term, translation, context_tag, is_layer_group
  ) VALUES (
    _list_id, v_user_id, v_title, COALESCE(v_first_translation, ''), v_title, true
  ) RETURNING id INTO v_principal_id;

  UPDATE public.flashcards f
  SET parent_card_id = v_principal_id,
      layer_index = input.ord - 1,
      is_layer_group = false,
      updated_at = now()
  FROM unnest(_card_ids) WITH ORDINALITY AS input(card_id, ord)
  WHERE f.id = input.card_id;

  RETURN jsonb_build_object(
    'success', true,
    'principal_id', v_principal_id,
    'layer_count', v_card_count,
    'message', format('%s cards mesclados em camadas.', v_card_count)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'INTERNAL_ERROR', 'message', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.unmerge_layered_card(_principal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_card record;
  v_user_id uuid := auth.uid();
  v_layer_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED', 'message', 'Você precisa estar logado.');
  END IF;

  SELECT f.id, f.list_id, l.owner_id, l.class_id, t.owner_teacher_id
  INTO v_card
  FROM public.flashcards f
  JOIN public.lists l ON l.id = f.list_id
  LEFT JOIN public.turmas t ON t.id = l.class_id
  WHERE f.id = _principal_id
    AND f.deleted_at IS NULL
    AND f.parent_card_id IS NULL
    AND f.is_layer_group = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Card principal não encontrado.');
  END IF;
  IF v_card.owner_id <> v_user_id
     AND (v_card.class_id IS NULL OR v_card.owner_teacher_id IS DISTINCT FROM v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Você não tem permissão para separar estas camadas.');
  END IF;

  UPDATE public.flashcards
  SET parent_card_id = NULL,
      layer_index = NULL,
      updated_at = now()
  WHERE parent_card_id = _principal_id
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_layer_count = ROW_COUNT;

  UPDATE public.flashcards
  SET is_layer_group = false,
      deleted_at = now(),
      updated_at = now()
  WHERE id = _principal_id
    AND deleted_at IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'layer_count', v_layer_count,
    'message', 'Camadas separadas com sucesso.'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'INTERNAL_ERROR', 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.validate_flashcard_layer_link_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_layer_group_size_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_layer_group_size_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_cards_into_layers(uuid,uuid[],text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unmerge_layered_card(uuid) TO authenticated;

COMMIT;
