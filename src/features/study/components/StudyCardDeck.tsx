import {
  useEffect,
  useLayoutEffect,
  useRef,
  type MouseEvent,
  type ReactNode,
  type TouchEvent,
} from "react";
import { cn } from "@/lib/utils";
import "./studyCardDeck.css";

type SwipeAction = "next" | "previous" | null;

interface SwipeNavigation {
  onNext?: () => void;
  onPrevious?: () => void;
  canGoNext?: boolean;
  canGoPrevious?: boolean;
}

interface StudyCardDeckProps {
  children: ReactNode;
  cardKey: string;
  className?: string;
  density?: "compact" | "regular" | "tall";
  swipeNavigation?: SwipeNavigation;
}

interface SwipeMetrics {
  dx: number;
  dy: number;
  elapsedMs: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

const SURFACE_SELECTOR = [
  "[data-study-deck-surface]",
  ".flip-card",
  ".rounded-lg.border.bg-card",
].join(", ");

export function resolveDeckSwipe({
  dx,
  dy,
  elapsedMs,
  canGoNext,
  canGoPrevious,
}: SwipeMetrics): SwipeAction {
  const horizontalDistance = Math.abs(dx);
  const verticalDistance = Math.abs(dy);
  const velocity = horizontalDistance / Math.max(elapsedMs, 1);
  const committed =
    horizontalDistance >= 64 ||
    (horizontalDistance >= 38 && velocity >= 0.45);

  if (!committed || verticalDistance > Math.max(80, horizontalDistance * 0.85)) {
    return null;
  }

  if (dx < 0 && canGoNext) return "next";
  if (dx > 0 && canGoPrevious) return "previous";
  return null;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "button, a, input, textarea, select, [contenteditable='true'], [data-no-card-swipe='true']",
    ),
  );
}

export function StudyCardDeck({
  children,
  cardKey,
  className,
  density = "regular",
  swipeNavigation,
}: StudyCardDeckProps) {
  const deckRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const consumedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const deck = deckRef.current;
    const content = contentRef.current;
    if (!deck || !content) return;

    let surface: HTMLElement | null = null;
    let surfaceObserver: ResizeObserver | null = null;
    let frame = 0;

    const clearSurface = () => {
      surface?.classList.remove("study-card-deck__surface");
      surfaceObserver?.disconnect();
      surfaceObserver = null;
      surface = null;
      delete deck.dataset.deckSurfaceReady;
    };

    const measure = () => {
      if (!surface || !surface.isConnected) {
        clearSurface();
        return;
      }

      const deckRect = deck.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      if (surfaceRect.width <= 0 || surfaceRect.height <= 0) {
        delete deck.dataset.deckSurfaceReady;
        return;
      }

      const computed = window.getComputedStyle(surface);
      deck.style.setProperty("--deck-surface-top", `${surfaceRect.top - deckRect.top}px`);
      deck.style.setProperty("--deck-surface-left", `${surfaceRect.left - deckRect.left}px`);
      deck.style.setProperty("--deck-surface-width", `${surfaceRect.width}px`);
      deck.style.setProperty("--deck-surface-height", `${surfaceRect.height}px`);
      deck.style.setProperty("--deck-surface-radius", computed.borderRadius || "0.75rem");
      deck.dataset.deckSurfaceReady = "true";
    };

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };

    const connectSurface = () => {
      const nextSurface = content.querySelector<HTMLElement>(SURFACE_SELECTOR);
      if (nextSurface === surface) {
        scheduleMeasure();
        return;
      }

      clearSurface();
      if (!nextSurface) return;

      surface = nextSurface;
      surface.classList.add("study-card-deck__surface");
      surfaceObserver = new ResizeObserver(scheduleMeasure);
      surfaceObserver.observe(surface);
      scheduleMeasure();
    };

    const contentObserver = new MutationObserver(connectSurface);
    contentObserver.observe(content, { childList: true, subtree: true });

    const deckObserver = new ResizeObserver(scheduleMeasure);
    deckObserver.observe(deck);
    deckObserver.observe(content);

    window.addEventListener("resize", scheduleMeasure);
    connectSurface();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleMeasure);
      contentObserver.disconnect();
      deckObserver.disconnect();
      clearSurface();
    };
  }, [cardKey]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!swipeNavigation || event.touches.length !== 1 || isInteractiveTarget(event.target)) {
      startRef.current = null;
      return;
    }

    const touch = event.touches[0];
    startRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    consumedRef.current = false;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start || !swipeNavigation) return;

    const touch = event.changedTouches[0];
    const action = resolveDeckSwipe({
      dx: touch.clientX - start.x,
      dy: touch.clientY - start.y,
      elapsedMs: Date.now() - start.time,
      canGoNext: swipeNavigation.canGoNext !== false,
      canGoPrevious: swipeNavigation.canGoPrevious !== false,
    });

    if (!action) return;

    consumedRef.current = true;
    timerRef.current = window.setTimeout(() => {
      if (action === "next") swipeNavigation.onNext?.();
      else swipeNavigation.onPrevious?.();
    }, 90);
  };

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!consumedRef.current) return;
    consumedRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      ref={deckRef}
      key={cardKey}
      className={cn(
        "study-card-deck",
        `study-card-deck--${density}`,
        swipeNavigation && "study-card-deck--swipe",
        className,
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClickCapture={handleClickCapture}
      style={{ touchAction: swipeNavigation ? "pan-y" : undefined }}
    >
      <span aria-hidden="true" className="study-card-deck__layer study-card-deck__layer--back" />
      <span aria-hidden="true" className="study-card-deck__layer study-card-deck__layer--middle" />
      <div ref={contentRef} className="study-card-deck__content">{children}</div>
    </div>
  );
}
