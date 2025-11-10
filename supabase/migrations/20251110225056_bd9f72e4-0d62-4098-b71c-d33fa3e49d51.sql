-- Create app_config table for exchange settings
CREATE TABLE IF NOT EXISTS public.app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read config
CREATE POLICY "Anyone can read app config"
ON public.app_config
FOR SELECT
USING (true);

-- Only admins can update config (future feature)
CREATE POLICY "Admins can update app config"
ON public.app_config
FOR ALL
USING (is_developer_admin(auth.uid()));

-- Insert default exchange config
INSERT INTO public.app_config (key, value)
VALUES (
  'exchange',
  jsonb_build_object(
    'rate_ppc_per_pt', 0.01,
    'min_pts_per_tx', 100,
    'daily_pts_cap', 10000
  )
)
ON CONFLICT (key) DO NOTHING;

-- Create exchange_logs table
CREATE TABLE IF NOT EXISTS public.exchange_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pts_spent integer NOT NULL CHECK (pts_spent > 0),
  ppc_received integer NOT NULL CHECK (ppc_received > 0),
  rate numeric NOT NULL,
  ymd date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(operation_id, user_id)
);

-- Enable RLS
ALTER TABLE public.exchange_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own exchange logs
CREATE POLICY "Users can view their own exchange logs"
ON public.exchange_logs
FOR SELECT
USING (auth.uid() = user_id);

-- System can insert exchange logs
CREATE POLICY "System can insert exchange logs"
ON public.exchange_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_exchange_logs_user_ymd ON public.exchange_logs(user_id, ymd);
CREATE INDEX IF NOT EXISTS idx_exchange_logs_operation_id ON public.exchange_logs(operation_id);

-- Function to get exchange config
CREATE OR REPLACE FUNCTION public.get_exchange_config()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config jsonb;
BEGIN
  SELECT value INTO v_config
  FROM public.app_config
  WHERE key = 'exchange';
  
  IF v_config IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_FOUND',
      'message', 'Configuração de câmbio não encontrada.'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'config', v_config
  );
END;
$$;

-- Function to get exchange quote
CREATE OR REPLACE FUNCTION public.get_exchange_quote(
  p_user_id uuid,
  p_pts integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config jsonb;
  v_rate numeric;
  v_min_pts integer;
  v_daily_cap integer;
  v_daily_used integer;
  v_daily_remaining integer;
  v_ppc_out integer;
BEGIN
  -- Get config
  SELECT value INTO v_config
  FROM public.app_config
  WHERE key = 'exchange';
  
  IF v_config IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_FOUND',
      'message', 'Configuração não encontrada.'
    );
  END IF;
  
  v_rate := (v_config->>'rate_ppc_per_pt')::numeric;
  v_min_pts := (v_config->>'min_pts_per_tx')::integer;
  v_daily_cap := (v_config->>'daily_pts_cap')::integer;
  
  -- Validate input
  IF p_pts < v_min_pts THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'MIN_AMOUNT',
      'message', format('Quantidade mínima: %s PTS', v_min_pts)
    );
  END IF;
  
  -- Calculate daily usage
  SELECT COALESCE(SUM(pts_spent), 0)::integer
  INTO v_daily_used
  FROM public.exchange_logs
  WHERE user_id = p_user_id
    AND ymd = CURRENT_DATE;
  
  v_daily_remaining := v_daily_cap - v_daily_used;
  
  -- Check if request exceeds daily cap
  IF p_pts > v_daily_remaining THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DAILY_CAP_REACHED',
      'message', format('Limite diário atingido. Restam %s PTS', v_daily_remaining)
    );
  END IF;
  
  -- Calculate PPC output
  v_ppc_out := FLOOR(p_pts * v_rate)::integer;
  
  IF v_ppc_out <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'MIN_AMOUNT',
      'message', 'Quantidade resultante muito baixa.'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'pts_in', p_pts,
    'ppc_out', v_ppc_out,
    'rate', v_rate,
    'daily_used_pts', v_daily_used,
    'daily_remaining_pts', v_daily_remaining
  );
