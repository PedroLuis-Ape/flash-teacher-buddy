-- 1) Permitir inserção de logs de compra pelo usuário (necessário para a função process_skin_purchase)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'purchase_logs' AND policyname = 'Users can create their own purchase logs'
  ) THEN
    CREATE POLICY "Users can create their own purchase logs"
    ON public.purchase_logs
    FOR INSERT
    WITH CHECK (auth.uid() = buyer_id);
  END IF;
END$$;

-- 2) Ajustar catálogo público conforme pedido
-- PRIME grátis e ativo
UPDATE public.public_catalog
SET price_pitecoin = 0, is_active = true, approved = true
WHERE slug = 'piteco_prime';

-- VAMPIRO épico pago (50) e ativo
UPDATE public.public_catalog
SET price_pitecoin = 50, is_active = true, approved = true
WHERE slug = 'piteco_vampiro';

-- Desativar demais itens (cientista, astronauta, dourado e variantes)
UPDATE public.public_catalog
SET is_active = false
WHERE slug IN ('piteco_cientista','piteco_astronaut','piteco_dourado','piteco_scientist','piteco_gold');