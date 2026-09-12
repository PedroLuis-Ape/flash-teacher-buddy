-- ============================================================================
-- Superficie anonima — 2026-09-13
--
-- A memoria canonica de seguranca (docs/security/LOVABLE_SECURITY_MEMORY.md)
-- permite SECURITY DEFINER para anon apenas em endpoints publicos, somente
-- leitura e documentados. O banco real tinha 46 funcoes SECURITY DEFINER
-- alcancaveis por anon, incluindo operacoes de ESCRITA (favoritar, mesclar
-- camadas, publicar skin, criar pasta/notificacao) e leituras internas.
--
-- Este bloco revoga anon/PUBLIC dessas funcoes internas e devolve o acesso a
-- authenticated e service_role. A superficie publica documentada
-- (get_portal_*, get_public_*, list_public_*, public_*_rows, search_public_*,
-- is_*/can_* usados por policies) permanece intocada.
-- ============================================================================

DO $$
DECLARE
  r record;
  alvos text[] := ARRAY[
    'apply_special_flashcard_explanations','create_class_folder_with_assignment','create_notification',
    'merge_flashcard_into_group','unmerge_flashcard_from_group','set_flashcard_group_favorite',
    'set_flashcard_group_red_list','publish_skin_to_store','reorder_public_turmas',
    'get_account_glossary_for_list_v1','get_turma_engagement_report_v1',
    'record_turma_engagement_v1','check_message_rate_limit'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(alvos)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

