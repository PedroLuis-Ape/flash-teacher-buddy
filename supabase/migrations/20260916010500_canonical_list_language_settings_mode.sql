-- Canonical A/B language-settings authority for lists.
--
-- Contract:
--   side A = front = term = lang_a
--   side B = back  = translation = lang_b
--
-- `language_settings_mode` removes the historical ambiguity between an
-- intentional en/pt list configuration and the database's old en/pt defaults.
-- Existing rows are deliberately NOT rewritten: NULL means legacy to the app,
-- so no flashcard content or existing list semantics change on migration.
BEGIN;

ALTER TABLE public.lists
  ADD COLUMN IF NOT EXISTS language_settings_mode text;

-- New rows that do not state an authority explicitly start in compatibility
-- mode. Pre-existing rows remain NULL and are interpreted as legacy by the
-- canonical resolver, avoiding a mass UPDATE on production data.
ALTER TABLE public.lists
  ALTER COLUMN language_settings_mode SET DEFAULT 'legacy';

ALTER TABLE public.lists
  DROP CONSTRAINT IF EXISTS lists_language_settings_mode_check;

ALTER TABLE public.lists
  ADD CONSTRAINT lists_language_settings_mode_check
  CHECK (
    language_settings_mode IS NULL
    OR language_settings_mode IN ('legacy', 'explicit', 'inherited')
  ) NOT VALID;

ALTER TABLE public.lists
  VALIDATE CONSTRAINT lists_language_settings_mode_check;

COMMENT ON COLUMN public.lists.language_settings_mode IS
  'Authority for study/language settings: explicit=list owns A/B metadata; inherited=folder owns it; legacy or NULL=pre-contract compatibility heuristic.';

-- New manual/editor writes that actually define study settings become explicit.
-- Rows inserted without any study metadata (for example old clone paths) stay
-- legacy, which is safer than silently changing historical inheritance rules.
CREATE OR REPLACE FUNCTION public.normalize_list_language_settings_mode_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.language_settings_mode := COALESCE(NEW.language_settings_mode, 'legacy');
    IF NEW.language_settings_mode = 'legacy'
       AND (
         NEW.labels_a IS NOT NULL
         OR NEW.labels_b IS NOT NULL
         OR NEW.study_type IS DISTINCT FROM 'language'
         OR NEW.tts_enabled IS DISTINCT FROM true
         OR NEW.lang_a IS DISTINCT FROM 'en'
         OR NEW.lang_b IS DISTINCT FROM 'pt'
       ) THEN
      NEW.language_settings_mode := 'explicit';
    END IF;
    RETURN NEW;
  END IF;

  -- Respect an explicitly supplied mode change (including switching to
  -- inherited). Only infer `explicit` when the caller changes study metadata
  -- without changing the authority field itself. This also upgrades an old
  -- NULL/legacy row the first time its study settings are deliberately edited.
  IF NEW.language_settings_mode IS NOT DISTINCT FROM OLD.language_settings_mode
     AND (
       NEW.study_type IS DISTINCT FROM OLD.study_type
       OR NEW.lang_a IS DISTINCT FROM OLD.lang_a
       OR NEW.lang_b IS DISTINCT FROM OLD.lang_b
       OR NEW.labels_a IS DISTINCT FROM OLD.labels_a
       OR NEW.labels_b IS DISTINCT FROM OLD.labels_b
       OR NEW.tts_enabled IS DISTINCT FROM OLD.tts_enabled
     ) THEN
    NEW.language_settings_mode := 'explicit';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_list_language_settings_mode_v1 ON public.lists;
CREATE TRIGGER trg_normalize_list_language_settings_mode_v1
BEFORE INSERT OR UPDATE OF
  study_type,
  lang_a,
  lang_b,
  labels_a,
  labels_b,
  tts_enabled,
  language_settings_mode
ON public.lists
FOR EACH ROW
EXECUTE FUNCTION public.normalize_list_language_settings_mode_v1();

-- Super Import packages explicitly declare front_language/back_language. The
-- existing import engines already record every newly-created list in
-- global_import_items, so we can mark those lists explicit without rewriting
-- several historical RPC bodies or touching imported flashcards.
CREATE OR REPLACE FUNCTION public.mark_super_import_list_language_settings_explicit_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.entity_type = 'list'
     AND NEW.action = 'created'
     AND NEW.entity_id IS NOT NULL THEN
    UPDATE public.lists
    SET language_settings_mode = 'explicit'
    WHERE id = NEW.entity_id
      AND COALESCE(language_settings_mode, 'legacy') = 'legacy';
  END IF;

  RETURN NEW;
END;
$$;

DO $trigger$
BEGIN
  IF to_regclass('public.global_import_items') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_mark_super_import_list_language_settings_explicit_v1
      ON public.global_import_items;
    CREATE TRIGGER trg_mark_super_import_list_language_settings_explicit_v1
    AFTER INSERT ON public.global_import_items
    FOR EACH ROW
    EXECUTE FUNCTION public.mark_super_import_list_language_settings_explicit_v1();
  END IF;
END;
$trigger$;

COMMIT;
