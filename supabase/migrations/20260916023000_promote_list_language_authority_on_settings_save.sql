-- When a user deliberately saves list study/language settings, the list must
-- stop being ambiguous legacy/inherited metadata unless the caller explicitly
-- chooses another authority in the same write.
--
-- This is intentionally additive and does NOT rewrite any existing row.
BEGIN;

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

  -- If the caller explicitly selected an authority (including inherited),
  -- respect it exactly.
  IF NEW.language_settings_mode IS DISTINCT FROM OLD.language_settings_mode THEN
    RETURN NEW;
  END IF;

  -- This trigger only fires for UPDATE OF study/language columns. Therefore an
  -- unchanged-value save from the A/B settings dialog is still a deliberate
  -- settings write and must make the list authoritative. This closes the old
  -- en/pt ambiguity where saving the visibly-correct values left the row in
  -- legacy mode because no value was DISTINCT FROM the old row.
  NEW.language_settings_mode := 'explicit';
  RETURN NEW;
END;
$$;

COMMIT;
