

## Plan: Make "Light" Mode Actually Kill All Animations & Effects

### Problem
The performance settings exist but only 4 components read them. The vast majority of animations, transitions, hovers, and effects are hardcoded in CSS classes (`card-3d`, `scroll-reveal`, `transition-all`, `group-hover:*`, `active:scale-*`) that ignore the settings entirely.

### Solution: Global CSS Override + Data Attribute

Instead of editing every single component (fragile, easy to miss), add a **`data-perf-light` attribute on `<html>`** that CSS uses to globally kill animations, transitions, hover effects, and transforms. This is the most robust approach — it catches everything, including third-party components and classes we might miss.

### Changes

**1. `src/contexts/PerformanceContext.tsx`** — Sync `data-perf` attribute to `<html>`
- Add a `useEffect` that sets `document.documentElement.dataset.perf = settings.animations ? '' : 'light'` (and similar for hover/decorative).
- Specifically: when `animations === false`, set `data-perf-no-anim`; when `hoverEffects === false`, set `data-perf-no-hover`; when `decorativeEffects === false`, set `data-perf-no-decor`.

**2. `src/index.css`** — Add global CSS overrides at the bottom
```css
/* Performance: kill ALL transitions/animations when disabled */
[data-perf-no-anim] *,
[data-perf-no-anim] *::before,
[data-perf-no-anim] *::after {
  animation-duration: 0s !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
}

[data-perf-no-anim] .scroll-reveal {
  opacity: 1 !important;
  transform: none !important;
}

[data-perf-no-anim] .card-3d:hover {
  transform: none !important;
  box-shadow: var(--shadow-card) !important;
}

/* Performance: kill hover effects when disabled */
[data-perf-no-hover] .card-3d:hover {
  transform: none !important;
  box-shadow: inherit !important;
}

[data-perf-no-hover] .group:hover .group-hover\:scale-105,
[data-perf-no-hover] .group:hover .group-hover\:scale-110,
[data-perf-no-hover] .group:hover .group-hover\:bg-primary\/20,
[data-perf-no-hover] .group:hover .group-hover\:bg-secondary\/30 {
  transform: none !important;
  background-color: inherit !important;
}
```

**3. `src/hooks/useScrollReveal.ts`** — Read `getPerfSettings()` and skip observer when animations disabled
- Import `getPerfSettings` and check `animations === false` → immediately set `disabled = true`, skip IntersectionObserver creation.

**4. `src/components/ui/scrolling-title.tsx`** — Respect `reduceMotion` from perf settings
- Import `getPerfSettings` and treat `reduceMotion === true` same as `prefers-reduced-motion`.

### Why This Approach
- **One CSS block catches everything** — no need to edit 15+ card components individually.
- **Zero risk of breaking layouts** — we only kill motion/transform, not positioning or display.
- **Truly zero cost** — `transition-duration: 0s` means the browser skips animation computation entirely.
- **Incremental** — no existing code deleted or rewritten.

### Files Changed
1. `src/contexts/PerformanceContext.tsx` — add `useEffect` to sync data attributes
2. `src/index.css` — add ~30 lines of perf override CSS
3. `src/hooks/useScrollReveal.ts` — check perf settings to skip observer
4. `src/components/ui/scrolling-title.tsx` — respect perf reduceMotion setting

