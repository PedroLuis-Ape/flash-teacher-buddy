
-- =============================================
-- FIX 1: Restrict profiles UPDATE policy
-- Replace broad "Users can update their own profile" with column-restricted security definer function
-- =============================================

-- Drop the overly permissive UPDATE policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create a security definer function that only allows safe column updates
CREATE OR REPLACE FUNCTION public.update_own_profile(
  p_user_id uuid,
  p_first_name text DEFAULT NULL,
  p_public_slug text DEFAULT NULL,
  p_public_access_enabled boolean DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_avatar_skin_id text DEFAULT NULL,
  p_mascot_skin_id text DEFAULT NULL,
  p_google_connected_at text DEFAULT NULL,
  p_google_connect_prompt_dont_show boolean DEFAULT NULL,
  p_google_connect_prompt_version_seen integer DEFAULT NULL,
  p_last_active_at text DEFAULT NULL,
  p_user_type text DEFAULT NULL,
  p_is_teacher boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow the user to update their own profile
  IF p_user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  UPDATE public.profiles
  SET
    first_name = COALESCE(p_first_name, first_name),
    public_slug = COALESCE(p_public_slug, public_slug),
    public_access_enabled = COALESCE(p_public_access_enabled, public_access_enabled),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    avatar_skin_id = COALESCE(p_avatar_skin_id, avatar_skin_id),
    mascot_skin_id = COALESCE(p_mascot_skin_id, mascot_skin_id),
    google_connected_at = CASE WHEN p_google_connected_at = '__NULL__' THEN NULL WHEN p_google_connected_at IS NOT NULL THEN p_google_connected_at::timestamptz ELSE google_connected_at END,
    google_connect_prompt_dont_show = COALESCE(p_google_connect_prompt_dont_show, google_connect_prompt_dont_show),
    google_connect_prompt_version_seen = COALESCE(p_google_connect_prompt_version_seen, google_connect_prompt_version_seen),
    last_active_at = CASE WHEN p_last_active_at IS NOT NULL THEN p_last_active_at::timestamptz ELSE last_active_at END,
    user_type = CASE WHEN p_user_type IS NOT NULL THEN p_user_type::user_type ELSE user_type END,
    is_teacher = COALESCE(p_is_teacher, is_teacher),
    updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Create a restrictive UPDATE policy that blocks all direct updates
-- Users must use the update_own_profile function instead
CREATE POLICY "Block direct profile updates"
ON public.profiles
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- =============================================
-- FIX 2: Restrict user_roles INSERT and UPDATE policies
-- =============================================

-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "Users can insert their own role on signup" ON public.user_roles;

-- Drop the overly permissive UPDATE policy  
DROP POLICY IF EXISTS "Users can update to owner role via function" ON public.user_roles;

-- Create restricted INSERT policy: only allow 'student' role self-assignment
CREATE POLICY "Users can only insert student role for themselves"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'student'::app_role);

-- No UPDATE policy at all - role changes must go through security definer functions
-- The assign_default_role trigger and admin functions handle role promotions
