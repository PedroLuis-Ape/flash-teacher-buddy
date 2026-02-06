import { useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const SWIPE_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 0.3;
const EDGE_ZONE_WIDTH = 30; // Only accept swipes starting within 30px from edges

// Main navigation routes for swipe navigation
const mainRoutes = [
  "/",
  "/folders",
  "/goals",
  "/store",
  "/profile",
];

// Elements/selectors that should prevent swipe navigation
const SCROLL_CONTAINER_SELECTORS = [
  '.swiper',
  '[data-radix-scroll-area-viewport]',
  '.overflow-x-auto',
  '.overflow-x-scroll',
  '[data-no-swipe]',
];

interface UseSwipeNavigationOptions {
  enabled?: boolean;
}

export function useSwipeNavigation({ enabled = true }: UseSwipeNavigationOptions = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchMoved = useRef(false);

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

  const isInsideScrollContainer = useCallback((element: EventTarget | null): boolean => {
    if (!element || !(element instanceof Element)) return false;
    
    // Check if element or any parent matches scroll container selectors
    for (const selector of SCROLL_CONTAINER_SELECTORS) {
      if (element.closest(selector)) {
        return true;
      }
    }
    
    return false;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Ignore if touch started inside a horizontal scroll container
      if (isInsideScrollContainer(e.target)) {
        touchStart.current = null;
        return;
      }

      const touch = e.touches[0];
      const screenWidth = window.innerWidth;
      
      // Only register swipes that start near edges (for edge swipe gesture)
      const isNearLeftEdge = touch.clientX < EDGE_ZONE_WIDTH;
      const isNearRightEdge = touch.clientX > screenWidth - EDGE_ZONE_WIDTH;
      
      if (!isNearLeftEdge && !isNearRightEdge) {
        touchStart.current = null;
        return;
      }

      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      touchMoved.current = false;
    };

    const handleTouchMove = () => {
      touchMoved.current = true;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current || !touchMoved.current) {
        touchStart.current = null;
        return;
      }

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
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled, navigate, getCurrentRouteIndex, isInsideScrollContainer]);

  return { currentRouteIndex: getCurrentRouteIndex() };
}
