import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { PublicClassRouteInterceptor } from '@/components/PublicClassRouteInterceptor';

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * CSS-only page transition with a narrow public-class access gate.
 * The previous route tree is still fully unmounted between paths.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-transition">
      <PublicClassRouteInterceptor>
        {children}
      </PublicClassRouteInterceptor>
    </div>
  );
}
