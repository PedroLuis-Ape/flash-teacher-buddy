-- ============================================================================
-- Endurecimento de autorizacao — parte 3 — 2026-09-13
--
-- 1) get_exchange_quote: leitura de uso diario de terceiros.
-- 2) swap_flashcards_sides: funcao que so existia no banco (drift, sem
--    migration). Alem de versionar o comportamento, fecha o mesmo bypass de
--    auth.uid() nulo que existia em swap_list_sides: com JWT anonimo a
--    comparacao vira NULL e o bloqueio nao dispara.
-- ============================================================================

ALTER FUNCTION public.get_exchange_quote(uuid, integer) RENAME TO get_exchange_quote_unsafe_v1;
ALTER FUNCTION public.swap_flashcards_sides(uuid) RENAME TO swap_flashcards_sides_unsafe_v1;

REVOKE ALL ON FUNCTION public.get_exchange_quote_unsafe_v1(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.swap_flashcards_sides_unsafe_v1(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_exchange_quote(p_user_id uuid, p_pts integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.security_actor_matches_v1(p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;
  RETURN public.get_exchange_quote_unsafe_v1(p_user_id, p_pts);
END;
$$;

CREATE OR REPLACE FUNCTION public.swap_flashcards_sides(_list_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PERMISSION_DENIED',
      'message', 'Você precisa estar autenticado para inverter esta lista.'
    );
  END IF;
  RETURN public.swap_flashcards_sides_unsafe_v1(_list_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_exchange_quote(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.swap_flashcards_sides(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_exchange_quote(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.swap_flashcards_sides(uuid) TO authenticated, service_role;

