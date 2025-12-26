import { useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const SWIPE_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 0.3;

// Main navigation routes for swipe navigation
const mainRoutes = [
  "/",
  "/folders",
  "/goals",
  "/store",
  "/profile",
];

interface UseSwipeNavigationOptions {
  enabled?: boolean;
}

export function useSwipeNavigation({ enabled = true }: UseSwipeNavigationOptions = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);

  const getCurrentRouteIndex = useCallback(() => {
    const currentPath = location.pathname;
    
    // Check for exact match first
    const exactIndex = mainRoutes.indexOf(currentPath);
    if (exactIndex !== -1) return exactIndex;
    
    // Check for prefix match (e.g., /folders/123)
    for (let i = 0; i < mainRoutes.length; i++) {
      if (currentPath.startsWith(mainRoutes[i]) && mainRoutes[i] !== "/") {
        return i;
      }
    }
    
    return -1;
  }, [location.pathname]);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStart.current.x;
      const deltaY = touch.clientY - touchStart.current.y;
      const deltaTime = Date.now() - touchStart.current.time;
      const velocity = Math.abs(deltaX) / deltaTime;

      // Check if horizontal swipe and not too much vertical movement
      if (Math.abs(deltaX) > SWIPE_THRESHOLD && 
          Math.abs(deltaY) < Math.abs(deltaX) * 0.5 &&
          velocity > SWIPE_VELOCITY_THRESHOLD) {
        
        const currentIndex = getCurrentRouteIndex();
        
        if (currentIndex === -1) {
          // Not on a main route, swipe right goes back
          if (deltaX > 0) {
            window.history.back();
          }
        } else {
          if (deltaX > 0 && currentIndex > 0) {
            // Swipe right - go to previous route
            navigate(mainRoutes[currentIndex - 1]);
          } else if (deltaX < 0 && currentIndex < mainRoutes.length - 1) {
            // Swipe left - go to next route
            navigate(mainRoutes[currentIndex + 1]);
          }
        }
      }

      touchStart.current = null;
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled, navigate, getCurrentRouteIndex]);

  return { currentRouteIndex: getCurrentRouteIndex() };
}
