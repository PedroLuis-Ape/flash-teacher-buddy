BEGIN;

-- "Revisar cards / Revisar depois": QA de CONTEÚDO do flashcard.
--
-- Domínio separado de Pontos de atenção (`user_special_flashcards`,
-- `set_user_attention_point`), que trata dificuldade pedagógica/exportação.
-- Aqui a identidade é o FLASHCARD EXATO (ou a camada exata), nunca o
-- `source_group_uid`: duas camadas da mesma família podem precisar de revisão ao
-- mesmo tempo.
--
-- Migration ADITIVA: não altera, renomeia nem apaga nada do que já existe.
-- Não toca flashcards, flashcard_progress, study_sessions, favoritos, Lista
-- Vermelha, Reforço nem Pontos de atenção.

CREATE TABLE IF NOT EXISTS public.user_flashcard_review_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flashcard_id uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  -- Só contexto/agregação: nunca usado como identidade da fila.
  source_group_uid uuid NULL,
  source_list_id uuid NULL REFERENCES public.lists(id) ON DELETE SET NULL,
  institution_id uuid NULL REFERENCES public.institutions(id) ON DELETE SET NULL,
  reason text NULL,
  note text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL
);

-- Um item ativo por (usuário, flashcard). Registros resolvidos podem acumular
-- histórico sem bloquear uma nova marcação do mesmo card depois.
CREATE UNIQUE INDEX IF NOT EXISTS user_flashcard_review_flags_active_key
  ON public.user_flashcard_review_flags (user_id, flashcard_id)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_ufrf_user_active
  ON public.user_flashcard_review_flags (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_ufrf_user_list_active
  ON public.user_flashcard_review_flags (user_id, source_list_id, is_active);

CREATE INDEX IF NOT EXISTS idx_ufrf_user_card
  ON public.user_flashcard_review_flags (user_id, flashcard_id);

ALTER TABLE public.user_flashcard_review_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own flashcard review flags"
  ON public.user_flashcard_review_flags;
CREATE POLICY "Users can view their own flashcard review flags"
  ON public.user_flashcard_review_flags
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own flashcard review flags"
  ON public.user_flashcard_review_flags;
CREATE POLICY "Users can insert their own flashcard review flags"
  ON public.user_flashcard_review_flags
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own flashcard review flags"
  ON public.user_flashcard_review_flags;
CREATE POLICY "Users can update their own flashcard review flags"
  ON public.user_flashcard_review_flags
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

/**
 * Toggle idempotente da fila de revisão.
 *
 * ON  -> reativa/atualiza o registro ativo do card exato.
 * OFF -> soft resolve (is_active=false, resolved_at=now()). NUNCA DELETE físico:
 *        o histórico precisa ser reversível e o conteúdo original é intocável.
 *
 * Não clona, não move, não altera progresso, sessão, favoritos, Lista Vermelha,
 * Reforço nem Pontos de atenção.
 */
CREATE OR REPLACE FUNCTION public.set_user_flashcard_review_flag(
  _flashcard_id uuid,
  _enabled boolean,
  _institution_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL,
  _note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_card RECORD;
  v_flag_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'E_UNAUTHENTICATED|Sessão ausente ou expirada.' USING ERRCODE = '42501';
  END IF;

  SELECT c.id, c.list_id, c.parent_card_id, c.status_group_uid
    INTO v_card
    FROM public.flashcards c
   WHERE c.id = _flashcard_id
     AND c.deleted_at IS NULL;

  IF v_card.id IS NULL THEN
    RAISE EXCEPTION 'E_NOT_FOUND|Flashcard inexistente ou removido.' USING ERRCODE = '42501';
  END IF;

  -- Acesso de leitura: dono do card, dono da lista ou lista pública/portal.
  -- Sem SECURITY DEFINER para burlar propriedade: quem não pode ler, não marca.
  IF NOT (
    v_card.list_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.lists l
       WHERE l.id = v_card.list_id
         AND l.deleted_at IS NULL
         AND (l.owner_id = v_uid OR l.visibility = 'public')
    )
  ) THEN
    RAISE EXCEPTION 'E_FORBIDDEN|Você não possui acesso a este card.' USING ERRCODE = '42501';
  END IF;

  IF _enabled IS DISTINCT FROM true THEN
    UPDATE public.user_flashcard_review_flags
       SET is_active = false,
           resolved_at = now(),
           updated_at = now()
     WHERE user_id = v_uid
       AND flashcard_id = _flashcard_id
       AND is_active;

    RETURN jsonb_build_object(
      'enabled', false,
      'flag_id', NULL,
      'flashcard_id', _flashcard_id
    );
  END IF;

  SELECT id INTO v_flag_id
    FROM public.user_flashcard_review_flags
   WHERE user_id = v_uid
     AND flashcard_id = _flashcard_id
     AND is_active
   LIMIT 1;

  IF v_flag_id IS NULL THEN
    INSERT INTO public.user_flashcard_review_flags (
      user_id, flashcard_id, source_group_uid, source_list_id, institution_id,
      reason, note, is_active, created_at, updated_at, resolved_at
    ) VALUES (
      v_uid, _flashcard_id, v_card.status_group_uid, v_card.list_id, _institution_id,
      NULLIF(BTRIM(COALESCE(_reason, '')), ''), NULLIF(BTRIM(COALESCE(_note, '')), ''),
      true, now(), now(), NULL
    )
    RETURNING id INTO v_flag_id;
  ELSE
    UPDATE public.user_flashcard_review_flags
       SET reason = COALESCE(NULLIF(BTRIM(COALESCE(_reason, '')), ''), reason),
           note = COALESCE(NULLIF(BTRIM(COALESCE(_note, '')), ''), note),
           institution_id = COALESCE(_institution_id, institution_id),
           updated_at = now()
     WHERE id = v_flag_id;
  END IF;

  RETURN jsonb_build_object(
    'enabled', true,
    'flag_id', v_flag_id,
    'flashcard_id', _flashcard_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_flashcard_review_flag(uuid, boolean, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_flashcard_review_flag(uuid, boolean, uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_user_flashcard_review_flag(uuid, boolean, uuid, text, text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
