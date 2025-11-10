-- Drop the security definer view
DROP VIEW IF EXISTS public.public_profiles CASCADE;

-- Create function to get public profile by ID (no SECURITY DEFINER view needed)
CREATE OR REPLACE FUNCTION public.get_public_profile(p_public_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_avatar_url text;
  v_card_url text;
  v_skin_name text;
  v_skin_rarity text;
BEGIN
  -- Get profile data with avatar and mascot info
  SELECT jsonb_build_object(
    'public_id', p.user_tag,
    'user_type', p.user_type::text,
    'name', p.first_name,
    'level', p.level,
    'stats', jsonb_build_object(
      'ptc', p.balance_pitecoin,
      'points', p.pts_weekly,
      'xp_total', p.xp_total,
      'lists_created', COALESCE((SELECT COUNT(*)::int FROM public.folders WHERE owner_id = p.id), 0),
      'cards_studied', COALESCE((SELECT COUNT(*)::int FROM public.flashcards WHERE user_id = p.id), 0)
    ),
    'avatar', CASE 
      WHEN p.avatar_skin_id IS NOT NULL THEN (
        SELECT jsonb_build_object(
          'url', c.avatar_final,
          'name', c.name,
          'rarity', c.rarity
        )
        FROM public.public_catalog c
        WHERE c.id = p.avatar_skin_id
      )
      ELSE NULL
    END,
    'mascot', CASE 
      WHEN p.mascot_skin_id IS NOT NULL THEN (
        SELECT jsonb_build_object(
          'url', c.card_final,
          'name', c.name,
          'rarity', c.rarity
        )
        FROM public.public_catalog c
        WHERE c.id = p.mascot_skin_id
      )
      ELSE NULL
    END
  )
  INTO v_result
  FROM public.profiles p
  WHERE p.user_tag = p_public_id;
  
  IF v_result IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_FOUND',
      'message', 'Usuário não encontrado.'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'profile', v_result
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'INTERNAL_ERROR',
    'message', 'Erro ao carregar perfil.'
  );
END;
$$;

-- Create function to search users
CREATE OR REPLACE FUNCTION public.search_users(
  p_query text,
  p_user_type text DEFAULT 'todos',
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_results jsonb;
  v_total int;
BEGIN
  -- Validate inputs
  IF LENGTH(TRIM(p_query)) < 2 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_INPUT',
      'message', 'Digite pelo menos 2 caracteres para buscar.'
    );
  END IF;
  
  -- Build query based on user_type filter
  WITH filtered_users AS (
    SELECT 
      p.user_tag as public_id,
      p.user_type::text as user_type,
      p.first_name as name,
      c.avatar_final as avatar_url
    FROM public.profiles p
    LEFT JOIN public.public_catalog c ON c.id = p.avatar_skin_id
    WHERE 
      (p.first_name ILIKE '%' || p_query || '%' OR p.user_tag ILIKE '%' || p_query || '%')
      AND (
        p_user_type = 'todos' 
        OR p.user_type::text = p_user_type
      )
    ORDER BY 
      CASE 
        WHEN p.user_tag = p_query THEN 0
        WHEN p.user_tag ILIKE p_query || '%' THEN 1
        WHEN p.first_name ILIKE p_query || '%' THEN 2
        ELSE 3
      END,
      p.first_name
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'public_id', fu.public_id,
      'user_type', fu.user_type,
      'name', fu.name,
      'avatar_url', fu.avatar_url
    )
  )
  INTO v_results
  FROM filtered_users fu;
  
  -- Get total count for pagination
  SELECT COUNT(*)::int
  INTO v_total
  FROM public.profiles p
  WHERE 
    (p.first_name ILIKE '%' || p_query || '%' OR p.user_tag ILIKE '%' || p_query || '%')
    AND (
      p_user_type = 'todos' 
      OR p.user_type::text = p_user_type
    );
  
  RETURN jsonb_build_object(
    'success', true,
    'users', COALESCE(v_results, '[]'::jsonb),
    'total', v_total,
    'has_more', (p_offset + p_limit) < v_total
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'INTERNAL_ERROR',
    'message', 'Erro ao buscar usuários.'
  );
END;
$$;