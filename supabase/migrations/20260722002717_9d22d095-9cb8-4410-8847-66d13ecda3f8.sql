
DROP POLICY IF EXISTS "Authenticated users can read app config" ON public.app_config;
CREATE POLICY "Developer admins can read app config"
ON public.app_config
FOR SELECT
TO authenticated
USING (public.is_developer_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view activities" ON public.kingdom_activities;

CREATE OR REPLACE FUNCTION public.get_kingdom_activities(_kingdom_code text)
RETURNS TABLE (
  id uuid,
  kingdom_code text,
  level_code text,
  unit text,
  activity_type text,
  prompt text,
  hint text,
  choices jsonb,
  tags text[],
  lang text,
  points integer,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.kingdom_code, a.level_code, a.unit, a.activity_type,
         a.prompt, a.hint, a.choices, a.tags, a.lang, a.points,
         a.created_at, a.updated_at
  FROM public.kingdom_activities a
  WHERE a.kingdom_code = _kingdom_code
    AND auth.uid() IS NOT NULL
  ORDER BY a.level_code, a.unit;
$$;

REVOKE ALL ON FUNCTION public.get_kingdom_activities(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_kingdom_activities(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_kingdom_activities(text) TO authenticated;
