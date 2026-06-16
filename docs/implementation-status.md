# Implementation status

## Included in this branch

- Database migration for public classroom visibility.
- Narrow read-only database views for public classroom content.
- Public flag support in classroom create and update flows.
- Teacher controls for visibility and share-link copying.
- Public read-only classroom screens.
- Access-aware classroom gate in `src/pages/TurmaDetail.tsx`.
- Persisted landing-page selector between the default and Galaxy themes.
- Public-shell Galaxy rendering gate.

## Before merge

- Run the production build and type checking.
- Apply and validate the Supabase migration.
- Test professor, enrolled student, authenticated non-member, and anonymous visitor flows.
- Confirm public visitors remain read-only.
- Review Galaxy performance on mobile devices.
