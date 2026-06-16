# Implementation status

## Included in this branch

- Database migration for public classroom visibility.
- Narrow read-only database views for public classroom content.
- Public flag support in classroom create and update flows.
- Teacher controls for visibility and share-link copying.
- Public read-only classroom screens.
- Persisted landing-page selector between the default and Galaxy themes.
- Public-shell Galaxy rendering gate.

## Integration note

The application route must use the access-aware classroom component before merge. This repository connector refused the source-file replacement, so that final route switch remains explicitly documented rather than silently claimed as complete.
