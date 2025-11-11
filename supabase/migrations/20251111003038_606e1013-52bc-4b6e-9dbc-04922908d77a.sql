-- Função para sincronizar skins_catalog -> public_catalog
CREATE OR REPLACE FUNCTION sync_skin_to_public_catalog()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se a skin está publicada, adiciona/atualiza no catálogo público
  IF NEW.status = 'published' AND NEW.is_active = true THEN
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
      slug,
      type
    ) VALUES (
      NEW.id,
      NEW.name,
      NEW.rarity,
      NEW.price_pitecoin,
      NEW.description,
      NEW.avatar_img,
      NEW.card_img,
      NEW.is_active,
      true, -- auto-approve admin skins
      'developer_admin',
      NEW.id, -- usar id como slug
      'skin'
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
      updated_at = now();
  
  -- Se a skin foi despublicada, desativa no catálogo público
  ELSIF (NEW.status != 'published' OR NEW.is_active = false) THEN
    UPDATE public.public_catalog
    SET is_active = false, updated_at = now()
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para sincronizar ao inserir
CREATE TRIGGER sync_skin_insert
AFTER INSERT ON public.skins_catalog
FOR EACH ROW
EXECUTE FUNCTION sync_skin_to_public_catalog();

-- Trigger para sincronizar ao atualizar
CREATE TRIGGER sync_skin_update
AFTER UPDATE ON public.skins_catalog
FOR EACH ROW
EXECUTE FUNCTION sync_skin_to_public_catalog();