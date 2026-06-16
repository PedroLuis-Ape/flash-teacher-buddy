# Public classes and Galaxy landing rollout

This branch introduces public, read-only classroom sharing and a persisted landing-page theme selector.

## Before merge

- Apply the Supabase migration in `supabase/migrations/20260616143000_add_public_turmas.sql`.
- Point the `/turmas/:turmaId` route to the access-aware classroom wrapper.
- Run the production build and classroom smoke tests.
- Verify anonymous users cannot mutate classroom data.
