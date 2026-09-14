-- Human-readable aliases are secondary identifiers. UUID remains canonical.
-- F-/L- references have a six-character suffix from an unambiguous alphabet.

ALTER TABLE public.folders
  ADD COLUMN IF NOT EXISTS reference_id text;

ALTER TABLE public.lists
  ADD COLUMN IF NOT EXISTS reference_id text;

CREATE OR REPLACE FUNCTION public.generate_folder_reference_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  candidate text;
  suffix text;
BEGIN
  -- Serialize allocation for this namespace; the unique index remains the
  -- final database guarantee if any external writer bypasses this function.
  PERFORM pg_advisory_xact_lock(hashtextextended('folders.reference_id', 0));
  LOOP
    suffix := '';
    FOR i IN 1..6 LOOP
      suffix := suffix || substr(alphabet, floor(random() * length(alphabet) + 1)::integer, 1);
    END LOOP;
    candidate := 'F-' || suffix;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.folders WHERE reference_id = candidate
    );
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_list_reference_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  candidate text;
  suffix text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('lists.reference_id', 0));
  LOOP
    suffix := '';
    FOR i IN 1..6 LOOP
      suffix := suffix || substr(alphabet, floor(random() * length(alphabet) + 1)::integer, 1);
    END LOOP;
    candidate := 'L-' || suffix;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.lists WHERE reference_id = candidate
    );
  END LOOP;
  RETURN candidate;
END;
$$;

-- Idempotent for a partially applied migration or a retry: existing aliases
-- are preserved and only missing values are generated.
--
-- O guard de coleções automáticas (trg_folders_system_collection_readonly /
-- trg_lists_system_collection_readonly) bloqueia UPDATE em linhas com
-- system_kind <> 'user', e pastas/listas automáticas também precisam do alias.
-- O backfill é administrativo e usa a escotilha sancionada pelo próprio guard
-- (usuário postgres + GUC), que é transaction-local e volta ao normal no fim.
SELECT set_config('app.allow_system_collection_mutation', 'on', true);

UPDATE public.folders
SET reference_id = public.generate_folder_reference_id()
WHERE reference_id IS NULL OR btrim(reference_id) = '';

UPDATE public.lists
SET reference_id = public.generate_list_reference_id()
WHERE reference_id IS NULL OR btrim(reference_id) = '';

SELECT set_config('app.allow_system_collection_mutation', 'off', true);

ALTER TABLE public.folders
  ALTER COLUMN reference_id SET NOT NULL;

ALTER TABLE public.lists
  ALTER COLUMN reference_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS folders_reference_id_key
  ON public.folders(reference_id);

CREATE UNIQUE INDEX IF NOT EXISTS lists_reference_id_key
  ON public.lists(reference_id);

CREATE OR REPLACE FUNCTION public.enforce_folder_reference_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.reference_id := public.generate_folder_reference_id();
  ELSIF NEW.reference_id IS DISTINCT FROM OLD.reference_id THEN
    RAISE EXCEPTION 'folder reference_id is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_list_reference_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.reference_id := public.generate_list_reference_id();
  ELSIF NEW.reference_id IS DISTINCT FROM OLD.reference_id THEN
    RAISE EXCEPTION 'list reference_id is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_folder_reference_id ON public.folders;
CREATE TRIGGER enforce_folder_reference_id
  BEFORE INSERT OR UPDATE ON public.folders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_folder_reference_id();

DROP TRIGGER IF EXISTS enforce_list_reference_id ON public.lists;
CREATE TRIGGER enforce_list_reference_id
  BEFORE INSERT OR UPDATE ON public.lists
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_list_reference_id();

-- These helpers are trigger-only implementation details, not an RPC surface.
REVOKE ALL ON FUNCTION public.generate_folder_reference_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_list_reference_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_folder_reference_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_list_reference_id() FROM PUBLIC, anon, authenticated;
