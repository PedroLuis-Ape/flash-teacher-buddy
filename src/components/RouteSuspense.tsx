import { Suspense, useEffect, useState, type ReactNode } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

/**
 * RouteSuspense — Suspense boundary scoped to the route content area.
 * Fallback is delayed (~150 ms) so fast chunk loads do not flash a skeleton,
 * and so the app shell (header/tab bar/sidebar) never disappears.
 */

interface Props {
  children: ReactNode;
  /** ms before showing the fallback. Default 150. */
  delay?: number;
}

function DelayedFallback({ delay }: { delay: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(t);
  }, [delay]);
  if (!visible) return null;
  return (
    <div className="min-h-[30vh] flex items-center justify-center">
      <LoadingSpinner message="Carregando..." variant="skeleton" />
    </div>
  );
}

export function RouteSuspense({ children, delay = 150 }: Props) {
  return <Suspense fallback={<DelayedFallback delay={delay} />}>{children}</Suspense>;
}