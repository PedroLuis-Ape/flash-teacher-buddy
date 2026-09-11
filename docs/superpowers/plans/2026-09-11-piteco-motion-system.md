# Piteco Motion System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Piteco motion language across the real product surfaces without changing product behavior, data flow, or study logic.

**Architecture:** Keep interaction motion in a shared CSS token/class layer and isolate the only pointer calculation in a small, pure helper used by a hook. `GameCardMotion` owns presentation-only pointer variables and forwards normal button behavior; `MotionButton` provides a reusable native-button surface; existing screens keep ownership of navigation, preferences, labels, data, and study handlers.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Vitest, CSS custom properties, `requestAnimationFrame`.

**Spec:** `docs/superpowers/specs/2026-09-11-piteco-motion-system-design.md`

## Global Constraints

- Preserve identity visual, routes, structure and current design system.
- Do not alter Supabase, Auth, RLS, sessions, autosave, scoring, progress, importers, glossary, SEO or navigation logic.
- No hover-only behavior; focus, keyboard, touch and press must remain usable.
- `prefers-reduced-motion` removes tilt/parallax and reduces movement while preserving essential feedback.
- Prefer `transform`, `opacity` and CSS variables; do not animate layout properties.
- Do not add a production animation dependency.
- Validate desktop, mobile, touch/coarse pointer and reduced-motion behavior before expanding beyond the Games Hub.

---

### Task 1: Establish the tested pointer calculation contract

**Files:**
- Create: `src/hooks/usePointerTilt.test.ts`
- Create: `src/hooks/usePointerTilt.ts`

**Interfaces:**
- Produces `calculatePointerTilt(rect: DOMRectLike, clientX: number, clientY: number, maxTilt?: number): { tiltX: number; tiltY: number; pointerX: number; pointerY: number }`.
- Produces `usePointerTilt<T extends HTMLElement>(options?: { maxTilt?: number; disabled?: boolean }): React.RefObject<T>`.

- [ ] **Step 1: Write the failing pure-helper tests**

```ts
import { describe, expect, it } from "vitest";
import { calculatePointerTilt } from "./usePointerTilt";

const rect = { left: 100, top: 50, width: 200, height: 100 };

describe("calculatePointerTilt", () => {
  it("maps the center to zero tilt and center highlight", () => {
    expect(calculatePointerTilt(rect, 200, 100)).toEqual({
      tiltX: 0,
      tiltY: 0,
      pointerX: 50,
      pointerY: 50,
    });
  });

  it("clamps pointer coordinates and respects the tilt limit", () => {
    expect(calculatePointerTilt(rect, 500, -100, 4)).toEqual({
      tiltX: 4,
      tiltY: 4,
      pointerX: 100,
      pointerY: 0,
    });
  });
});
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run: `npx vitest run src/hooks/usePointerTilt.test.ts`

Expected: FAIL because `src/hooks/usePointerTilt.ts` does not yet export `calculatePointerTilt`.

- [ ] **Step 3: Implement the smallest pure helper and hook**

```ts
export type DOMRectLike = Pick<DOMRect, "left" | "top" | "width" | "height">;

