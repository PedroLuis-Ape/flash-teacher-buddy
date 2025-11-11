-- Remover os triggers que dependem da função
DROP TRIGGER IF EXISTS sync_skin_insert ON public.skins_catalog;
DROP TRIGGER IF EXISTS sync_skin_update ON public.skins_catalog;

-- Remover a função de sincronização automática
DROP FUNCTION IF EXISTS public.sync_skin_to_public_catalog() CASCADE;

-- Criar função para publicar skin manualmente na loja
CREATE OR REPLACE FUNCTION public.publish_skin_to_store(p_skin_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_skin skins_catalog%ROWTYPE;
BEGIN
  -- Verificar se usuário é developer_admin
  IF NOT is_developer_admin(auth.uid()) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED',
      'message', 'Apenas administradores podem publicar na loja.'
    );
  END IF;

  -- Buscar skin
  SELECT * INTO v_skin
  FROM public.skins_catalog
  WHERE id = p_skin_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_FOUND',
      'message', 'Skin não encontrada.'
    );
  END IF;

  -- Verificar se está published
  IF v_skin.status != 'published' OR v_skin.is_active = false THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_PUBLISHED',
      'message', 'Skin precisa estar publicada e ativa.'
    );
  END IF;

  -- Inserir/atualizar no catálogo público
  INSERT INTO public.public_catalog (
    id,
    name,
    rarity,
    price_pitecoin,
    description,
    avatar_final,
    card_final,
    is_active,
    approved,
    created_by,
    slug
  ) VALUES (
    v_skin.id,
    v_skin.name,
    v_skin.rarity,
    v_skin.price_pitecoin,
    v_skin.description,
    v_skin.avatar_img,
    v_skin.card_img,
    v_skin.is_active,
    true,
    'developer_admin',
    v_skin.id
  )
  ON CONFLICT (id) 
  DO UPDATE SET
    name = EXCLUDED.name,
    rarity = EXCLUDED.rarity,
    price_pitecoin = EXCLUDED.price_pitecoin,
    description = EXCLUDED.description,
    avatar_final = EXCLUDED.avatar_final,
    card_final = EXCLUDED.card_final,
    is_active = EXCLUDED.is_active,
    approved = EXCLUDED.approved,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Skin publicada na loja com sucesso!'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'INTERNAL_ERROR',
    'message', 'Erro ao publicar na loja.'
  );
END;
$$;