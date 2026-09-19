-- =====================================================================
-- Invalidação de estado derivado da identidade do flashcard (v1)
-- =====================================================================
-- Contexto auditado:
--   * flashcards usam SOFT DELETE (deleted_at). As foreign keys
--     ON DELETE CASCADE de user_red_list, user_special_flashcards,
--     user_reinforcement_points e flashcard_progress NÃO disparam no
--     fluxo normal de exclusão.
--   * user_favorites foi reescrita como tabela genérica
--     (resource_type/resource_id) e NÃO tem FK para flashcards, portanto
--     nada limpa favoritos quando o card é removido em definitivo.
--
-- Escopo desta migration:
--   1. pruning canônico de referências órfãs (card inexistente);
--   2. trigger de limpeza no delete físico de flashcard.
--
-- O que esta migration NÃO faz:
--   * NÃO apaga estado derivado de card apenas soft-deleted (lixeira).
--     O "Desfazer" da exclusão dura 2 minutos e depende desse estado.
--     A invalidação de card soft-deleted é feita na leitura: as consultas
--     e RPCs filtram deleted_at IS NULL, e as sessões de estudo já são
--     revalidadas contra os ids elegíveis no restore (restoreStudySession).
--   * NÃO cria coluna de revision. O mecanismo equivalente já existe:
--     sessões persistidas são revalidadas contra os ids vivos no restore,
--     descartando ids mortos e reindexando a fila.
-- =====================================================================

BEGIN;

-- Indice parcial que mantem a limpeza de favoritos barata: o trigger roda a
-- cada DELETE fisico de flashcard (inclusive em cascata de lista/pasta).
CREATE INDEX IF NOT EXISTS idx_user_favorites_flashcard_resource_v1
  ON public.user_favorites (resource_id)
  WHERE resource_type = 'flashcard';

