-- ============================================================================
-- Endurecimento de autorizacao — parte 2 — 2026-09-12
--
-- Fecha as leituras que ainda aceitavam identidade do cliente, o oraculo de
-- papeis e a listagem publica do bucket de skins.
-- ============================================================================

-- 1) get_user_card_counts: contagens de listas de terceiros -----------------
ALTER FUNCTION public.get_user_card_counts(uuid, uuid) RENAME TO get_user_card_counts_unsafe_v1;
REVOKE ALL ON FUNCTION public.get_user_card_counts_unsafe_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_user_card_counts(_user_id uuid, _institution_id uuid DEFAULT NULL)
RETURNS TABLE(list_id uuid, card_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.security_actor_matches_v1(_user_id) THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.get_user_card_counts_unsafe_v1(_user_id, _institution_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_card_counts(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_card_counts(uuid, uuid) TO authenticated, service_role;

-- 2) get_subscribed_teachers_with_stats: grafo social de terceiros ----------
ALTER FUNCTION public.get_subscribed_teachers_with_stats(uuid) RENAME TO get_subscribed_teachers_with_stats_unsafe_v1;
REVOKE ALL ON FUNCTION public.get_subscribed_teachers_with_stats_unsafe_v1(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_subscribed_teachers_with_stats(_student_id uuid)
RETURNS TABLE(teacher_id uuid, first_name text, avatar_url text, folder_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.security_actor_matches_v1(_student_id) THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.get_subscribed_teachers_with_stats_unsafe_v1(_student_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_subscribed_teachers_with_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_subscribed_teachers_with_stats(uuid) TO authenticated, service_role;

-- 3) has_role: deixa de ser oraculo de papeis --------------------------------
-- Continua utilizavel por policies (que chamam has_role(auth.uid(), ...)) e por
-- rotinas internas com service_role; deixa de responder sobre terceiros.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL THEN
      _user_id IS NOT NULL AND _user_id = auth.uid() AND EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
      )
    WHEN auth.role() = 'service_role' THEN EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
    )
    ELSE false
  END
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 4) search_users: diretorio de usuarios nao fica exposto a anon ------------
REVOKE ALL ON FUNCTION public.search_users(text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_users(text, text, int, int) TO authenticated, service_role;

-- 5) storage: bucket de skins nao permite mais listagem publica -------------
-- As URLs publicas continuam funcionando; apenas a listagem de objetos sai.
DROP POLICY IF EXISTS "Public can view skins" ON storage.objects;

