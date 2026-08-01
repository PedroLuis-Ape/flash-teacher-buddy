-- Mixed study sessions already use the existing study_sessions contract
-- (cards_order/current_index/completed). This additive migration only expands
-- the mode allow-list; it preserves every existing mode and every row.
-- It is intentionally not applied remotely by the agent.

DO $$
DECLARE
  existing_constraint record;
BEGIN
  -- Do not assume that environments kept the generated constraint name.
  -- Only replace the check that contains the existing study mode allow-list.
  FOR existing_constraint IN
    SELECT c.conname
    FROM pg_constraint AS c
    JOIN pg_class AS t ON t.oid = c.conrelid
    JOIN pg_namespace AS n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'study_sessions'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%mode%'
      AND pg_get_constraintdef(c.oid) ILIKE '%flip%'
      AND pg_get_constraintdef(c.oid) ILIKE '%multiple-choice%'
      AND pg_get_constraintdef(c.oid) ILIKE '%write%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.study_sessions DROP CONSTRAINT %I',
      existing_constraint.conname
    );
  END LOOP;
END
$$;

ALTER TABLE public.study_sessions
  ADD CONSTRAINT study_sessions_mode_check
  CHECK (mode IN ('flip', 'multiple-choice', 'write', 'mixed-adaptive'));
