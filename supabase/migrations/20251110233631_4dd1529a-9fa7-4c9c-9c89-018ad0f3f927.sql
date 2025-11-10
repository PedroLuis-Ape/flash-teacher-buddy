-- Allow anyone to view any user's inventory (for public deck viewing)
DROP POLICY IF EXISTS "Users can view their own inventory" ON public.user_inventory;

CREATE POLICY "Anyone can view any inventory"
ON public.user_inventory
FOR SELECT
USING (true);

-- Keep the insert policy restricted to own inventory
-- (already exists: "Users can add to their own inventory")