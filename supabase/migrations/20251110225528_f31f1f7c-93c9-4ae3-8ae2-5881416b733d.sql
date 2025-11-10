-- Fix search_path for get_rarity_fallback_price function
CREATE OR REPLACE FUNCTION public.get_rarity_fallback_price(p_rarity text)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN CASE p_rarity
    WHEN 'normal' THEN 200
    WHEN 'rare' THEN 450
    WHEN 'epic' THEN 900
    WHEN 'legendary' THEN 1500
    ELSE 200
  END;
END;
$$;