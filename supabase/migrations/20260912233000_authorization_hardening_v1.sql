-- ============================================================================
-- Endurecimento de autorizacao — App Piteco — 2026-09-12
--
-- Causa-raiz corrigida: varias RPCs SECURITY DEFINER recebiam a identidade do
-- ator (p_user_id / p_buyer_id) e o preco pela requisicao do cliente. Como
-- SECURITY DEFINER ignora RLS, nao havia nenhuma barreira server-side: um
-- chamador podia operar sobre a conta de terceiros ou comprar item pago
-- pagando o valor que quisesse.
--
-- Padrao aplicado (sem reescrever corpos, para nao introduzir regressao):
--   1. a funcao original e renomeada para *_unsafe_v1 (historico preservado);
--   2. um wrapper com a MESMA assinatura valida a identidade no servidor;
--   3. o wrapper delega para a versao original;
--   4. EXECUTE e revogado de PUBLIC/anon e concedido de volta apenas a
--      authenticated (e service_role, para rotinas internas).
--
-- Nenhum usuario autenticado que envia o proprio id percebe mudanca.
-- ============================================================================

-- Helper interno: compara a identidade alegada com a identidade do JWT.
-- Nao e exposto na API (REVOKE de todos os papeis de API).
CREATE OR REPLACE FUNCTION public.security_actor_matches_v1(p_claimed uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL THEN p_claimed IS NOT NULL AND p_claimed = auth.uid()
    WHEN auth.role() = 'service_role' THEN true
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.security_actor_matches_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.security_actor_matches_v1(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 1. Lixeira: pasta, lista e flashcard (soft delete / restore)
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.soft_delete_folder(uuid, uuid) RENAME TO soft_delete_folder_unsafe_v1;
ALTER FUNCTION public.soft_delete_list(uuid, uuid) RENAME TO soft_delete_list_unsafe_v1;
ALTER FUNCTION public.restore_folder(uuid, uuid) RENAME TO restore_folder_unsafe_v1;
ALTER FUNCTION public.restore_list(uuid, uuid) RENAME TO restore_list_unsafe_v1;
ALTER FUNCTION public.restore_flashcard(uuid, uuid) RENAME TO restore_flashcard_unsafe_v1;
ALTER FUNCTION public.bulk_soft_delete_lists(uuid[], uuid) RENAME TO bulk_soft_delete_lists_unsafe_v1;
ALTER FUNCTION public.bulk_soft_delete_folders(uuid[], uuid) RENAME TO bulk_soft_delete_folders_unsafe_v1;

REVOKE ALL ON FUNCTION public.soft_delete_folder_unsafe_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.soft_delete_list_unsafe_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_folder_unsafe_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_list_unsafe_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_flashcard_unsafe_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bulk_soft_delete_lists_unsafe_v1(uuid[], uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bulk_soft_delete_folders_unsafe_v1(uuid[], uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.soft_delete_folder(p_folder_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.security_actor_matches_v1(p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;
  RETURN public.soft_delete_folder_unsafe_v1(p_folder_id, p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_list(p_list_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.security_actor_matches_v1(p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;
  RETURN public.soft_delete_list_unsafe_v1(p_list_id, p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_folder(p_folder_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.security_actor_matches_v1(p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;
  RETURN public.restore_folder_unsafe_v1(p_folder_id, p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_list(p_list_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.security_actor_matches_v1(p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;
  RETURN public.restore_list_unsafe_v1(p_list_id, p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_flashcard(p_flashcard_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.security_actor_matches_v1(p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;
  RETURN public.restore_flashcard_unsafe_v1(p_flashcard_id, p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_soft_delete_lists(p_list_ids uuid[], p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.security_actor_matches_v1(p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;
  RETURN public.bulk_soft_delete_lists_unsafe_v1(p_list_ids, p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_soft_delete_folders(p_folder_ids uuid[], p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.security_actor_matches_v1(p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;
  RETURN public.bulk_soft_delete_folders_unsafe_v1(p_folder_ids, p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_folder(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.soft_delete_list(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_folder(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_list(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_flashcard(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bulk_soft_delete_lists(uuid[], uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bulk_soft_delete_folders(uuid[], uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.soft_delete_folder(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.soft_delete_list(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_folder(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_list(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_flashcard(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bulk_soft_delete_lists(uuid[], uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bulk_soft_delete_folders(uuid[], uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Economia: presente, equipar skin e troca de PTS
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.claim_gift_atomic(uuid, uuid) RENAME TO claim_gift_atomic_unsafe_v1;
ALTER FUNCTION public.equip_skin_atomic(uuid, uuid, text, text) RENAME TO equip_skin_atomic_unsafe_v1;
ALTER FUNCTION public.process_exchange(uuid, uuid, integer) RENAME TO process_exchange_unsafe_v1;

REVOKE ALL ON FUNCTION public.claim_gift_atomic_unsafe_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.equip_skin_atomic_unsafe_v1(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_exchange_unsafe_v1(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_gift_atomic(p_gift_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.security_actor_matches_v1(p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;
  RETURN public.claim_gift_atomic_unsafe_v1(p_gift_id, p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.equip_skin_atomic(p_operation_id uuid, p_user_id uuid, p_kind text, p_skin_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.security_actor_matches_v1(p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;
  RETURN public.equip_skin_atomic_unsafe_v1(p_operation_id, p_user_id, p_kind, p_skin_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_exchange(p_operation_id uuid, p_user_id uuid, p_pts integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.security_actor_matches_v1(p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;
  RETURN public.process_exchange_unsafe_v1(p_operation_id, p_user_id, p_pts);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_gift_atomic(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.equip_skin_atomic(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_exchange(uuid, uuid, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.claim_gift_atomic(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.equip_skin_atomic(uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_exchange(uuid, uuid, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Loja: compra usa identidade do JWT e preco do catalogo
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.process_skin_purchase(uuid, uuid, text, integer) RENAME TO process_skin_purchase_unsafe_v1;
REVOKE ALL ON FUNCTION public.process_skin_purchase_unsafe_v1(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.process_skin_purchase(p_operation_id uuid, p_buyer_id uuid, p_skin_id text, p_price integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_catalog_price integer;
BEGIN
  IF NOT public.security_actor_matches_v1(p_buyer_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT price_pitecoin INTO v_catalog_price
  FROM public.skins_catalog
  WHERE id = p_skin_id;

  -- Nem todo item da loja existe em skins_catalog: o restante vem do catalogo
  -- publicado, que e a fonte que o cliente usa para exibir o preco.
  IF v_catalog_price IS NULL THEN
    SELECT price_pitecoin INTO v_catalog_price
    FROM public.public_catalog
    WHERE id = p_skin_id OR sku = p_skin_id;
  END IF;

  IF v_catalog_price IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SKIN_NOT_FOUND');
  END IF;

  IF p_price IS DISTINCT FROM v_catalog_price THEN
    RETURN jsonb_build_object('success', false, 'error', 'PRICE_MISMATCH', 'expected', v_catalog_price);
  END IF;

  RETURN public.process_skin_purchase_unsafe_v1(p_operation_id, p_buyer_id, p_skin_id, v_catalog_price);
END;
$$;

REVOKE ALL ON FUNCTION public.process_skin_purchase(uuid, uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_skin_purchase(uuid, uuid, text, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Perfil e listas: guardas NULL-safe (auth.uid() nulo furava o IF original)
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.update_own_profile(uuid, text, text, boolean, text, text, text, text, boolean, integer, text, text, boolean) RENAME TO update_own_profile_unsafe_v1;
ALTER FUNCTION public.swap_list_sides(uuid) RENAME TO swap_list_sides_unsafe_v1;

REVOKE ALL ON FUNCTION public.update_own_profile_unsafe_v1(uuid, text, text, boolean, text, text, text, text, boolean, integer, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.swap_list_sides_unsafe_v1(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_own_profile(
  p_user_id uuid,
  p_first_name text DEFAULT NULL::text,
  p_public_slug text DEFAULT NULL::text,
  p_public_access_enabled boolean DEFAULT NULL::boolean,
  p_avatar_url text DEFAULT NULL::text,
  p_avatar_skin_id text DEFAULT NULL::text,
  p_mascot_skin_id text DEFAULT NULL::text,
  p_google_connected_at text DEFAULT NULL::text,
  p_google_connect_prompt_dont_show boolean DEFAULT NULL::boolean,
  p_google_connect_prompt_version_seen integer DEFAULT NULL::integer,
  p_last_active_at text DEFAULT NULL::text,
  p_user_type text DEFAULT NULL::text,
  p_is_teacher boolean DEFAULT NULL::boolean
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;
  IF NOT public.security_actor_matches_v1(p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;
  RETURN public.update_own_profile_unsafe_v1(
    p_user_id, p_first_name, p_public_slug, p_public_access_enabled, p_avatar_url,
    p_avatar_skin_id, p_mascot_skin_id, p_google_connected_at,
    p_google_connect_prompt_dont_show, p_google_connect_prompt_version_seen,
    p_last_active_at, p_user_type, p_is_teacher
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.swap_list_sides(_list_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PERMISSION_DENIED',
      'message', 'Você precisa estar autenticado para inverter esta lista.'
    );
  END IF;
  RETURN public.swap_list_sides_unsafe_v1(_list_id);
END;
$$;

REVOKE ALL ON FUNCTION public.update_own_profile(uuid, text, text, boolean, text, text, text, text, boolean, integer, text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.swap_list_sides(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.update_own_profile(uuid, text, text, boolean, text, text, text, text, boolean, integer, text, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.swap_list_sides(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Rotinas internas que nao devem estar na API
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.purge_expired_trash() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_trash() TO service_role;
