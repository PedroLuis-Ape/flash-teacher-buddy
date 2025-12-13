-- RPC function to get lists with card counts in a single query (eliminates N+1)
CREATE OR REPLACE FUNCTION public.get_lists_with_card_counts(_folder_id uuid)
RETURNS TABLE (
  id uuid,
  folder_id uuid,
  owner_id uuid,
  title text,
  description text,
  order_index integer,
  visibility text,
  lang text,
  class_id uuid,
  institution_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  card_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    l.id,
    l.folder_id,
    l.owner_id,
    l.title,
    l.description,
    l.order_index,
    l.visibility,
    l.lang,
    l.class_id,
    l.institution_id,
    l.created_at,
    l.updated_at,
    COUNT(f.id)::bigint AS card_count
  FROM public.lists l
  LEFT JOIN public.flashcards f ON f.list_id = l.id
  WHERE l.folder_id = _folder_id
  GROUP BY l.id
  ORDER BY l.order_index ASC, l.created_at ASC;
$$;

-- RPC for portal lists with card counts (for unauthenticated access)
CREATE OR REPLACE FUNCTION public.get_portal_lists_with_counts(_folder_id uuid)
RETURNS TABLE (
  id uuid,
  folder_id uuid,
  owner_id uuid,
  title text,
  description text,
  order_index integer,
  visibility text,
  lang text,
  class_id uuid,
  institution_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  card_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    l.id,
    l.folder_id,
    l.owner_id,
    l.title,
    l.description,
    l.order_index,
    l.visibility,
    l.lang,
    l.class_id,
    l.institution_id,
    l.created_at,
    l.updated_at,
    COUNT(fc.id)::bigint AS card_count
  FROM public.lists l
  JOIN public.folders fld ON fld.id = l.folder_id
  JOIN public.profiles p ON p.id = fld.owner_id
  LEFT JOIN public.flashcards fc ON fc.list_id = l.id
  WHERE l.folder_id = _folder_id
    AND fld.visibility = 'class'
    AND COALESCE(p.public_access_enabled, false) = true
  GROUP BY l.id
  ORDER BY l.order_index ASC, l.created_at ASC;
$$;

-- RPC for teachers with folder stats (eliminates N+1 in useHomeData)
CREATE OR REPLACE FUNCTION public.get_subscribed_teachers_with_stats(_student_id uuid)
RETURNS TABLE (
  teacher_id uuid,
  first_name text,
  avatar_url text,
  folder_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    s.teacher_id,
    p.first_name,
    p.avatar_url,
    COUNT(DISTINCT f.id)::bigint AS folder_count
  FROM public.subscriptions s
  JOIN public.profiles p ON p.id = s.teacher_id
  LEFT JOIN public.folders f ON f.owner_id = s.teacher_id AND f.visibility = 'class'
  WHERE s.student_id = _student_id
  GROUP BY s.teacher_id, p.first_name, p.avatar_url;
$$;