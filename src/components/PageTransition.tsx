import { ReactNode, useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { usePerformance } from '@/contexts/PerformanceContext';

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Enhanced page wrapper with smooth fade + scale transitions.
 * Respects performance settings — skips animation when disabled.
 * All hooks are called unconditionally to avoid React hook-count mismatch.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const { settings } = usePerformance();
  const location = useLocation();
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayChildren, setDisplayChildren] = useState(children);
  const isFirstRender = useRef(true);
  const animationsEnabled = settings.animations;

  useEffect(() => {
    if (!animationsEnabled) {
      // When animations disabled, update children immediately
      setDisplayChildren(children);
      setIsAnimating(false);
      return;
    }

    // Skip animation on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplayChildren(children);
      return;
    }

    // Trigger exit animation
    setIsAnimating(true);

    const timer = setTimeout(() => {
      setDisplayChildren(children);
      requestAnimationFrame(() => {
        setIsAnimating(false);
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [location.pathname, animationsEnabled]);

  // Update children immediately if they change without route change
  useEffect(() => {
    if (!isAnimating) {
      setDisplayChildren(children);
    }
  }, [children, isAnimating]);

  // No animation wrapper when disabled
  if (!animationsEnabled) {
    return <>{displayChildren}</>;
  }

  return (
    <div
      className={cn(
        "transition-all duration-200 ease-out motion-reduce:transition-none",
        isAnimating
          ? "opacity-0 translate-y-1 scale-[0.995]"
          : "opacity-100 translate-y-0 scale-100"
      )}
    >
      {displayChildren}
    </div>
  );
}
