# Public classes and Galaxy landing rollout

This branch introduces public, read-only classroom sharing and a persisted landing-page theme selector.

## Integrated

- `/turmas/:turmaId` uses the access-aware gate in `src/pages/TurmaDetail.tsx`.
- Owners and enrolled students keep the complete private classroom.
- Anonymous visitors and authenticated non-members receive the public read-only page when the classroom is public.
- Public database views expose only explicitly allowed fields and verify classroom ownership of assigned content.
- The public Galaxy theme is lazy-loaded on capable devices and uses a static backdrop on mobile, slow-update and reduced-motion devices.
- Netlify serves SPA redirects, safe response headers, immutable hashed assets and a no-cache application shell.

## Deployment order

1. Apply `supabase/migrations/20260616143000_add_public_turmas.sql`.
2. Deploy the updated `turmas-create` and `turmas-update` Edge Functions.
3. Publish the web application.
4. Test an existing private classroom before enabling public visibility.
5. Create a public classroom and validate its link in an anonymous browser window.

## Required smoke tests

- owner can create, publish, privatize and copy a classroom link;
- enrolled student continues to see the complete classroom;
- authenticated non-member sees only the public read-only page;
- anonymous visitor sees public content but no mutation controls;
- private classrooms do not reveal metadata or assigned content;
- disabling public visibility invalidates the shared link;
- Galaxy selector persists after reload;
- mobile Galaxy renders without animated stars;
- `/health.json` returns the static shell health payload.

## Preview limitation

The Netlify preview validates the web build and interface. Public classroom records will appear there only after the migration and Edge Functions are also available in the connected Supabase environment.
