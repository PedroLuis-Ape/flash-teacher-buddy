-- Corrigir warning de segurança: Function Search Path Mutable
-- Recriar função com search_path

CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;