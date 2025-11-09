-- Remove old FK constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public'
      AND table_name = 'user_inventory'
      AND constraint_name = 'user_inventory_skin_id_fkey'
  ) THEN
    ALTER TABLE public.user_inventory DROP CONSTRAINT user_inventory_skin_id_fkey;
  END IF;
END$$;

-- Create FK pointing to public_catalog.id (the actual unique ID)
ALTER TABLE public.user_inventory
  ADD CONSTRAINT user_inventory_skin_id_fkey
  FOREIGN KEY (skin_id)
  REFERENCES public.public_catalog(id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

-- Ensure the two store items are active, approved, and have correct pricing
UPDATE public.public_catalog
SET price_pitecoin = 0, is_active = true, approved = true
WHERE slug = 'piteco_prime';

UPDATE public.public_catalog
SET price_pitecoin = 50, is_active = true, approved = true
WHERE slug = 'piteco_vampiro';