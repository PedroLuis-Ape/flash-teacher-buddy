# App Piteco Visual Polish — Design Specification

**Date:** 2026-09-11  
**Status:** Approved for implementation from the user's full visual-polish briefing and subsequent instruction to proceed with the installed skills.  
**Scope:** visual, responsive, accessibility, interaction feedback, and game-surface polish only.

## Problem

The authenticated Piteco application already has a recognizable dark space identity and working study flows, but several surfaces compete for attention and lose usable space on smaller viewports. The live app audit showed a dense list-detail header, a crowded folder action row, a side menu that can visually clip at the current narrow desktop window, and fixed bottom navigation that can cover content. The Games Hub and study surfaces need a common visual language for response feedback without changing their data or session rules.

## Goals

- Make the existing Piteco feel more refined, alive, consistent, and professional.
- Treat mobile as the primary path at 320–430px, then verify tablet and desktop.
- Make the main action obvious while preserving every existing capability.
- Give game actions immediate, restrained feedback for success, error, progress, streak, and completion.
- Keep overlays, keyboard entry, safe areas, themes, reduced motion, focus, and touch usable.
- Preserve the current Supabase, auth, RLS, import/export, SEO, progress, and study-engine behavior.

## Non-goals

- No schema, migration, RPC, RLS, authentication, query-key, progress, deck-order, or study-algorithm changes.
- No new animation dependency.
- No replacement of Piteco's dark/galaxy identity with a generic design system.
- No publication, Lovable deployment, remote merge, or production data mutation from this implementation branch.

## Design direction

The memorable element is the learner's active task: a clear primary CTA and a responsive study surface. Surrounding chrome becomes quieter and more deliberate. Existing HSL tokens, Lucide icons, shadcn/Radix primitives, and the Piteco purple/blue accent remain the source of truth.

### Token system

- `--background`: deep space canvas; preserve existing theme values.
- `--card`: elevated study/library surface; preserve existing theme values.
- `--primary`: violet action and focus accent.
- `--secondary`: blue supporting action.
- `--success` / `--destructive`: semantic feedback only, never decoration.
- `--space-content-bottom`: reserved mobile-safe content space above the fixed tab bar.

Spacing follows existing Tailwind tokens, with compact mobile gaps (`gap-2`/`gap-3`) and larger section separation only between semantic groups. Interactive targets remain at least 44px where practical.

### Type and alignment

Use the existing application typeface and token classes. Headings remain sentence-case and left-aligned in app surfaces. A game prompt/card may center-align its learning content; controls and explanations remain left-aligned for scanning. Titles use `clamp` or existing responsive sizes rather than oversized mobile headings.

### Layout concept

```text
mobile
┌──────────────────────────┐
│ compact app bar          │
│ page title + primary CTA │
│ quiet secondary actions  │
│ content / study card     │
│ safe bottom reserve      │
├──────────────────────────┤
│ fixed tab bar + safearea │
└──────────────────────────┘

desktop
┌────── navigation ──────┬──────────────────────────┐
│                        │ title + primary action   │
│                        │ grouped secondary tools  │
│                        │ content / game surface   │
└────────────────────────┴──────────────────────────┘
```

The mobile tab bar is fixed only when its height is reserved by the page. Full-screen study screens keep their own controls and do not mount the global bar. Wide layouts use progressive disclosure for secondary list/folder actions rather than deleting them.

### Motion and effects

- Use `transform` and `opacity` for press, entrance, and card transitions.
- Keep responses short (roughly 120–220ms) and never require motion to understand state.
- Use a single subtle success/error treatment at a time; no always-on particle field.
- Respect `prefers-reduced-motion` and the existing performance attributes.
- Avoid additional blur, large shadows, layout-affecting width/height transitions, and expensive filters on mobile.

## Incremental boundaries

1. Shared responsive foundation: page/tab bars, safe-area reserve, focus/press states, overlay sizing.
2. Home, library, folder, and list-detail hierarchy.
3. Games Hub mode cards and settings density.
4. Study/game feedback surfaces using existing state only.
5. Dialogs, sheets, popovers, themes, and global states.
6. Full route matrix, second global pass, mobile and desktop regression.

Each boundary is independently testable and can be reverted without touching persistence or study rules.

## Acceptance criteria

- No horizontal overflow or cutoff in the required mobile, tablet, and desktop viewports.
- Fixed navigation never hides actionable content; dialogs and sheets fit or scroll internally with safe-area padding.
- Primary actions remain obvious; secondary actions remain discoverable and keyboard/touch accessible.
- Games provide clear, restrained success/error/progress/completion feedback with no added business logic.
- Reduced-motion and performance kill-switch paths disable nonessential motion/decor.
- No new console errors or layout-shift regressions.
- Existing route, study, favorite, import, and data behavior remains unchanged.
- The final report records before/after screenshots, screens, viewports, cycles, commands, findings, and remaining out-of-scope functional issues.

## Known validation limitation

The Lovable dashboard/preview tab disappeared during live inspection. The published Piteco tab was used for read-only evidence; a full preview comparison remains a release gate until the correct Lovable project tab is available again.
