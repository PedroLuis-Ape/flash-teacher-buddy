# SEO discovery contract rollback

This rollout is application-only. It does not add or apply Supabase migrations and does not change Auth, RLS, private data or ownership.

## Rollback trigger

Rollback if the Lovable deployment fails to serve the sitemap index or any segment, if canonical public routes regress, or if the publication report disagrees with the deployed files.

## Safe rollback

1. Revert the rollout commit or PR.
2. Publish the previous known-good Lovable commit.
3. Confirm that `/sitemap.xml`, `/robots.txt`, `/portal`, one public teacher and one public folder still respond.
4. Do not change `PRODUCTION_DATA_PROJECT_ID`; production accounts and data remain on `ymahldldyxvwjeruaxpr`.

Generated list pages and sitemap segments contain only data already returned by anonymous public RPCs. Removing the rollout removes those generated artifacts on the next build; it does not delete any database content.
