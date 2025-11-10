-- Create equip_logs table for idempotency and audit
CREATE TABLE IF NOT EXISTS public.equip_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('avatar', 'mascot')),
  skin_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(operation_id, user_id)
);

-- Enable RLS
ALTER TABLE public.equip_logs ENABLE ROW LEVEL SECURITY;

-- Users can insert their own equip logs
CREATE POLICY "Users can insert their own equip logs"
ON public.equip_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own equip logs
CREATE POLICY "Users can view their own equip logs"
ON public.equip_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Create atomic equip function
CREATE OR REPLACE FUNCTION public.equip_skin_atomic(
  p_operation_id uuid,
  p_user_id uuid,
  p_kind text,
  p_skin_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owns_item boolean;
  v_skin_data jsonb;
  v_avatar_url text;
  v_card_url text;
  v_skin_name text;
  v_skin_rarity text;
  v_result jsonb;
BEGIN
  -- Check idempotency
  IF EXISTS (
    SELECT 1 FROM public.equip_logs 
    WHERE operation_id = p_operation_id AND user_id = p_user_id
  ) THEN
    -- Already processed, return current state
    SELECT jsonb_build_object(
      'success', true,
      'already_processed', true,
      'avatar_skin_id', avatar_skin_id,
      'mascot_skin_id', mascot_skin_id
    )
    INTO v_result
    FROM public.profiles
    WHERE id = p_user_id;
    
    RETURN v_result;
  END IF;

  -- Validate kind
  IF p_kind NOT IN ('avatar', 'mascot') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_INPUT',
      'message', 'Tipo inválido. Use "avatar" ou "mascot".'
    );
  END IF;

  -- Check ownership
  SELECT EXISTS(
    SELECT 1 FROM public.user_inventory
    WHERE user_id = p_user_id AND skin_id = p_skin_id
  ) INTO v_owns_item;

  IF NOT v_owns_item THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_OWNER',
      'message', 'Você não possui este item.'
    );
  END IF;

  -- Get skin data from catalog
  SELECT 
    avatar_final,
    card_final,
    name,
    rarity
  INTO v_avatar_url, v_card_url, v_skin_name, v_skin_rarity
  FROM public.public_catalog
  WHERE id = p_skin_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_FOUND',
      'message', 'Item não encontrado no catálogo.'
    );
  END IF;

  -- Validate required assets
  IF p_kind = 'avatar' AND (v_avatar_url IS NULL OR v_avatar_url = '') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'MISSING_ASSET',
      'message', 'Este item não tem a imagem de avatar necessária.'
    );
  END IF;

  IF p_kind = 'mascot' AND (v_card_url IS NULL OR v_card_url = '') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'MISSING_ASSET',
      'message', 'Este item não tem a imagem de card necessária.'
    );
  END IF;

  -- Update profile with atomic transaction
  IF p_kind = 'avatar' THEN
    UPDATE public.profiles
    SET 
      avatar_skin_id = p_skin_id,
      updated_at = now()
    WHERE id = p_user_id;
  ELSE
    UPDATE public.profiles
    SET 
      mascot_skin_id = p_skin_id,
      updated_at = now()
    WHERE id = p_user_id;
  END IF;

  -- Log the operation
  INSERT INTO public.equip_logs (operation_id, user_id, kind, skin_id)
  VALUES (p_operation_id, p_user_id, p_kind, p_skin_id);

  -- Return success with current state
  SELECT jsonb_build_object(
    'success', true,
    'avatar_skin_id', avatar_skin_id,
    'mascot_skin_id', mascot_skin_id,
    'message', CASE 
      WHEN p_kind = 'avatar' THEN 'Avatar ativado com sucesso!'
      ELSE 'Mascote ativado com sucesso!'
    END
  )
  INTO v_result
  FROM public.profiles
  WHERE id = p_user_id;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'INTERNAL_ERROR',
    'message', 'Erro ao equipar item. Tente novamente.'
  );
END;
$$;