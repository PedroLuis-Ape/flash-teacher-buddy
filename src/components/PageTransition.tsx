import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Enhanced page wrapper with smooth slide transitions.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayChildren, setDisplayChildren] = useState(children);

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => {
      setDisplayChildren(children);
      setIsAnimating(false);
    }, 150);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Always show current children immediately for better UX
  useEffect(() => {
    setDisplayChildren(children);
  }, [children]);

  return (
    <div 
      className={cn(
        "transition-all duration-300 ease-out motion-reduce:transition-none",
        isAnimating 
          ? "opacity-0 translate-y-2 scale-[0.99]" 
          : "opacity-100 translate-y-0 scale-100"
      )}
    >
      {displayChildren}
    </div>
  );
}
