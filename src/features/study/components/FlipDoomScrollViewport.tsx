import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type TouchEvent,
} from "react";
import { cn } from "@/lib/utils";

export type FlipDoomScrollAction = "next" | "previous" | null;

interface ResolveFlipDoomGestureInput {
  dy: number;
  elapsedMs: number;
  viewportHeight: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

export function resolveFlipDoomGesture({
  dy,
  elapsedMs,
  viewportHeight,
  canGoNext,
  canGoPrevious,
}: ResolveFlipDoomGestureInput): FlipDoomScrollAction {
  const distance = Math.abs(dy);
  const velocity = distance / Math.max(1, elapsedMs);
  const distanceThreshold = Math.min(120, Math.max(54, viewportHeight * 0.18));
  const committed = distance >= distanceThreshold || (distance >= 30 && velocity >= 0.5);

  if (!committed) return null;
  if (dy < 0 && canGoNext) return "next";
  if (dy > 0 && canGoPrevious) return "previous";
  return null;
}

interface FlipDoomScrollViewportProps {
  enabled: boolean;
  cardKey: string;
  current: ReactNode;
  previous?: ReactNode;
  next?: ReactNode;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  className?: string;
}

type DragAxis = "vertical" | "horizontal" | null;

const SETTLE_MS = 210;
const AXIS_LOCK_PX = 7;

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("button, a, input, textarea, select, [role='button'], [contenteditable='true'], [data-no-doom-scroll='true']")) {
    return true;
  }

  const scrollViewport = target.closest<HTMLElement>("[data-radix-scroll-area-viewport]");
  return Boolean(scrollViewport && scrollViewport.scrollHeight > scrollViewport.clientHeight + 2);
}

export function FlipDoomScrollViewport({
  enabled,
  cardKey,
  current,
  previous,
  next,
  canGoPrevious = true,
  canGoNext = true,
  onPrevious,
  onNext,
  className,
}: FlipDoomScrollViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number; at: number } | null>(null);
  const axisRef = useRef<DragAxis>(null);
  const consumedClickRef = useRef(false);
  const settleTimerRef = useRef<number | null>(null);
  const [offsetY, setOffsetY] = useState(0);
  const [settling, setSettling] = useState(false);

  const clearSettleTimer = () => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  };

  const resetPosition = () => {
    clearSettleTimer();
    setSettling(false);
    setOffsetY(0);
    startRef.current = null;
    axisRef.current = null;
  };

  useEffect(() => {
    resetPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey, enabled]);

  useEffect(() => () => clearSettleTimer(), []);

  const settleBack = () => {
    setSettling(true);
    setOffsetY(0);
    clearSettleTimer();
    settleTimerRef.current = window.setTimeout(() => {
      setSettling(false);
      settleTimerRef.current = null;
    }, SETTLE_MS);
  };

  const finishNavigation = (action: Exclude<FlipDoomScrollAction, null>, viewportHeight: number) => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion ? 0 : SETTLE_MS;
    setSettling(true);
    setOffsetY(action === "next" ? -viewportHeight : viewportHeight);
    clearSettleTimer();
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      if (action === "next") onNext?.();
      else onPrevious?.();
      // If the parent cannot advance for any reason, recover locally. A normal
      // navigation changes cardKey and the effect above performs this reset.
      window.requestAnimationFrame(() => {
        setSettling(false);
        setOffsetY(0);
      });
    }, duration);
  };

  const handleTouchStartCapture = (event: TouchEvent<HTMLDivElement>) => {
    if (!enabled || event.touches.length !== 1 || isInteractiveTarget(event.target)) {
      startRef.current = null;
      axisRef.current = null;
      return;
    }
    const touch = event.touches[0];
    startRef.current = { x: touch.clientX, y: touch.clientY, at: Date.now() };
    axisRef.current = null;
    consumedClickRef.current = false;
    clearSettleTimer();
    setSettling(false);
  };

  const handleTouchMoveCapture = (event: TouchEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!enabled || !start || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (axisRef.current === null && Math.max(absX, absY) >= AXIS_LOCK_PX) {
      axisRef.current = absY > absX * 1.05 ? "vertical" : "horizontal";
    }
    if (axisRef.current !== "vertical") return;

    event.preventDefault();
    consumedClickRef.current = true;
    const height = Math.max(1, viewportRef.current?.getBoundingClientRect().height ?? 1);
    const movingToNext = dy < 0;
    const allowed = movingToNext ? canGoNext : canGoPrevious;
    const resisted = allowed ? dy : dy * 0.22;
    setOffsetY(Math.max(-height, Math.min(height, resisted)));
  };

  const handleTouchEndCapture = (event: TouchEvent<HTMLDivElement>) => {
    const start = startRef.current;
    const axis = axisRef.current;
    startRef.current = null;
    axisRef.current = null;
    if (!enabled || !start || axis !== "vertical") return;

    const touch = event.changedTouches[0];
    const dy = touch.clientY - start.y;
    const height = Math.max(1, viewportRef.current?.getBoundingClientRect().height ?? 1);
    const action = resolveFlipDoomGesture({
      dy,
      elapsedMs: Date.now() - start.at,
      viewportHeight: height,
      canGoNext,
      canGoPrevious,
    });

    if (!action) {
      settleBack();
      return;
    }
    event.preventDefault();
    finishNavigation(action, height);
  };

  const handleTouchCancelCapture = () => {
    startRef.current = null;
    axisRef.current = null;
    if (enabled) settleBack();
  };

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!consumedClickRef.current) return;
    consumedClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  if (!enabled) return <>{current}</>;

  const transition = settling ? `transform ${SETTLE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)` : "none";
  const movingStyle = {
    transform: `translate3d(0, ${offsetY}px, 0)`,
    transition,
  } as const;

  return (
    <div
      ref={viewportRef}
      className={cn("relative w-full overflow-hidden overscroll-contain", className)}
      onTouchStartCapture={handleTouchStartCapture}
      onTouchMoveCapture={handleTouchMoveCapture}
      onTouchEndCapture={handleTouchEndCapture}
      onTouchCancelCapture={handleTouchCancelCapture}
      onClickCapture={handleClickCapture}
      style={{ touchAction: "pan-x" }}
      data-flip-doom-scroll="true"
    >
      {canGoPrevious && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{ transform: `translate3d(0, calc(-100% + ${offsetY}px), 0)`, transition }}
        >
          {previous}
        </div>
      )}

      <div className="relative z-10 will-change-transform" style={movingStyle}>
        {current}
      </div>

      {canGoNext && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{ transform: `translate3d(0, calc(100% + ${offsetY}px), 0)`, transition }}
        >
          {next}
        </div>
      )}
    </div>
  );
}
