import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Lightweight page wrapper - NO key-based remount.
 * Just applies subtle animation class without forcing DOM teardown.
 */
export function PageTransition({ children }: PageTransitionProps) {
  return (
    <div className={cn("animate-fade-in motion-reduce:animate-none")}>
      {children}
    </div>
  );
}
