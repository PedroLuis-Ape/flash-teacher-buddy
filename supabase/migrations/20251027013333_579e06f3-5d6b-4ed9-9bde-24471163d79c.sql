-- Add economy fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS balance_pitecoin INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS xp_total INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS pts_weekly INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS last_daily_reward TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS best_streak INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS last_conversion TIMESTAMPTZ;

-- Create pitecoin_transactions table for logging
CREATE TABLE IF NOT EXISTS public.pitecoin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'bonus')),
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_user_created ON public.pitecoin_transactions(user_id, created_at DESC);

-- Create daily_activity table for tracking caps and streaks
CREATE TABLE IF NOT EXISTS public.daily_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  pts_earned INTEGER DEFAULT 0 NOT NULL,
  actions_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, activity_date)
);

CREATE INDEX idx_daily_activity_user_date ON public.daily_activity(user_id, activity_date DESC);

-- Create conversion_history table to prevent duplicates
CREATE TABLE IF NOT EXISTS public.conversion_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  pts_converted INTEGER NOT NULL,
  pitecoin_awarded INTEGER NOT NULL,
  streak_weeks INTEGER DEFAULT 0 NOT NULL,
  streak_bonus_pct INTEGER DEFAULT 0 NOT NULL,
  converted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

CREATE INDEX idx_conversion_user_week ON public.conversion_history(user_id, week_start DESC);

-- Enable RLS on new tables
ALTER TABLE public.pitecoin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for pitecoin_transactions
CREATE POLICY "Users can view their own transactions"
ON public.pitecoin_transactions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert transactions"
ON public.pitecoin_transactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS policies for daily_activity
CREATE POLICY "Users can view their own activity"
ON public.daily_activity
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own activity"
ON public.daily_activity
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS policies for conversion_history
CREATE POLICY "Users can view their own conversion history"
ON public.conversion_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert conversion history"
ON public.conversion_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Function to update level based on XP
CREATE OR REPLACE FUNCTION public.update_user_level()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.level = FLOOR(SQRT(NEW.xp_total / 100));
  RETURN NEW;
END;
$$;

-- Trigger to auto-update level when XP changes
DROP TRIGGER IF EXISTS trigger_update_level ON public.profiles;
CREATE TRIGGER trigger_update_level
BEFORE UPDATE OF xp_total ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_user_level();