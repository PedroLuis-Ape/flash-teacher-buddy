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
 */
export function PageTransition({ children }: PageTransitionProps) {
  const { settings } = usePerformance();

  // Skip all animation logic when disabled
  if (!settings.animations) {
    return <>{children}</>;
  }

  return <AnimatedTransition>{children}</AnimatedTransition>;
}

function AnimatedTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayChildren, setDisplayChildren] = useState(children);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip animation on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplayChildren(children);
      return;
    }

    // Trigger exit animation
    setIsAnimating(true);

    // After exit animation, update content and trigger enter animation
    const timer = setTimeout(() => {
      setDisplayChildren(children);
      // Small delay to ensure DOM update before enter animation
      requestAnimationFrame(() => {
        setIsAnimating(false);
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Update children immediately if they change without route change
  useEffect(() => {
    if (!isAnimating) {
      setDisplayChildren(children);
    }
  }, [children, isAnimating]);

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