END;
$$;

-- Function to process exchange (atomic and idempotent)
CREATE OR REPLACE FUNCTION public.process_exchange(
  p_operation_id uuid,
  p_user_id uuid,
  p_pts integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config jsonb;
  v_rate numeric;
  v_min_pts integer;
  v_daily_cap integer;
  v_daily_used integer;
  v_current_pts integer;
  v_current_ppc integer;
  v_ppc_out integer;
  v_new_pts integer;
  v_new_ppc integer;
BEGIN
  -- Check idempotency
  IF EXISTS (
    SELECT 1 FROM public.exchange_logs
    WHERE operation_id = p_operation_id AND user_id = p_user_id
  ) THEN
    -- Already processed, return current balances
    SELECT pts_weekly, balance_pitecoin
    INTO v_current_pts, v_current_ppc
    FROM public.profiles
    WHERE id = p_user_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'new_points', v_current_pts,
      'new_ptc', v_current_ppc
    );
  END IF;
  
  -- Get config
  SELECT value INTO v_config
  FROM public.app_config
  WHERE key = 'exchange';
  
  IF v_config IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_FOUND',
      'message', 'Configuração não encontrada.'
    );
  END IF;
  
  v_rate := (v_config->>'rate_ppc_per_pt')::numeric;
  v_min_pts := (v_config->>'min_pts_per_tx')::integer;
  v_daily_cap := (v_config->>'daily_pts_cap')::integer;
  
  -- Validate input
  IF p_pts IS NULL OR p_pts < v_min_pts THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_INPUT',
      'message', 'Valor inválido. Tente outro número.'
    );
  END IF;
  
  -- Get current balances with lock
  SELECT pts_weekly, balance_pitecoin
  INTO v_current_pts, v_current_ppc
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_FOUND',
      'message', 'Usuário não encontrado.'
    );
  END IF;
  
  -- Check if user has enough PTS
  IF v_current_pts < p_pts THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_FUNDS',
      'message', format('Saldo insuficiente. Você tem %s PTS', v_current_pts)
    );
  END IF;
  
  -- Check daily cap
  SELECT COALESCE(SUM(pts_spent), 0)::integer
  INTO v_daily_used
  FROM public.exchange_logs
  WHERE user_id = p_user_id
    AND ymd = CURRENT_DATE;
  
  IF (v_daily_used + p_pts) > v_daily_cap THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DAILY_CAP_REACHED',
      'message', 'Limite diário de conversão atingido.'
    );
  END IF;
  
  -- Calculate PPC output
  v_ppc_out := FLOOR(p_pts * v_rate)::integer;
  
  IF v_ppc_out <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'MIN_AMOUNT',
      'message', 'Quantidade mínima não atingida.'
    );
  END IF;
  
  -- Calculate new balances
  v_new_pts := v_current_pts - p_pts;
  v_new_ppc := v_current_ppc + v_ppc_out;
  
  -- Update balances
  UPDATE public.profiles
  SET 
    pts_weekly = v_new_pts,
    balance_pitecoin = v_new_ppc,
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Log exchange
  INSERT INTO public.exchange_logs (
    operation_id, user_id, pts_spent, ppc_received, rate, ymd
  ) VALUES (
    p_operation_id, p_user_id, p_pts, v_ppc_out, v_rate, CURRENT_DATE
  );
  
  -- Log transaction for PTC
  INSERT INTO public.pitecoin_transactions (
    user_id, amount, balance_after, type, source
  ) VALUES (
    p_user_id, v_ppc_out, v_new_ppc, 'bonus', format('Câmbio: %s PTS', p_pts)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'new_points', v_new_pts,
    'new_ptc', v_new_ppc,
    'ppc_received', v_ppc_out,
    'message', 'Conversão concluída!'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'INTERNAL_ERROR',
    'message', 'Não foi possível converter agora. Tente novamente.'
  );
END;
$$;