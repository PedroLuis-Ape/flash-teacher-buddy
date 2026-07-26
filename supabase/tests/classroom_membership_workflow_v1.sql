-- Read-only contract smoke test for a database where the workflow migration
-- has been applied. Run this in a disposable/staging database, never against
-- the production data project as an anonymous SQL script.

DO $$
BEGIN
  IF to_regclass('public.turma_membros') IS NULL THEN
    RAISE EXCEPTION 'turma_membros is missing';
  END IF;
  IF to_regclass('public.turma_membership_events') IS NULL THEN
    RAISE EXCEPTION 'turma_membership_events is missing';
  END IF;
  IF to_regprocedure('public.transition_turma_membership_v1(uuid,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'transition_turma_membership_v1 is missing';
  END IF;
  IF to_regprocedure('public.get_turma_access_v1(uuid)') IS NULL THEN
    RAISE EXCEPTION 'get_turma_access_v1 is missing';
  END IF;
  IF to_regprocedure('public.list_my_turma_memberships_v1()') IS NULL THEN
    RAISE EXCEPTION 'list_my_turma_memberships_v1 is missing';
  END IF;
END;
$$;

-- Manual two-session matrix for staging:
-- 1. Student A requests a public turma; repeat the request; assert one row.
-- 2. Teacher approves/rejects; assert status and ativo projection.
-- 3. Teacher invites Student B; accept/reject from Student B.
-- 4. Repeat the same request/invite/approval with the same request_id at the
--    HTTP gateway; assert idempotent=true and no duplicate membership.
-- 5. Student leaves; teacher removes an active member; assert history remains
--    in turma_membership_events and private content is no longer readable.
-- 6. Attempt a forged target user, a non-owner approval, and a cross-user
--    turma access query; assert 403/404 and no data leakage.
