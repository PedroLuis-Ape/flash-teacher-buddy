-- Fix RLS for message_rate_limits table
ALTER TABLE public.message_rate_limits ENABLE ROW LEVEL SECURITY;

-- No direct access needed - only used by security definer function
CREATE POLICY "No direct access to rate limits"
ON public.message_rate_limits
FOR ALL
USING (false);