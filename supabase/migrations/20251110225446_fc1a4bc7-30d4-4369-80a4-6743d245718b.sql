-- Add missing fields to public_catalog for curation
ALTER TABLE public.public_catalog
  ADD COLUMN IF NOT EXISTS sku text UNIQUE,
  ADD COLUMN IF NOT EXISTS type text CHECK (type IN ('avatar', 'card', 'bundle')),
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_by text DEFAULT 'system';

-- Create index on sku for fast lookups
CREATE INDEX IF NOT EXISTS idx_public_catalog_sku ON public.public_catalog(sku);

-- Create ingest_logs table for idempotency
CREATE TABLE IF NOT EXISTS public.ingest_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL UNIQUE,
  sku text NOT NULL,
  action text NOT NULL, -- 'upsert' | 'activate'
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on ingest_logs
ALTER TABLE public.ingest_logs ENABLE ROW LEVEL SECURITY;

-- Only developer admins can view ingest logs
CREATE POLICY "Developer admins can view ingest logs"
  ON public.ingest_logs
  FOR SELECT
  USING (is_developer_admin(auth.uid()));

-- System can insert ingest logs
CREATE POLICY "System can insert ingest logs"
  ON public.ingest_logs
  FOR INSERT
  WITH CHECK (true);

-- Create function to get rarity fallback price
CREATE OR REPLACE FUNCTION public.get_rarity_fallback_price(p_rarity text)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN CASE p_rarity
    WHEN 'normal' THEN 200
    WHEN 'rare' THEN 450
    WHEN 'epic' THEN 900
    WHEN 'legendary' THEN 1500
    ELSE 200
  END;
END;
$$;

COMMENT ON TABLE public.ingest_logs IS 'Logs for catalog ingest operations with idempotency tracking';
COMMENT ON COLUMN public.public_catalog.sku IS 'Unique stable identifier for store items (e.g., PITECO_PRIME_BUNDLE_V1)';
COMMENT ON COLUMN public.public_catalog.type IS 'Item type: avatar (requires avatar_final), card (requires card_final), or bundle (requires both)';
COMMENT ON COLUMN public.public_catalog.version IS 'Version number for tracking item updates';
COMMENT ON COLUMN public.public_catalog.created_by IS 'Creator identifier (system, dev, etc.)';