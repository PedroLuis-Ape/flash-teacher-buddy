import { useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { isSafeModeEnabled } from "@/lib/safeMode";

const SWIPE_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 0.3;
const EDGE_ZONE_WIDTH = 30;

const mainRoutes = [
  "/",
  "/folders",
  "/goals",
  "/store",
  "/profile",
];

const SCROLL_CONTAINER_SELECTORS = [
  '.swiper',
  '[data-radix-scroll-area-viewport]',
  '.overflow-x-auto',
  '.overflow-x-scroll',
  '[data-no-swipe]',
];

// Rotas onde o swipe global NÃO deve competir com gestos internos
// (modos de estudo, jogos, cards, carrosséis de coleção, etc).
const SWIPE_BLOCKED_PREFIXES = [
  "/study",
  "/list/",
  "/collection/",
  "/portal/list/",
  "/portal/collection/",
  "/folder/",
  "/turmas/",
  "/reino/",
  "/notes/",
];

function isRouteBlocked(pathname: string): boolean {
  if (pathname.includes("/study")) return true;
  if (pathname.includes("/games")) return true;
  return SWIPE_BLOCKED_PREFIXES.some((p) => pathname.startsWith(p));
}

interface UseSwipeNavigationOptions {
  enabled?: boolean;
}

export function useSwipeNavigation({ enabled = true }: UseSwipeNavigationOptions = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchMoved = useRef(false);

  // Detect touch support once
  const hasTouchSupport = typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const getCurrentRouteIndex = useCallback(() => {
    const currentPath = location.pathname;
    const exactIndex = mainRoutes.indexOf(currentPath);
    if (exactIndex !== -1) return exactIndex;
    for (let i = 0; i < mainRoutes.length; i++) {
      if (currentPath.startsWith(mainRoutes[i]) && mainRoutes[i] !== "/") {
        return i;
      }
    }
    return -1;
  }, [location.pathname]);

  const isInsideScrollContainer = useCallback((element: EventTarget | null): boolean => {
    if (!element || !(element instanceof Element)) return false;
    for (const selector of SCROLL_CONTAINER_SELECTORS) {
      if (element.closest(selector)) return true;
    }
    return false;
  }, []);

  useEffect(() => {
    // Skip entirely if no touch support, disabled, safe mode, or blocked route
    if (!enabled || !hasTouchSupport) return;
    if (isSafeModeEnabled()) return;
    if (isRouteBlocked(location.pathname)) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (isInsideScrollContainer(e.target)) {
        touchStart.current = null;
        return;
      }

      const touch = e.touches[0];
      const screenWidth = window.innerWidth;
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

      if (Math.abs(deltaX) > SWIPE_THRESHOLD &&
          Math.abs(deltaY) < Math.abs(deltaX) * 0.5 &&
          velocity > SWIPE_VELOCITY_THRESHOLD) {

        const currentIndex = getCurrentRouteIndex();

        if (currentIndex === -1) {
          if (deltaX > 0) window.history.back();
        } else {
          if (deltaX > 0 && currentIndex > 0) {
            navigate(mainRoutes[currentIndex - 1]);
          } else if (deltaX < 0 && currentIndex < mainRoutes.length - 1) {
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
  }, [enabled, hasTouchSupport, navigate, getCurrentRouteIndex, isInsideScrollContainer, location.pathname]);

  return { currentRouteIndex: getCurrentRouteIndex() };
}
