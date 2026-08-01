-- Mixed study sessions already use the existing study_sessions contract
-- (cards_order/current_index/completed). This additive migration only expands
-- the mode allow-list; it preserves every existing mode and every row.
-- It is intentionally not applied remotely by the agent.

-- The original table migration creates this constraint with this stable name.
-- Do not discover/drop constraints by inspecting their SQL definition: a
-- divergent environment must fail explicitly rather than losing an unrelated
-- check constraint.
ALTER TABLE public.study_sessions
  DROP CONSTRAINT IF EXISTS study_sessions_mode_check;

ALTER TABLE public.study_sessions
  ADD CONSTRAINT study_sessions_mode_check
  CHECK (mode IN ('flip', 'multiple-choice', 'write', 'mixed-adaptive'));
