-- ============================================================
-- Phase 2 (Clara Master): stable status group identity for flashcards
-- ============================================================
-- Goal: every card belongs to a "status group" identified by a stable
-- uuid. All layers of the same card share the same status_group_uid.
-- This is the foundation for unifying Favorite / Red List / Special
-- without depending on parent_card_id (which mutates on merge/unmerge).
-- ============================================================

-- 1) Add column (nullable in this phase — orphan audit pending)
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS status_group_uid uuid;

-- 2) Backfill: layers inherit parent's id; parents/standalone use their own id.
--    Idempotent: only updates rows where the value is wrong/null.
UPDATE public.flashcards
   SET status_group_uid = COALESCE(parent_card_id, id)
 WHERE status_group_uid IS DISTINCT FROM COALESCE(parent_card_id, id);

-- 3) Index for status lookups by group
CREATE INDEX IF NOT EXISTS idx_flashcards_status_group_uid
  ON public.flashcards (status_group_uid);

-- 4) Trigger: keep status_group_uid in sync on INSERT and on parent_card_id changes
CREATE OR REPLACE FUNCTION public.flashcards_sync_status_group_uid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- On INSERT: default to parent's id or own id
  IF TG_OP = 'INSERT' THEN
    IF NEW.status_group_uid IS NULL THEN
      NEW.status_group_uid := COALESCE(NEW.parent_card_id, NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  -- On UPDATE: if parent_card_id changed (merge/unmerge), recompute.
  -- We deliberately keep the value when parent_card_id is unchanged so
  -- that callers cannot accidentally orphan a status group.
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.parent_card_id IS DISTINCT FROM OLD.parent_card_id) THEN
      NEW.status_group_uid := COALESCE(NEW.parent_card_id, NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flashcards_sync_status_group_uid ON public.flashcards;
CREATE TRIGGER trg_flashcards_sync_status_group_uid
  BEFORE INSERT OR UPDATE OF parent_card_id ON public.flashcards
  FOR EACH ROW
  EXECUTE FUNCTION public.flashcards_sync_status_group_uid();

-- 5) Comment for future contributors
COMMENT ON COLUMN public.flashcards.status_group_uid IS
  'Stable identity of the status group (favorite/red list/special) this card belongs to. Equals parent_card_id for layers, or id for parents/standalone. Maintained by trg_flashcards_sync_status_group_uid. Kept nullable in Phase 2 pending orphan audit; will become NOT NULL in a later phase.';
