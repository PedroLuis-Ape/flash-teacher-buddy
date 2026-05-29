-- 1) Profiles: drop broad public-read policies that exposed all columns
DROP POLICY IF EXISTS "Authenticated can view public teacher profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public teacher profiles are discoverable" ON public.profiles;

-- Safe public view (SECURITY DEFINER bypasses base-table RLS, exposes only safe cols)
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false)
AS
SELECT
  id,
  first_name,
  avatar_url,
  avatar_skin_id,
  mascot_skin_id,
  user_tag,
  ape_id,
  public_slug,
  is_teacher,
  user_type,
  public_access_enabled
FROM public.profiles
WHERE public_access_enabled = true;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 2) Notificacoes: remove client INSERT (must go through server-side RPC/edge)
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notificacoes;
REVOKE INSERT ON public.notificacoes FROM anon, authenticated;