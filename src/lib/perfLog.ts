/**
 * Lightweight DEV-only performance / lifecycle logger.
 *
 * Goals:
 *  - Zero overhead in production (early-return on import.meta.env.DEV).
 *  - Help locate where the app freezes without changing app logic.
 *
 * Use sparingly: only at meaningful boundaries (page mount/ready,
 * heavy hook init, heavy backend calls, swap/inversion operations).
 */

const isDev = (() => {
  try {
    return Boolean((import.meta as any)?.env?.DEV);
  } catch {
    return false;
  }
})();

/**
 * Log how long a labeled operation took.
 * `start` is the value returned by `performance.now()` before the work.
 * Threshold: anything over 300ms is logged as a warning.
 */
export function perfLog(label: string, start: number, extra?: unknown): void {
  if (!isDev) return;
  const ms = Math.round(performance.now() - start);
  if (ms > 300) {
    // eslint-disable-next-line no-console
    console.warn(`[PerfSlow] ${label}: ${ms}ms`, extra ?? "");
  } else {
    // eslint-disable-next-line no-console
    console.debug(`[Perf] ${label}: ${ms}ms`, extra ?? "");
  }
}

/** Mark that a page/component has mounted (DEV-only). */
export function pageMount(name: string, extra?: unknown): void {
  if (!isDev) return;
  // eslint-disable-next-line no-console
  console.debug("[PageMount]", name, extra ?? "");
}

/** Mark that a page/component finished its first meaningful load (DEV-only). */
export function pageReady(name: string, extra?: unknown): void {
  if (!isDev) return;
  // eslint-disable-next-line no-console
  console.debug("[PageReady]", name, extra ?? "");
}
