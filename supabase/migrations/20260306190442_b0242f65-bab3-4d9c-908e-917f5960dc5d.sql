DROP POLICY IF EXISTS "Anyone can view active catalog items" ON public.public_catalog;

CREATE POLICY "Anyone can view active approved catalog items"
ON public.public_catalog
FOR SELECT
USING (is_active = true AND approved = true);