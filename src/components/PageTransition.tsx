import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Lightweight page transition - no blocking, instant content display.
 * Uses CSS animation for subtle fade-in only (respects reduced motion).
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();

  return (
    <div
      key={location.pathname}
      className={cn(
        "animate-fade-in motion-reduce:animate-none"
      )}
    >
      {children}
    </div>
  );
}
