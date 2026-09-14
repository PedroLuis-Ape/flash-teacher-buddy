BEGIN;

REVOKE EXECUTE ON FUNCTION public.claim_study_session_v1(uuid, text, text, integer, jsonb, jsonb, jsonb, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.persist_study_session_v1(uuid, bigint, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_flashcard_progress_v1(uuid, uuid, boolean, uuid) FROM anon;

COMMIT;

NOTIFY pgrst, 'reload schema';