export function calculatePointerTilt(rect: DOMRectLike, clientX: number, clientY: number, maxTilt = 3) {
  const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
  return {
    tiltX: Number(((0.5 - y) * maxTilt).toFixed(3)),
    tiltY: Number(((x - 0.5) * maxTilt).toFixed(3)),
    pointerX: Number((x * 100).toFixed(2)),
    pointerY: Number((y * 100).toFixed(2)),
  };
}
```

The hook must bail out when `disabled`, when `(pointer: fine)` does not match,
or when `(prefers-reduced-motion: reduce)` matches. It may update only CSS
custom properties through one `requestAnimationFrame`, and it must remove
listeners and cancel a pending frame on unmount. Reset variables on
`pointerleave`.

- [ ] **Step 4: Run the focused tests and verify green**

Run: `npx vitest run src/hooks/usePointerTilt.test.ts`

Expected: 2 tests pass.

- [ ] **Step 5: Commit the tested helper**

```bash
git add src/hooks/usePointerTilt.ts src/hooks/usePointerTilt.test.ts
git commit -m "feat: add accessible pointer tilt helper"
```

### Task 2: Add the shared motion surface and CSS tokens

**Files:**
- Create: `src/components/ape/GameCardMotion.tsx`
- Create: `src/components/ape/GameCardMotion.test.ts`
- Modify: `src/index.css` in the shared component layer and reduced-motion/performance sections.

**Interfaces:**
- Consumes `usePointerTilt` from Task 1.
- Produces `GameCardMotion` as a `forwardRef` button component with the same button attributes and event behavior as a native button.

- [ ] **Step 1: Write the failing source contract tests**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/index.css", "utf8");
const component = readFileSync("src/components/ape/GameCardMotion.tsx", "utf8");

describe("GameCardMotion contract", () => {
  it("uses shared motion tokens and transform-only interaction", () => {
    expect(css).toContain("--ape-motion-fast");
    expect(css).toContain(".ape-game-card-motion");
    expect(css).toContain("transform:");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).not.toContain("transition: width");
    expect(css).not.toContain("transition: height");
  });

  it("keeps the surface keyboard and coarse-pointer safe", () => {
    expect(component).toContain("forwardRef");
    expect(component).toContain("usePointerTilt");
    expect(component).toContain('type="button"');
    expect(css).toContain("pointer: fine");
    expect(css).toContain("focus-visible");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails for the missing surface**

Run: `npx vitest run src/components/ape/GameCardMotion.test.ts`

Expected: FAIL because the component and `.ape-game-card-motion` contract do not exist.

- [ ] **Step 3: Add the shared tokens, surface and accessibility guards**

Add root tokens for 120/190/300 ms, easing, 3 px lift, 1.015 hover scale,
.985 press scale and 3 degree tilt. Add `.ape-game-card-motion` with:

- transform/opacity/border/shadow transitions only;
- pointer highlight through CSS variables;
- fine-pointer hover lift/glow and icon scale;
- pointer-down press state;
- visible focus ring;
- no effect when pointer is coarse or reduced motion is active;
- `[data-perf-no-anim]`, `[data-perf-no-hover]` and reduced-motion flattening.

`GameCardMotion` must render a native `<button type="button">`, merge the
provided class name, forward the ref, and pass all event/ARIA/data props
through without invoking navigation itself.

- [ ] **Step 4: Run the contract test and verify green**

Run: `npx vitest run src/components/ape/GameCardMotion.test.ts`

Expected: 2 tests pass.

- [ ] **Step 5: Commit the shared surface**

```bash
git add src/components/ape/GameCardMotion.tsx src/components/ape/GameCardMotion.test.ts src/index.css
git commit -m "feat: add shared Piteco motion card surface"
```

### Task 3: Apply the surface to the Games Hub without changing launch behavior

**Files:**
- Modify: `src/pages/GamesHub.tsx` at the game mode tile render.
- Modify: `src/pages/__tests__/gamesHubVisual.contract.test.ts`.

**Interfaces:**
- Consumes `GameCardMotion` from Task 2.
- Preserves `startGame(mode)`, `aria-label`, `aria-pressed`, recommended/configured data attributes and all existing visual token classes.

- [ ] **Step 1: Extend the existing Games Hub contract test**

Add assertions:

```ts
expect(hubSource).toContain("<GameCardMotion");
expect(hubSource).toContain("onClick={() => startGame(mode)}");
expect(hubSource).toContain('data-motion-surface="game-card"');
expect(hubSource).not.toContain("hover:-translate-y-0.5");
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run: `npx vitest run src/pages/__tests__/gamesHubVisual.contract.test.ts`

Expected: FAIL because GamesHub still renders a raw button and owns the old hover lift class.

- [ ] **Step 3: Replace only the tile element with `GameCardMotion`**

Import `GameCardMotion`, replace the opening/closing tile `<button>` with the
shared component, retain all existing props and children, remove only the old
Tailwind hover translate fragment, and add
`data-motion-surface="game-card"`. Do not change `startGame`, query keys,
preferences, route construction, or card content.

- [ ] **Step 4: Run Games Hub tests and verify green**

Run: `npx vitest run src/pages/__tests__/gamesHubVisual.contract.test.ts src/pages/__tests__/gamesHubLaunchIntent.contract.test.ts`

Expected: all focused tests pass.

- [ ] **Step 5: Commit the first Games Hub slice**

```bash
git add src/pages/GamesHub.tsx src/pages/__tests__/gamesHubVisual.contract.test.ts
git commit -m "feat: apply motion surface to Games Hub cards"
```

