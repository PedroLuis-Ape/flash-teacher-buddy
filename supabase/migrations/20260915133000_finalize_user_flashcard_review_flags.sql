BEGIN;

-- Finaliza o domínio "Revisar cards" sem tocar no conteúdo/progresso do card.
-- A migration anterior cria a tabela. Esta rodada endurece permissões, amplia o
-- mesmo contrato de leitura já usado pelo estudo e adiciona edição de metadata.

ALTER TABLE public.user_flashcard_review_flags
  DROP CONSTRAINT IF EXISTS user_flashcard_review_flags_reason_check;

ALTER TABLE public.user_flashcard_review_flags
  ADD CONSTRAINT user_flashcard_review_flags_reason_check
  CHECK (
    reason IS NULL OR reason IN (
      'translation',
      'context',
      'grammar',
      'typo',
      'naturalness',
      'answer',
      'audio',
      'other'
    )
  );

-- Escrita é somente pelos RPCs abaixo. O cliente pode consultar a própria fila,
-- mas não ganha DELETE físico nem UPDATE arbitrário da tabela.
REVOKE ALL ON TABLE public.user_flashcard_review_flags FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_flashcard_review_flags FROM authenticated;
GRANT SELECT ON TABLE public.user_flashcard_review_flags TO authenticated;

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
  v_card public.flashcards%ROWTYPE;
  v_list public.lists%ROWTYPE;
  v_folder public.folders%ROWTYPE;
  v_flag_id uuid;
  v_group_uid uuid;
  v_reason text := NULLIF(BTRIM(COALESCE(_reason, '')), '');
  v_note text := NULLIF(BTRIM(COALESCE(_note, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'E_UNAUTHENTICATED|Sessão ausente ou expirada.' USING ERRCODE = '42501';
  END IF;

  IF v_reason IS NOT NULL AND v_reason NOT IN (
    'translation', 'context', 'grammar', 'typo', 'naturalness', 'answer', 'audio', 'other'
  ) THEN
    RAISE EXCEPTION 'E_INVALID_REASON|Motivo de revisão inválido.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_card
  FROM public.flashcards
  WHERE id = _flashcard_id
    AND deleted_at IS NULL;

  IF v_card.id IS NULL THEN
    RAISE EXCEPTION 'E_NOT_FOUND|Flashcard inexistente ou removido.' USING ERRCODE = '42501';
  END IF;

  IF v_card.list_id IS NOT NULL THEN
    SELECT * INTO v_list
    FROM public.lists
    WHERE id = v_card.list_id
      AND deleted_at IS NULL;

    IF v_list.id IS NOT NULL AND v_list.folder_id IS NOT NULL THEN
      SELECT * INTO v_folder
      FROM public.folders
      WHERE id = v_list.folder_id
        AND deleted_at IS NULL;
    END IF;
  END IF;

  -- Mesma fronteira de leitura adotada pelas superfícies privadas/públicas:
  -- dono do card/lista/pasta, recurso público ou membro/dono da turma.
  IF v_card.list_id IS NULL THEN
    IF v_card.user_id IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'E_FORBIDDEN|Você não possui acesso a este card.' USING ERRCODE = '42501';
    END IF;
  ELSIF v_list.id IS NULL OR NOT (
    v_card.user_id = v_uid
    OR v_list.owner_id = v_uid
    OR v_folder.owner_id = v_uid
    OR v_list.visibility = 'public'
    OR v_folder.visibility = 'public'
    OR (
      v_list.class_id IS NOT NULL
      AND (public.is_turma_owner(v_list.class_id, v_uid) OR public.is_turma_member(v_list.class_id, v_uid))
    )
    OR (
      v_folder.class_id IS NOT NULL
      AND (public.is_turma_owner(v_folder.class_id, v_uid) OR public.is_turma_member(v_folder.class_id, v_uid))
    )
  ) THEN
    RAISE EXCEPTION 'E_FORBIDDEN|Você não possui acesso a este card.' USING ERRCODE = '42501';
  END IF;

  v_group_uid := COALESCE(v_card.status_group_uid, v_card.parent_card_id, v_card.id);

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_uid::text || ':review-flag:' || _flashcard_id::text, 0)
  );

  IF _enabled IS DISTINCT FROM true THEN
    UPDATE public.user_flashcard_review_flags
       SET is_active = false,
           resolved_at = now(),
           updated_at = now()
     WHERE user_id = v_uid
       AND flashcard_id = _flashcard_id
       AND is_active = true
     RETURNING id INTO v_flag_id;

    RETURN jsonb_build_object(
      'enabled', false,
      'flag_id', v_flag_id,
      'flashcard_id', _flashcard_id
    );
  END IF;

  SELECT id INTO v_flag_id
  FROM public.user_flashcard_review_flags
  WHERE user_id = v_uid
    AND flashcard_id = _flashcard_id
    AND is_active = true
  LIMIT 1
  FOR UPDATE;

  IF v_flag_id IS NULL THEN
    INSERT INTO public.user_flashcard_review_flags (
      user_id,
      flashcard_id,
      source_group_uid,
      source_list_id,
      institution_id,
      reason,
      note,
      is_active,
      created_at,
      updated_at,
      resolved_at
    ) VALUES (
      v_uid,
      _flashcard_id,
      v_group_uid,
      v_card.list_id,
      COALESCE(_institution_id, v_list.institution_id),
      v_reason,
      v_note,
      true,
      now(),
      now(),
      NULL
    )
    RETURNING id INTO v_flag_id;
  ELSE
    UPDATE public.user_flashcard_review_flags
       SET source_group_uid = v_group_uid,
           source_list_id = v_card.list_id,
           institution_id = COALESCE(_institution_id, v_list.institution_id, institution_id),
           reason = COALESCE(v_reason, reason),
           note = COALESCE(v_note, note),
           updated_at = now(),
           resolved_at = NULL
     WHERE id = v_flag_id;
  END IF;

  RETURN jsonb_build_object(
    'enabled', true,
    'flag_id', v_flag_id,
    'flashcard_id', _flashcard_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_flashcard_review_flag_metadata(
  _flag_id uuid,
  _reason text DEFAULT NULL,
  _note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_reason text := NULLIF(BTRIM(COALESCE(_reason, '')), '');
  v_note text := NULLIF(BTRIM(COALESCE(_note, '')), '');
  v_flag public.user_flashcard_review_flags%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'E_UNAUTHENTICATED|Sessão ausente ou expirada.' USING ERRCODE = '42501';
  END IF;

  IF v_reason IS NOT NULL AND v_reason NOT IN (
    'translation', 'context', 'grammar', 'typo', 'naturalness', 'answer', 'audio', 'other'
  ) THEN
    RAISE EXCEPTION 'E_INVALID_REASON|Motivo de revisão inválido.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.user_flashcard_review_flags
     SET reason = v_reason,
         note = v_note,
         updated_at = now()
   WHERE id = _flag_id
     AND user_id = v_uid
     AND is_active = true
  RETURNING * INTO v_flag;

  IF v_flag.id IS NULL THEN
    RAISE EXCEPTION 'E_NOT_FOUND|Revisão aberta não encontrada.' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'flag_id', v_flag.id,
    'flashcard_id', v_flag.flashcard_id,
    'reason', v_flag.reason,
    'note', v_flag.note,
    'updated_at', v_flag.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_flashcard_review_flag(uuid, boolean, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_flashcard_review_flag(uuid, boolean, uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.update_user_flashcard_review_flag_metadata(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_user_flashcard_review_flag_metadata(uuid, text, text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
