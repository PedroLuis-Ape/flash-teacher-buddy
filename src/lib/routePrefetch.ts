/**
 * Lightweight route chunk prefetcher.
 * Warms up lazy-loaded pages so navigation feels instant.
 * Safe: only triggers dynamic import(), no state or hook involvement.
 */

import { getPerfSettings } from "@/lib/performanceSettings";
import { isSafeModeEnabled } from "@/lib/safeMode";

const prefetched = new Set<string>();

function isWeakDevice(): boolean {
  try {
    const nav = navigator as any;
    const conn = nav.connection;
    if (conn?.saveData) return true;
    if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4) return true;
    if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) return true;
    const effective = conn?.effectiveType as string | undefined;
    if (effective && /(^|-)(2g|slow-2g)$/.test(effective)) return true;
  } catch { /* noop */ }
  return false;
}

const routeImportMap: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/pages/Index'),
  '/dashboard': () => import('@/pages/Index'),
  '/folders': () => import('@/pages/Folders'),
  '/goals': () => import('@/pages/Goals'),
  '/store': () => import('@/pages/Store'),
  '/profile': () => import('@/pages/Profile'),
  '/notes': () => import('@/pages/Notes'),
  '/search': () => import('@/pages/Search'),
  '/turmas': () => import('@/pages/Turmas'),
  '/trash': () => import('@/pages/Trash'),
  '/import/super': () => import('@/pages/SuperGlobalImport'),
  '/reportar-problema': () => import('@/pages/BugReport'),
};

/**
 * Prefetch a route's JS chunk in the background.
 * No-ops if disabled, already prefetched or route not in map.
 */
export function prefetchRoute(path: string) {
  if (!getPerfSettings().prefetching) return;
  if (isSafeModeEnabled()) return;
  if (isWeakDevice()) return;
  if (prefetched.has(path)) return;
  const loader = routeImportMap[path];
  if (!loader) return;
  prefetched.add(path);
  // Use requestIdleCallback if available, else setTimeout
  const schedule = typeof requestIdleCallback === 'function'
    ? requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 100);
  schedule(() => {
    loader().catch(() => {
      // silently ignore – chunk may not exist yet in dev
      prefetched.delete(path);
    });
  });
}

/**
 * Prefetch the most common destinations from the current page.
 *
 * @deprecated Phase 6 (Clara Master): batch prefetching pulled 5 chunks
 * unconditionally and competed with first paint. Prefer intent-based
 * prefetch via `prefetchRoute(path)` on hover/focus/touchstart, or use
 * the `<PrefetchLink>` wrapper. Kept as a no-op for backwards-compat —
 * remove call sites in follow-up phases.
 */
export function prefetchCommonRoutes() {
  // Intentional no-op. See deprecation note above.
}
