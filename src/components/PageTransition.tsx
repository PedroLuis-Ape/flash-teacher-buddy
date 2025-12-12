import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const [displayedChildren, setDisplayedChildren] = useState(children);

  useEffect(() => {
    // Start fade out
    setIsVisible(false);
    
    // After fade out, update content and fade in
    const timer = setTimeout(() => {
      setDisplayedChildren(children);
      setIsVisible(true);
    }, 150);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Initial mount - fade in immediately
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={cn(
        "transition-opacity duration-200 ease-in-out",
        isVisible ? "opacity-100" : "opacity-0"
      )}
    >
      {displayedChildren}
    </div>
  );
}
