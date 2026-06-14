import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * CSS-only page transition.
 *
 * - Keyed by `location.pathname` so React fully unmounts the previous tree
 *   (no retention in state — avoids React #300 / hook-count mismatch).
 * - Pure CSS animation (no JS timer, no setState during transition).
 * - Disabled automatically by the global kill-switch `[data-perf-no-anim]`
 *   set by PerformanceContext, and by `prefers-reduced-motion`.
 * - Applied only to the route content; the GlobalLayout shell stays still.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-transition">
      {children}
    </div>
  );
}
