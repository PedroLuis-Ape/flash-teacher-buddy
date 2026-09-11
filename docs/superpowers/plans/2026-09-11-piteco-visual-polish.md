# App Piteco Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the existing App Piteco across responsive library, study, game, overlay, and state surfaces while preserving all business and persistence behavior.

**Architecture:** Keep existing React/TypeScript/Tailwind/shadcn/Radix structure and add a small set of CSS/component primitives for safe-area, action hierarchy, feedback, and reduced-motion behavior. Migrate screens in vertical slices, leaving hooks, queries, Supabase calls, study snapshots, and route semantics unchanged.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/Radix, Lucide, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-11-piteco-visual-polish-design.md`

## Global Constraints

- Mobile is the absolute priority: `320x568`, `360x800`, `375x812`, `390x844`, `412x915`, `430x932`.
- Also test `768x1024`, `1280x720`, `1366x768`, `1440x900`, and `1920x1080`.
- Do not alter Supabase, RLS, auth, progress, algorithms, presets, import/export, bank, or SEO logic.
- Prefer existing React, TypeScript, Tailwind, shadcn, Radix, and Lucide primitives.
- Use transform/opacity for motion, honor `prefers-reduced-motion`, safe-area, focus, touch, and performance attributes.
- Each task ends with a targeted test or screenshot comparison and a logical commit.

### Task 1: Shared responsive shell and visual primitives

**Files:**
- Modify: `src/index.css` (shared layout/motion primitives and mobile safe-area rules)
- Modify: `src/components/ape/ApeAppBar.tsx` (compact title/action hierarchy)
- Modify: `src/components/ape/ApeTabBar.tsx` (reserved height, touch/focus states)
- Test: `src/components/ape/apeShellVisual.contract.test.ts`

**Interfaces:**
- Consumes existing `PerformanceContext`, theme tokens, and `isActiveStudyPath`.
- Produces reusable classes: `ape-content-safe-bottom`, `ape-action-cluster`, `ape-interactive-surface`, and `ape-overlay-scroll`.

- [ ] **Step 1: Write the failing contract test** asserting the shared components expose the new classes and reduced-motion CSS contains the primitive selectors.
- [ ] **Step 2: Run `npx vitest run src/components/ape/apeShellVisual.contract.test.ts` and confirm the expected failure.**
- [ ] **Step 3: Add the minimal CSS/classes and apply them only to the shared app/tab bars.**
- [ ] **Step 4: Run the targeted test and `npm run typecheck`.**
- [ ] **Step 5: Capture the current published app at the required widths and compare the bar/content boundary.**
- [ ] **Step 6: Commit `ui: establish responsive piteco shell primitives`.**

### Task 2: Home, library, and folder action hierarchy

**Files:**
- Modify: `src/pages/Index.tsx`
- Modify: `src/features/library/FoldersOptimized.tsx`
- Modify: `src/pages/Folder.tsx`
- Test: `src/pages/__tests__/visualNavigation.contract.test.ts`

**Interfaces:**
- Consumes existing navigation, reinforcement, folder/list queries, and mutation handlers unchanged.
- Produces clearer hierarchy, safe content bottom padding, consistent action clusters, and mobile progressive disclosure without removing actions.

- [ ] **Step 1: Write failing contracts for visible reinforcement CTA, safe bottom padding, and mobile action menu classes.**
- [ ] **Step 2: Run the focused test and confirm it fails against the current markup.**
- [ ] **Step 3: Apply classes and composition changes without changing handlers, query keys, or mutation payloads.**
- [ ] **Step 4: Run focused tests, typecheck, and inspect Home → Biblioteca → pasta in the live app tab.**
- [ ] **Step 5: Exercise touch-sized actions, folder navigation, and back navigation; capture before/after screenshots.**
- [ ] **Step 6: Commit `ui: polish home library and folder hierarchy`.**

### Task 3: List-detail and overlay responsiveness

**Files:**
- Modify: `src/pages/ListDetail.tsx`
- Modify: `src/pages/SpecialCards.tsx`
- Modify: `src/components/ui/dialog.tsx` only if the existing primitive needs safe-area classes
- Test: `src/pages/__tests__/listDetailResponsive.contract.test.ts`

**Interfaces:**
- Consumes existing list/card/favorite/attention handlers and dialog primitives.
- Produces a readable primary study header, grouped secondary actions, and usable mobile filters/dialogs without changing card identity or data operations.

- [ ] **Step 1: Write failing markup contracts for the responsive action cluster, dialog scroll region, and content-safe-bottom hook.**
- [ ] **Step 2: Run the focused test and confirm the failure is caused by the missing visual contract.**
- [ ] **Step 3: Recompose only the visual layout; preserve all card handlers and persistence calls verbatim.**
- [ ] **Step 4: Run focused tests and typecheck.**
- [ ] **Step 5: Interact with list search, export/import menus, edit dialog, filters, and attention controls at 320px and 390px; capture screenshots.**
- [ ] **Step 6: Commit `ui: improve list detail and overlay responsiveness`.**

### Task 4: Games Hub visual hierarchy

**Files:**
- Modify: `src/pages/GamesHub.tsx`
- Modify: `src/features/study/lib/gameModeVisuals.ts` only for visual token consistency, if required by the existing API
- Test: `src/pages/__tests__/gamesHubVisual.contract.test.ts`

**Interfaces:**
- Consumes existing `gameOptions`, `GAME_MODE_VISUALS`, preference hooks, and `startGame` unchanged.
- Produces distinct, touch-friendly game mode tiles, clearer configuration grouping, and reduced mobile density.

- [ ] **Step 1: Write failing contracts for mode tile semantic labels, recommended/configured states, and responsive grid classes.**
- [ ] **Step 2: Run the focused test and verify it fails.**
- [ ] **Step 3: Apply visual classes and layout grouping; do not modify launch route, preference precedence, or scope logic.**
- [ ] **Step 4: Run focused tests and typecheck.**
- [ ] **Step 5: Navigate to the Hub in the live app, open settings/selects, test every available mode tile without submitting answers, and capture mobile/desktop screenshots.**
- [ ] **Step 6: Commit `ui: refine games hub mode hierarchy`.**

### Task 5: Study/game feedback surfaces

**Files:**
- Inspect and modify only the visual portions of `src/features/study/components/StudyFeedbackPanel.tsx`, `src/features/study/components/StudyCompletionModal.impl.tsx`, `src/features/study/components/FlipStudyView.tsx`, and the concrete game components identified by the route audit
- Modify: `src/index.css` for shared feedback keyframes/classes
- Test: existing study contract tests plus new focused visual contracts beside the affected components

**Interfaces:**
- Consumes existing correctness, progress, streak, round, and completion state.
- Produces semantic success/error/progress/completion feedback using existing state; no new persistence, scoring, order, or mutation logic.

- [ ] **Step 1: Write failing tests for feedback class/state mapping and reduced-motion fallback.**
- [ ] **Step 2: Run the focused tests and confirm failure.**
- [ ] **Step 3: Add minimal transform/opacity feedback and stable reserved regions so effects cannot cause layout shift.**
- [ ] **Step 4: Run study/game focused tests and typecheck.**
- [ ] **Step 5: Play several cards in Flip, Write/Rewrite, Multiple Choice, Unscramble, Mixed, and any existing Race/Mastery/Gamified routes; test input, TTS, hint, skip, correction, back, completion, and reduced motion.**
- [ ] **Step 6: Commit `ui: add restrained study feedback states`.**

### Task 6: Global overlays, themes, states, and accessibility pass

**Files:**
- Modify: affected dialog/sheet/popover/toast components found by route audit, keeping the edit list minimal
- Modify: `src/index.css` for shared overlay/safe-area/reduced-motion rules
- Test: focused contracts for loading, empty, error, retry, and overlay accessibility

**Interfaces:**
- Consumes existing Radix states and error/loading/empty content.
- Produces consistent focus, scroll, safe-area, retry, empty, and theme behavior across internal screens.

- [ ] **Step 1: Write failing contracts for overlay max-height/scroll, focus visibility, and reduced-motion selectors.**
- [ ] **Step 2: Run focused tests and confirm failure.**
- [ ] **Step 3: Apply the smallest shared fixes and screen-specific classes required by evidence.**
- [ ] **Step 4: Run focused tests and lint the affected files.**
- [ ] **Step 5: Audit glossary, importers, turmas, profile, settings, store, notes, empty/loading/error/completion states, and Galaxy theme in the live app.**
- [ ] **Step 6: Commit `ui: harden overlays themes and responsive states`.**

### Task 7: Second global pass and release evidence

**Files:**
- Create: `reports/visual-polish/2026-09-11-piteco-visual-polish.md`
- Create: `artifacts/visual-polish/` screenshots only if they are intentionally kept as release evidence
- Modify: only files required by findings from the second pass

**Interfaces:**
- Consumes all prior UI blocks and the live browser/preview evidence.
- Produces the required audit report with screen/viewport matrix, before/after captures, cycles, commands, findings, remaining out-of-scope functional issues, and rollback commits.

- [ ] **Step 1: Run a global navigation pass Home → list → Games Hub → game → result → folder → turma → profile and repeat critical mobile widths.**
- [ ] **Step 2: Run the dedicated mobile matrix including portrait, selected landscape, keyboard entry, touch, dialogs, themes, and console monitoring.**
- [ ] **Step 3: Fix only regressions found in the pass and rerun the affected screenshots/interactions.**
- [ ] **Step 4: Run `npm run typecheck`, `npm run test`, `npm run lint`, `npm run build`, `npm run seo:visibility:score`, and `npm run preview:smoke`; record exact exit/results.**
- [ ] **Step 5: Review the diff for business-logic/Supabase changes, verify every commit, and document rollback by commit.**
- [ ] **Step 6: Commit `docs: record piteco visual polish validation`.**

## Rollback

Revert the logical UI commits in reverse order. Do not reset shared branches or delete user data. If a visual block causes a regression, revert only that block and retain the report and screenshots as evidence.

## Release gate

Do not claim the mission complete or merge/publish until the live visual loop has been executed, the Lovable preview limitation is resolved or explicitly documented as a remaining release blocker, and all required technical commands have fresh passing output.