-- ---------------------------------------------------------------------
-- 1) Pruning user-scoped das referências órfãs
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_my_orphan_flashcard_derived_state_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_favorites int := 0;
  v_red_list int := 0;
  v_attention int := 0;
  v_review_flags int := 0;
  v_reinforcement int := 0;
  v_progress int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501';
  END IF;

  -- Favoritos: tabela genérica sem FK, então o órfão real precisa ser removido aqui.
  WITH dead AS (
    SELECT uf.ctid
    FROM public.user_favorites uf
    WHERE uf.user_id = v_uid
      AND uf.resource_type = 'flashcard'
      AND NOT EXISTS (SELECT 1 FROM public.flashcards f WHERE f.id = uf.resource_id)
  )
  DELETE FROM public.user_favorites uf USING dead d WHERE uf.ctid = d.ctid;
  GET DIAGNOSTICS v_favorites = ROW_COUNT;

  -- Lista Vermelha: defensivo; a FK física já cobre delete real.
  WITH dead AS (
    SELECT ur.ctid
    FROM public.user_red_list ur
    WHERE ur.user_id = v_uid
      AND NOT EXISTS (SELECT 1 FROM public.flashcards f WHERE f.id = ur.flashcard_id)
  )
  DELETE FROM public.user_red_list ur USING dead d WHERE ur.ctid = d.ctid;
  GET DIAGNOSTICS v_red_list = ROW_COUNT;

  -- Pontos de atenção: desativação canônica (mesma semântica do OFF).
  WITH dead AS (
    SELECT s.id
    FROM public.user_special_flashcards s
    WHERE s.user_id = v_uid
      AND s.is_active = true
      AND NOT EXISTS (SELECT 1 FROM public.flashcards f WHERE f.id = s.flashcard_id)
  )
  UPDATE public.user_special_flashcards s
  SET is_active = false, deactivated_at = COALESCE(s.deactivated_at, now()), updated_at = now()
  FROM dead
  WHERE s.id = dead.id;
  GET DIAGNOSTICS v_attention = ROW_COUNT;

  -- Revisar cards / Revisar depois: mesma regra, dominio separado.
  WITH dead AS (
    SELECT r.id
    FROM public.user_flashcard_review_flags r
    WHERE r.user_id = v_uid
      AND r.is_active = true
      AND NOT EXISTS (SELECT 1 FROM public.flashcards f WHERE f.id = r.flashcard_id)
  )
  UPDATE public.user_flashcard_review_flags r
  SET is_active = false,
      resolved_at = COALESCE(r.resolved_at, now()),
      updated_at = now()
  FROM dead
  WHERE r.id = dead.id;
  GET DIAGNOSTICS v_review_flags = ROW_COUNT;

  -- Reforço: sem card de origem não existe materialização válida.
  PERFORM set_config('app.allow_system_collection_mutation', 'on', true);

  SELECT count(*) INTO v_reinforcement
  FROM public.user_reinforcement_points p
  WHERE p.user_id = v_uid
    AND p.is_active = true
    AND NOT EXISTS (SELECT 1 FROM public.flashcards f WHERE f.id = p.source_card_id);

  IF v_reinforcement > 0 THEN
    -- Remove o progresso do clone órfão.
    DELETE FROM public.flashcard_progress fp
    USING public.flashcards c, public.user_reinforcement_points p
    WHERE p.user_id = v_uid
      AND p.is_active = true
      AND NOT EXISTS (SELECT 1 FROM public.flashcards src WHERE src.id = p.source_card_id)
      AND p.materialization_list_id IS NOT NULL
      AND p.materialization_group_id IS NOT NULL
      AND fp.user_id = v_uid
      AND fp.list_id = p.materialization_list_id
      AND fp.flashcard_id = c.id
      AND c.list_id = p.materialization_list_id
      AND (c.id = p.materialization_group_id OR c.parent_card_id = p.materialization_group_id);

    -- Desmaterializa o clone integral daquele grupo.
    UPDATE public.flashcards c
    SET deleted_at = COALESCE(c.deleted_at, now()), updated_at = now()
    FROM public.user_reinforcement_points p
    WHERE p.user_id = v_uid
      AND p.is_active = true
      AND NOT EXISTS (SELECT 1 FROM public.flashcards src WHERE src.id = p.source_card_id)
      AND p.materialization_list_id IS NOT NULL
      AND p.materialization_group_id IS NOT NULL
      AND c.list_id = p.materialization_list_id
      AND (c.id = p.materialization_group_id OR c.parent_card_id = p.materialization_group_id);

    UPDATE public.user_reinforcement_points p
    SET is_active = false, deactivated_at = now(), updated_at = now()
    WHERE p.user_id = v_uid
      AND p.is_active = true
      AND NOT EXISTS (SELECT 1 FROM public.flashcards f WHERE f.id = p.source_card_id);
  END IF;

  -- Progresso por card: nenhuma feature deve manter progresso de card inexistente.
  WITH dead AS (
    SELECT fp.ctid
    FROM public.flashcard_progress fp
    WHERE fp.user_id = v_uid
      AND NOT EXISTS (SELECT 1 FROM public.flashcards f WHERE f.id = fp.flashcard_id)
  )
  DELETE FROM public.flashcard_progress fp USING dead d WHERE fp.ctid = d.ctid;
  GET DIAGNOSTICS v_progress = ROW_COUNT;

  RETURN jsonb_build_object(
    'favorites_removed', v_favorites,
    'red_list_removed', v_red_list,
    'attention_deactivated', v_attention,
    'review_flags_resolved', v_review_flags,
    'reinforcement_deactivated', v_reinforcement,
    'progress_removed', v_progress
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prune_my_orphan_flashcard_derived_state_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prune_my_orphan_flashcard_derived_state_v1() TO authenticated;

-- ---------------------------------------------------------------------
-- 2) Delete físico de flashcard limpa favoritos (user_favorites não tem FK)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_flashcard_favorites_after_delete_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.user_favorites
  WHERE resource_type = 'flashcard'
    AND resource_id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prune_flashcard_favorites_v1 ON public.flashcards;
CREATE TRIGGER trg_prune_flashcard_favorites_v1
AFTER DELETE ON public.flashcards
FOR EACH ROW EXECUTE FUNCTION public.prune_flashcard_favorites_after_delete_v1();

NOTIFY pgrst, 'reload schema';

COMMIT;

-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- BEGIN;
--   DROP TRIGGER IF EXISTS trg_prune_flashcard_favorites_v1 ON public.flashcards;
--   DROP FUNCTION IF EXISTS public.prune_flashcard_favorites_after_delete_v1();
--   REVOKE ALL ON FUNCTION public.prune_my_orphan_flashcard_derived_state_v1()
--     FROM authenticated;
--   DROP FUNCTION IF EXISTS public.prune_my_orphan_flashcard_derived_state_v1();
-- COMMIT;
-- =====================================================================
