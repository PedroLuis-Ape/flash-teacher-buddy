CREATE OR REPLACE FUNCTION public.is_public_slug_available_v1(p_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    length(lower(regexp_replace(COALESCE(p_slug, ''), '[^a-z0-9_]', '', 'g'))) >= 3
    AND NOT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public_slug = lower(regexp_replace(COALESCE(p_slug, ''), '[^a-z0-9_]', '', 'g'))
    );
$$;

REVOKE ALL ON FUNCTION public.is_public_slug_available_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_slug_available_v1(text) TO anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_roles FROM anon, authenticated;
