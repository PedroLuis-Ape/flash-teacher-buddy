import { ReactNode, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import "@/styles/navigation-performance.css";

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Route-content transition.
 *
 * The shell remains mounted while the route tree changes. During the first
 * paint frames we expose a short-lived document flag so expensive decorative
 * backgrounds can pause composition without being removed or downgraded.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-route-transitioning", "true");

    let firstFrame = 0;
    let secondFrame = 0;
    let releaseTimer = 0;

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        releaseTimer = window.setTimeout(() => {
          root.removeAttribute("data-route-transitioning");
        }, 140);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(releaseTimer);
      root.removeAttribute("data-route-transitioning");
    };
  }, [location.pathname]);

  return (
    <div key={location.pathname} className="page-transition">
      {children}
    </div>
  );
}
