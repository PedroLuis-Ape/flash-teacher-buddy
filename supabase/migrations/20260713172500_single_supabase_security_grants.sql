-- Remove default PUBLIC execute privileges from internal trigger/helper
-- functions. Public read RPCs remain intentionally callable because they apply
-- strict publication filters internally.

REVOKE ALL ON FUNCTION public.generate_ape_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_user_tag() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepare_profile_identifiers() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.folder_glossary_sync_owner_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_bug_reports_updated_at() FROM PUBLIC;

-- Account glossary reads are user-scoped and must never be anonymous.
REVOKE ALL ON FUNCTION public.get_account_glossary_for_list_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_account_glossary_for_list_v1(uuid) TO authenticated;

-- The tables are already privilege-revoked. Explicit deny policies document
-- the direct-access boundary and keep all access behind validated RPCs.
DROP POLICY IF EXISTS public_entity_publications_no_direct_access
  ON public.public_entity_publications;
CREATE POLICY public_entity_publications_no_direct_access
  ON public.public_entity_publications
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS web_vital_samples_no_direct_access
  ON public.web_vital_samples;
CREATE POLICY web_vital_samples_no_direct_access
  ON public.web_vital_samples
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_user_list_activity_list_id
  ON public.user_list_activity(list_id);