### Task 4: Run the release checks and visual QA for the first slice

**Files:**
- Modify: `docs/brain/areas/motion-system.md` with observed evidence.
- Modify: `docs/brain/07-TESTS.md` with fresh test results.
- Modify: `docs/brain/08-RISKS.md` with residual risks only.
- Modify: `docs/brain/12-PROCESS-LOG-2026-09-11.md` with the attempt and result.

- [ ] **Step 1: Run focused, type and full checks**

Run:

```bash
npx vitest run src/hooks/usePointerTilt.test.ts src/components/ape/GameCardMotion.test.ts src/pages/__tests__/gamesHubVisual.contract.test.ts src/pages/__tests__/gamesHubLaunchIntent.contract.test.ts
npm run typecheck
npm run lint
npm run brain:check
```

Expected: focused tests pass, typecheck exits 0, lint has 0 errors, and
`BRAIN_CHECK_PASS` remains true.

- [ ] **Step 2: Exercise the real preview**

Open Games Hub at 1280×720 and 1440×900 with a fine pointer; inspect hover,
pointer movement, press, focus and navigation. Repeat at 390×844 and 412×915
with touch/coarse emulation. Repeat once with reduced motion enabled.

Record screenshot paths, console output, overflow, layout shift, focus and
whether game launch intent is unchanged. Do not claim visual QA from source
inspection alone.

- [ ] **Step 3: Compare expected versus observed and update the brain**

Record whether the effect was subtle, whether mobile remained stable, and any
failed hypothesis. Promote no general lesson unless the evidence is reusable
outside this slice.

- [ ] **Step 4: Run the full applicable verification**

Run: `npm run test`, `npm run build`

Expected: no new failures; existing warnings are recorded without broadening
the scope.

- [x] **Step 5: Request review before further expansion**

Review the diff and evidence. Stop before adding Home, navigation, progress,
menus or game-specific signatures until the Games Hub slice is accepted.

> The original stop gate above was superseded by the user's explicit approval
> to implement the complete Motion System. Tasks 5–8 below are the approved
> continuation and must be executed with the same TDD and brain-update gates.

### Task 5: Expand shared motion roles to Home and content surfaces

Apply `.ape-interactive-card` to Home's clickable cards and resume surface;
apply `.ape-motion-row` to class shortcuts; apply the shared card role to
list, folder, and collection cards. Preserve handlers, route targets,
loading/data behavior, keyboard/touch affordances, and existing layout.

### Task 6: Expand navigation, overlays, and progress safely

Apply `.ape-motion-menu-item` to the tab bar and sidebar items, keeping active
state and route semantics intact. Add reduced-motion-safe utility classes to
Radix dialog/popover/tooltip primitives. Keep progress animation attached to
the real Radix value and animate only the indicator transform.

### Task 7: Add local study feedback and game-mode signatures

Use existing feedback status to select a short success pulse or error shake;
do not add fake state, timers, layout movement, or change answer flow. Give
each of the six real Games Hub visual keys a bounded icon response through
`data-motion-game`; do not invent modes absent from `gameOptions`.

### Task 8: Revalidate the complete surface matrix and close the brain record

Run focused contracts, full Vitest, typecheck, lint, build, and `brain:check`.
Reopen the local preview at the specified desktop/mobile/tablet sizes and
exercise hover, press, focus, keyboard, touch, reduced motion, overlays,
feedback, and progress. Record evidence and residual Lovable/auth limitations
in [[areas/motion-system]], [[07-TESTS]], [[08-RISKS]], and the process and
adaptive-learning notes before any completion claim.

## Execução registrada — 2026-09-11

- [x] Tasks 1–4: helper, superfície do Games Hub, testes e primeira QA.
- [x] Task 5: Home, cards/listas/coleções e atalhos de turma.
- [x] Task 6: navegação, overlays e progresso real.
- [x] Task 7: feedback de estudo e assinaturas dos seis modos reais.
- [x] Task 8: typecheck, 257/257 arquivos de teste, 1.574/1.574 testes,
  lint 0 erros, build, brain-check e QA local responsiva.

Residual de release: comparar no preview Lovable autenticado e publicar no
ambiente de destino quando essa aba estiver acessível; isso não foi inferido
a partir do preview local.
