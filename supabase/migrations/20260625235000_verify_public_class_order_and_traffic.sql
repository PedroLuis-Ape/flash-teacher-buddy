-- Deployment guard for public classroom ordering and engagement analytics.
--
-- The feature migrations immediately preceding this file are intentionally
-- idempotent. This guard makes backend publication fail loudly instead of
-- shipping a frontend that silently lacks the required production objects.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'turmas'
      AND column_name = 'public_order_index'
  ) THEN
    RAISE EXCEPTION 'Missing public.turmas.public_order_index. Apply public classroom ordering migrations first.';
  END IF;

  IF to_regprocedure('public.reorder_public_turmas(uuid[])') IS NULL THEN
    RAISE EXCEPTION 'Missing public.reorder_public_turmas(uuid[]).';
  END IF;

  IF to_regclass('public.turma_engagement_sessions') IS NULL THEN
    RAISE EXCEPTION 'Missing public.turma_engagement_sessions.';
  END IF;

  IF to_regclass('public.turma_engagement_cards') IS NULL THEN
    RAISE EXCEPTION 'Missing public.turma_engagement_cards.';
  END IF;

  IF to_regprocedure('public.record_turma_engagement_v1(uuid,uuid,uuid,text,text,text,uuid,boolean,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Missing public.record_turma_engagement_v1 RPC.';
  END IF;

  IF to_regprocedure('public.get_turma_engagement_report_v1(uuid,integer)') IS NULL THEN
    RAISE EXCEPTION 'Missing public.get_turma_engagement_report_v1 RPC.';
  END IF;
END;
$$;

COMMENT ON COLUMN public.turmas.public_order_index IS
  'Teacher-defined 1-based position used when listing active public classrooms.';

COMMENT ON FUNCTION public.reorder_public_turmas(uuid[]) IS
  'Atomically saves the authenticated teacher public classroom order.';

COMMENT ON FUNCTION public.get_turma_engagement_report_v1(uuid, integer) IS
  'Owner-only classroom traffic report with identified account students and anonymous guest aggregates.';
