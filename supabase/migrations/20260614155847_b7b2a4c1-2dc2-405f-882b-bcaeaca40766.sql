
-- 1. Harden update_own_profile: ignore is_teacher / user_type escalation attempts
CREATE OR REPLACE FUNCTION public.update_own_profile(
  p_user_id uuid,
  p_first_name text DEFAULT NULL::text,
  p_public_slug text DEFAULT NULL::text,
  p_public_access_enabled boolean DEFAULT NULL::boolean,
  p_avatar_url text DEFAULT NULL::text,
  p_avatar_skin_id text DEFAULT NULL::text,
  p_mascot_skin_id text DEFAULT NULL::text,
  p_google_connected_at text DEFAULT NULL::text,
  p_google_connect_prompt_dont_show boolean DEFAULT NULL::boolean,
  p_google_connect_prompt_version_seen integer DEFAULT NULL::integer,
  p_last_active_at text DEFAULT NULL::text,
  p_user_type text DEFAULT NULL::text,
  p_is_teacher boolean DEFAULT NULL::boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_is_teacher boolean;
  v_current_user_type  text;
  v_safe_is_teacher    boolean;
  v_safe_user_type     text;
BEGIN
  IF p_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT is_teacher, user_type::text
    INTO v_current_is_teacher, v_current_user_type
  FROM public.profiles
  WHERE id = p_user_id;

  -- Privilege escalation guard:
  -- A caller can only change is_teacher / user_type if they are ALREADY a teacher.
  -- Otherwise these parameters are silently ignored (kept at current value).
  IF COALESCE(v_current_is_teacher, false) = true THEN
    v_safe_is_teacher := COALESCE(p_is_teacher, v_current_is_teacher);
    v_safe_user_type  := COALESCE(p_user_type, v_current_user_type);
  ELSE
    v_safe_is_teacher := v_current_is_teacher;
    v_safe_user_type  := v_current_user_type;
  END IF;

  UPDATE public.profiles
  SET
    first_name = COALESCE(p_first_name, first_name),
    public_slug = COALESCE(p_public_slug, public_slug),
    public_access_enabled = COALESCE(p_public_access_enabled, public_access_enabled),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    avatar_skin_id = COALESCE(p_avatar_skin_id, avatar_skin_id),
    mascot_skin_id = COALESCE(p_mascot_skin_id, mascot_skin_id),
    google_connected_at = CASE
      WHEN p_google_connected_at = '__NULL__' THEN NULL
      WHEN p_google_connected_at IS NOT NULL THEN p_google_connected_at::timestamptz
      ELSE google_connected_at
    END,
    google_connect_prompt_dont_show = COALESCE(p_google_connect_prompt_dont_show, google_connect_prompt_dont_show),
    google_connect_prompt_version_seen = COALESCE(p_google_connect_prompt_version_seen, google_connect_prompt_version_seen),
    last_active_at = CASE WHEN p_last_active_at IS NOT NULL THEN p_last_active_at::timestamptz ELSE last_active_at END,
    user_type = CASE WHEN v_safe_user_type IS NOT NULL THEN v_safe_user_type::user_type ELSE user_type END,
    is_teacher = v_safe_is_teacher,
    updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- 2. Document/lock down internal backfill report table with explicit admin-only policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'clara_backfill_phase4_report') THEN
    EXECUTE 'ALTER TABLE public.clara_backfill_phase4_report ENABLE ROW LEVEL SECURITY';

    -- Drop any prior policy of the same name to make migration idempotent
    EXECUTE 'DROP POLICY IF EXISTS "Developer admins can read backfill report" ON public.clara_backfill_phase4_report';
    EXECUTE 'DROP POLICY IF EXISTS "Service role only" ON public.clara_backfill_phase4_report';

    EXECUTE $p$
      CREATE POLICY "Developer admins can read backfill report"
      ON public.clara_backfill_phase4_report
      FOR SELECT
      TO authenticated
      USING (public.is_developer_admin(auth.uid()))
    $p$;

    -- Ensure no anon/authenticated write privileges; service_role keeps full access
    EXECUTE 'REVOKE ALL ON public.clara_backfill_phase4_report FROM anon, authenticated';
    EXECUTE 'GRANT SELECT ON public.clara_backfill_phase4_report TO authenticated';
    EXECUTE 'GRANT ALL ON public.clara_backfill_phase4_report TO service_role';
  END IF;
END $$;
