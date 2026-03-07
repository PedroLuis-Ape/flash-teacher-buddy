

## Plan: Fix Black Screen (forwardRef crash) + PWA Cache Hardening

### Root Cause Analysis

The `forwardRef` crash in `ui-vendor-*.js` happens because Radix UI components call `React.forwardRef`, but `React` is in a separate `react-vendor` chunk. When the Service Worker serves stale/mismatched chunks (e.g., new `ui-vendor` with old `react-vendor`, or vice-versa), the import fails and React is `undefined` inside the UI chunk.

**Two contributing factors:**
1. **manualChunks race:** Radix UI imports React as a peer dep. Rollup's chunk splitting can create circular or order-dependent imports between `react-vendor` and `ui-vendor` that break under cache mismatch.
2. **PWA/Workbox precache:** Missing `cleanupOutdatedCaches`, `skipWaiting`, `clientsClaim` means old SW can serve a mix of old+new chunks after deploy.

### Changes (4 files)

**1. `vite.config.ts` — Stabilize bundling + harden PWA**
- Add `resolve.dedupe: ['react', 'react-dom']` to prevent React duplication.
- Simplify `manualChunks`: keep only `react-vendor` (react + react-dom + react-router). Remove `ui-vendor` and `data-vendor` — let Vite handle the rest automatically. This eliminates the cross-chunk import issue.
- Add Workbox options: `cleanupOutdatedCaches: true`, `skipWaiting: true`, `clientsClaim: true`.
- Add `navigateFallback: '/index.html'` for SPA navigation.
- Disable SW registration in development mode (`devOptions: { enabled: false }`).

**2. `index.html` — Boot fallback loader**
- Add a visible "Carregando..." loader inside `#root` that React will replace on mount.
- Add a `<noscript>` fallback.
- Add a timeout script (8s): if `#root` still shows the loader, display "Falha ao iniciar" message with a "Clear cache & reload" button (calls the same logic as SafeMode's `handleClearAndReload`).

**3. `src/lib/versionManager.ts` — Bump version**
- Bump `APP_VERSION` to `"1.1.0"` to force cache clear for all existing users on next load.

**4. `src/main.tsx` — Hide boot loader**
- After `createRoot().render()`, remove the boot loader element if still present (so it doesn't flash).

### Files NOT touched
- No changes to game logic, study engine, pages, hooks, or UI components.
- No changes to `SafeMode.tsx` (it handles post-mount errors, complementary to the boot fallback).

### Validation Checklist
- Hard reload (Ctrl+Shift+R): app loads, no forwardRef error.
- Incognito tab: app loads cleanly.
- After deploy: SW updates immediately (skipWaiting), no stale chunks.
- Network tab: no 404 on any chunk.
- Boot timeout: if JS fails entirely, user sees recovery message after 8s.

