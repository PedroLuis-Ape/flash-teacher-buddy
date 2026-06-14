-- ============================================================
-- Phase 3 (Clara Master): unified per-group status + idempotent RPC
-- ============================================================
-- One row per (user, status_group_uid). Holds Favorite and Red List
-- only — "Special" stays per-layer in user_special_flashcards.
-- ============================================================

-- 1) TABLE
CREATE TABLE IF NOT EXISTS public.user_flashcard_group_status (
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status_group_uid   uuid NOT NULL,
  is_favorite        boolean NOT NULL DEFAULT false,
  is_red_list        boolean NOT NULL DEFAULT false,
  last_operation_id  uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, status_group_uid),
  -- Red List requires Favorite. Enforced at write time; RPC also normalizes.
  CONSTRAINT user_flashcard_group_status_red_requires_fav
    CHECK (is_red_list = false OR is_favorite = true)
);

CREATE INDEX IF NOT EXISTS idx_ufgs_user_favorite
  ON public.user_flashcard_group_status (user_id) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_ufgs_user_redlist
  ON public.user_flashcard_group_status (user_id) WHERE is_red_list = true;

-- 2) GRANTS (Data API access; RLS enforces row-level scope)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_flashcard_group_status TO authenticated;
GRANT ALL ON public.user_flashcard_group_status TO service_role;
-- No anon grant: every row is scoped to auth.uid().

-- 3) RLS
ALTER TABLE public.user_flashcard_group_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ufgs select own" ON public.user_flashcard_group_status;
CREATE POLICY "ufgs select own"
  ON public.user_flashcard_group_status
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ufgs insert own" ON public.user_flashcard_group_status;
CREATE POLICY "ufgs insert own"
  ON public.user_flashcard_group_status
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ufgs update own" ON public.user_flashcard_group_status;
CREATE POLICY "ufgs update own"
  ON public.user_flashcard_group_status
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ufgs delete own" ON public.user_flashcard_group_status;
CREATE POLICY "ufgs delete own"
  ON public.user_flashcard_group_status
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4) updated_at trigger (reuse the project's generic helper if present)
CREATE OR REPLACE FUNCTION public.ufgs_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ufgs_touch_updated_at ON public.user_flashcard_group_status;
CREATE TRIGGER trg_ufgs_touch_updated_at
  BEFORE UPDATE ON public.user_flashcard_group_status
  FOR EACH ROW EXECUTE FUNCTION public.ufgs_touch_updated_at();

-- 5) RPC: idempotent set_flashcard_group_status
--
-- Contract:
--   - p_status_group_uid MUST exist in flashcards (otherwise raises).
--   - p_operation_id is REQUIRED. If an existing row already records the
--     same last_operation_id, the function returns the existing state
--     unchanged (idempotency: safe retries from the client / outbox).
--   - p_is_red_list is normalized to false whenever p_is_favorite is false,
--     enforcing the "Red List requires Favorite" invariant in addition to
--     the CHECK constraint.
--   - Returns the final row state.
CREATE OR REPLACE FUNCTION public.set_flashcard_group_status(
  p_status_group_uid uuid,
  p_is_favorite      boolean,
  p_is_red_list      boolean,
  p_operation_id     uuid
)
RETURNS public.user_flashcard_group_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row     public.user_flashcard_group_status;
  v_exists  boolean;
  v_final_red boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_status_group_uid IS NULL THEN
    RAISE EXCEPTION 'p_status_group_uid is required' USING ERRCODE = '22023';
  END IF;
  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION 'p_operation_id is required for idempotency' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.flashcards WHERE status_group_uid = p_status_group_uid
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'unknown status_group_uid: %', p_status_group_uid
      USING ERRCODE = '23503';
  END IF;

  -- Idempotency short-circuit
  SELECT * INTO v_row
    FROM public.user_flashcard_group_status
   WHERE user_id = v_user_id AND status_group_uid = p_status_group_uid;

  IF FOUND AND v_row.last_operation_id IS NOT DISTINCT FROM p_operation_id THEN
    RETURN v_row;
  END IF;

  v_final_red := COALESCE(p_is_red_list, false) AND COALESCE(p_is_favorite, false);

  INSERT INTO public.user_flashcard_group_status AS u
    (user_id, status_group_uid, is_favorite, is_red_list, last_operation_id)
  VALUES
    (v_user_id, p_status_group_uid, COALESCE(p_is_favorite, false), v_final_red, p_operation_id)
  ON CONFLICT (user_id, status_group_uid) DO UPDATE
    SET is_favorite       = EXCLUDED.is_favorite,
        is_red_list       = EXCLUDED.is_red_list,
        last_operation_id = EXCLUDED.last_operation_id,
        updated_at        = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Only authenticated users may call the RPC. Anon must not.
REVOKE ALL ON FUNCTION public.set_flashcard_group_status(uuid, boolean, boolean, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_flashcard_group_status(uuid, boolean, boolean, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_flashcard_group_status(uuid, boolean, boolean, uuid) TO authenticated;

COMMENT ON TABLE public.user_flashcard_group_status IS
  'Unified per-user Favorite/Red List status, keyed by flashcards.status_group_uid. Special remains layer-scoped in user_special_flashcards. Phase 3 (Clara Master).';
COMMENT ON FUNCTION public.set_flashcard_group_status(uuid, boolean, boolean, uuid) IS
  'Idempotent setter for user_flashcard_group_status. Pass a stable p_operation_id per logical user action so retries do not duplicate work.';
