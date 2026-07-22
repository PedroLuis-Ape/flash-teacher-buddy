# Implementation status

## Completed in this branch

- Public/private classroom visibility with private-by-default migration.
- Owner controls for creation, publication, privatization and link copying.
- Access-aware classroom gate preserving the complete private experience for owners and members.
- Anonymous and non-member read-only classroom pages.
- Narrow public views with ownership, classroom, visibility and soft-delete checks.
- Teacher account identifiers removed from public-name fallbacks.
- Validated create/update Edge Functions with method, type and length checks.
- Persisted public selector between the default and Galaxy themes.
- Lazy desktop Galaxy effects and static constrained-device rendering.
- Lovable publication with SPA routing, canonical domain and static health endpoint.
- Removal of unused experimental classroom routers and duplicate public assignment screen.
- Branch synchronized with the current `main` before final validation.

## Automated validation

The pull-request CI runs type checking, tests, lint and the production build. Lovable remains the official preview and publication environment.

## Deployment dependency

The web preview can validate navigation and visual behavior, but public classroom data requires the Supabase migration and updated Edge Functions to be deployed in the target environment.

## Manual release checks

Use the smoke-test checklist in `docs/public-classes-rollout.md` before merging and publishing to production.
