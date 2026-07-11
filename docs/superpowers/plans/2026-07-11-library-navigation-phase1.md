# Library Navigation Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Library page reuse cached data, avoid duplicate authentication and count queries, and update immediately after create, move, or delete operations.

**Architecture:** A focused query module owns Library cache keys, Supabase reads, normalization, and immutable cache helpers. `FoldersOptimized` uses React Query as the single data source. `InstitutionContext` remains responsible only for institutions and the selected institution.

**Tech Stack:** React, TypeScript, TanStack React Query, Supabase JS, Vitest.

## Constraints

- Preserve the current visual identity and Library features.
- Do not change study/game, importer, glossary, or layered-card behavior.
- Do not add a database migration.
- Do not call `supabase.auth.getSession()` from the Library page.
- Keep previous cached content visible while revalidating.
- Run typecheck, tests, lint, and production build in CI.

## Tasks

- [ ] Add `src/features/library/libraryQueries.ts` with stable cache keys, normalized fetchers, and immutable cache helpers.
- [ ] Add unit tests for cache isolation, normalization, insertion, removal, and moving resources between scopes.
- [ ] Add `src/features/library/FoldersOptimized.tsx` using `useAuthUser` and React Query.
- [ ] Replace `src/pages/Folders.tsx` with a compatibility export to the optimized page.
- [ ] Remove the duplicate folder/count query and direct DOM mutation from `InstitutionContext`.
- [ ] Validate with GitHub Actions and open a manual-merge PR.

## Manual preview checklist

1. Open Library and wait for the initial load.
2. Enter a folder and return to Library.
3. Confirm cached folders appear without a full-page skeleton.
4. Create a folder and confirm it appears immediately.
5. Move or delete a folder and confirm it disappears immediately from the current space.
6. Change space and confirm cached data does not mix between spaces.
