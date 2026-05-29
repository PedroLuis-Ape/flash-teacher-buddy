-- Replace view (security definer view flagged by linter) with safe RPC functions
DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE FUNCTION public.get_public_profile(_id uuid)
RETURNS TABLE (
  id uuid,
  first_name text,
  avatar_url text,
  avatar_skin_id text,
  mascot_skin_id text,
  user_tag text,
  ape_id text,
  public_slug text,
  is_teacher boolean,
  user_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.first_name, p.avatar_url, p.avatar_skin_id, p.mascot_skin_id,
    p.user_tag, p.ape_id, p.public_slug, p.is_teacher, p.user_type
  FROM public.profiles p
  WHERE p.id = _id AND p.public_access_enabled = true;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_public_profiles(_q text)
RETURNS TABLE (
  id uuid,
  first_name text,
  avatar_url text,
  avatar_skin_id text,
  mascot_skin_id text,
  user_tag text,
  ape_id text,
  public_slug text,
  is_teacher boolean,
  user_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.first_name, p.avatar_url, p.avatar_skin_id, p.mascot_skin_id,
    p.user_tag, p.ape_id, p.public_slug, p.is_teacher, p.user_type
  FROM public.profiles p
  WHERE p.public_access_enabled = true
    AND (
      p.first_name ILIKE '%' || _q || '%'
      OR p.public_slug ILIKE '%' || _q || '%'
      OR p.ape_id ILIKE '%' || _q || '%'
    )
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.search_public_profiles(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_public_profiles(text) TO authenticated;