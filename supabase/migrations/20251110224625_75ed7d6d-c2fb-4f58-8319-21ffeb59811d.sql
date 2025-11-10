-- Add user_type to profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_type') THEN
    CREATE TYPE public.user_type AS ENUM ('professor', 'aluno');
  END IF;
END $$;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS user_type public.user_type DEFAULT 'aluno';

-- Create function to generate public ID based on user type
CREATE OR REPLACE FUNCTION public.generate_public_id(p_user_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_number text;
  v_public_id text;
  v_exists boolean;
BEGIN
  -- Set prefix based on user type
  v_prefix := CASE 
    WHEN p_user_type = 'professor' THEN 'P'
    ELSE 'A'
  END;
  
  LOOP
    -- Generate 6-digit random number
    v_number := LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0');
    v_public_id := v_prefix || v_number;
    
    -- Check if ID already exists
    SELECT EXISTS(
      SELECT 1 FROM public.profiles WHERE user_tag = v_public_id
    ) INTO v_exists;
    
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_public_id;
END;
$$;

-- Create function to initialize public ID for user
CREATE OR REPLACE FUNCTION public.init_public_id(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_tag text;
  v_user_type text;
  v_new_tag text;
BEGIN
  -- Get current user_tag and user_type
  SELECT user_tag, user_type::text INTO v_user_tag, v_user_type
  FROM public.profiles
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_FOUND',
      'message', 'Usuário não encontrado.'
    );
  END IF;
  
  -- Check if user_tag already follows the new format (P###### or A######)
  IF v_user_tag ~ '^[PA][0-9]{6}$' THEN
    RETURN jsonb_build_object(
      'success', true,
      'public_id', v_user_tag,
      'message', 'ID público já existe.'
    );
  END IF;
  
  -- Generate new public ID
  v_new_tag := public.generate_public_id(COALESCE(v_user_type, 'aluno'));
  
  -- Update user_tag
  UPDATE public.profiles
  SET user_tag = v_new_tag
  WHERE id = p_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'public_id', v_new_tag,
    'message', 'ID público gerado com sucesso.'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'INTERNAL_ERROR',
    'message', 'Erro ao gerar ID público.'
  );
END;
$$;

-- Create view for public profiles (only non-sensitive data)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  p.id,
  p.user_tag as public_id,
  p.user_type::text as user_type,
  p.first_name as name,
  p.avatar_skin_id,
  p.mascot_skin_id,
  p.balance_pitecoin as ptc,
  p.pts_weekly as points,
  p.xp_total,
  p.level,
  COALESCE((
    SELECT COUNT(*)::int 
    FROM public.folders 
    WHERE owner_id = p.id
  ), 0) as lists_created,
  COALESCE((
    SELECT COUNT(*)::int 
    FROM public.flashcards 
    WHERE user_id = p.id
  ), 0) as cards_studied
FROM public.profiles p;

-- Allow authenticated users to view public profiles
CREATE POLICY "Anyone can view public profiles"
ON public.profiles
FOR SELECT
USING (true);

-- Create index for faster search by user_tag
CREATE INDEX IF NOT EXISTS idx_profiles_user_tag ON public.profiles(user_tag);
CREATE INDEX IF NOT EXISTS idx_profiles_first_name ON public.profiles(first_name);
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON public.profiles(user_type);