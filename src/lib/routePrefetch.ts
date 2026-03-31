/**
 * Lightweight route chunk prefetcher.
 * Warms up lazy-loaded pages so navigation feels instant.
 * Safe: only triggers dynamic import(), no state or hook involvement.
 */

const prefetched = new Set<string>();

const routeImportMap: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/pages/Index'),
  '/folders': () => import('@/pages/Folders'),
  '/goals': () => import('@/pages/Goals'),
  '/store': () => import('@/pages/Store'),
  '/profile': () => import('@/pages/Profile'),
  '/notes': () => import('@/pages/Notes'),
  '/search': () => import('@/pages/Search'),
  '/turmas': () => import('@/pages/Turmas'),
  '/trash': () => import('@/pages/Trash'),
};

/**
 * Prefetch a route's JS chunk in the background.
 * No-ops if already prefetched or route not in map.
 */
export function prefetchRoute(path: string) {
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
 */
export function prefetchCommonRoutes() {
  const common = ['/', '/folders', '/goals', '/store', '/profile'];
  common.forEach(prefetchRoute);
}
