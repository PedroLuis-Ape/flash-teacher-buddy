import {
  useEffect,
  useRef,
  type MouseEvent,
  type ReactNode,
  type TouchEvent,
} from "react";
import { cn } from "@/lib/utils";
import type { DeckMotionPhase } from "./deckTransition";
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
  motionPhase?: DeckMotionPhase;
}

interface SwipeMetrics {
  dx: number;
  dy: number;
  elapsedMs: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

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
  motionPhase = "idle",
}: StudyCardDeckProps) {
  const startRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const consumedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

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
    }, 40);
  };

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!consumedRef.current) return;
    consumedRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      key={cardKey}
      className={cn(
        "study-card-deck",
        `study-card-deck--${density}`,
        `study-card-deck--${motionPhase}`,
        swipeNavigation && "study-card-deck--swipe",
        className,
      )}
      data-deck-phase={motionPhase}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClickCapture={handleClickCapture}
      style={{ touchAction: swipeNavigation ? "pan-y" : undefined }}
    >
      <span aria-hidden="true" className="study-card-deck__layer study-card-deck__layer--back" />
      <span aria-hidden="true" className="study-card-deck__layer study-card-deck__layer--middle" />
      <div className="study-card-deck__content">{children}</div>
    </div>
  );
}
