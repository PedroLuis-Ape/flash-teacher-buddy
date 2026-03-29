import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Minimal safe page wrapper.
 * Previous versions stored children in state and delayed swaps for animation,
 * which caused React error #300 (hook-count mismatch between old and new pages).
 * Now renders children directly — stability over animation.
 */
export function PageTransition({ children }: PageTransitionProps) {
  return <>{children}</>;
}
