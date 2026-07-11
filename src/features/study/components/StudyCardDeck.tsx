import {
  useCallback,
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
type DeckDirection = "next" | "previous";
export type FlightRenderMode = "disabled" | "lightweight" | "full";

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

interface FlightRenderMetrics {
  viewportWidth: number;
  coarsePointer: boolean;
  reducedMotion: boolean;
  animationsDisabled: boolean;
  surfaceArea?: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
}

const SURFACE_SELECTOR = [
  "[data-study-deck-surface]",
  ".flip-card",
  ".rounded-lg.border.bg-card",
].join(", ");

const LIGHTWEIGHT_FLIGHT_MAX_WIDTH = 1_024;
const FULL_FLIGHT_MAX_SURFACE_AREA = 420_000;
const LOW_END_CORE_COUNT = 4;
const LOW_END_MEMORY_GB = 4;

let pendingEnterDirection: DeckDirection | null = null;
let pendingEnterExpiresAt = 0;

function markPendingEnter(direction: DeckDirection) {
  pendingEnterDirection = direction;
  pendingEnterExpiresAt = Date.now() + 650;
}

function consumePendingEnter(): DeckDirection | null {
  if (!pendingEnterDirection || Date.now() > pendingEnterExpiresAt) {
    pendingEnterDirection = null;
    pendingEnterExpiresAt = 0;
    return null;
  }

  const direction = pendingEnterDirection;
  pendingEnterDirection = null;
  pendingEnterExpiresAt = 0;
  return direction;
}

export function resolveFlightRenderMode({
  viewportWidth,
  coarsePointer,
  reducedMotion,
  animationsDisabled,
  surfaceArea,
  hardwareConcurrency,
  deviceMemory,
}: FlightRenderMetrics): FlightRenderMode {
  if (reducedMotion || animationsDisabled) return "disabled";
  if (coarsePointer || viewportWidth <= LIGHTWEIGHT_FLIGHT_MAX_WIDTH) return "lightweight";
  if (surfaceArea !== undefined && surfaceArea > FULL_FLIGHT_MAX_SURFACE_AREA) return "lightweight";
  if (hardwareConcurrency !== undefined && hardwareConcurrency <= LOW_END_CORE_COUNT) return "lightweight";
  if (deviceMemory !== undefined && deviceMemory <= LOW_END_MEMORY_GB) return "lightweight";
  return "full";
}

function getFlightRenderMode(surface: HTMLElement): FlightRenderMode {
  const animationsDisabled =
    document.documentElement.hasAttribute("data-perf-no-anim") ||
    document.body?.hasAttribute("data-perf-no-anim") === true;
  const rect = surface.getBoundingClientRect();
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;

  return resolveFlightRenderMode({
    viewportWidth: window.innerWidth,
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    animationsDisabled,
    surfaceArea: rect.width * rect.height,
    hardwareConcurrency: navigator.hardwareConcurrency || undefined,
    deviceMemory: memory,
  });
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

function inferButtonDirection(target: EventTarget | null): DeckDirection | null {
  if (!(target instanceof Element)) return null;
  const button = target.closest("button, [role='button']");
  if (!button || button.hasAttribute("disabled")) return null;

  const description = [
    button.getAttribute("title"),
    button.getAttribute("aria-label"),
    button.textContent,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();

  if (/card anterior|previous card|voltar card/.test(description)) return "previous";
  if (/próximo card|proximo card|next card/.test(description)) return "next";
  return null;
}

function removeDuplicateIds(root: HTMLElement) {
  root.removeAttribute("id");
  root.querySelectorAll<HTMLElement>("[id]").forEach((node) => node.removeAttribute("id"));
  root.querySelectorAll<HTMLElement>("button, a, input, textarea, select, [tabindex]").forEach((node) => {
    node.setAttribute("tabindex", "-1");
    node.setAttribute("aria-hidden", "true");
  });
  root.querySelectorAll("video, audio, iframe, canvas").forEach((node) => node.remove());
}

function launchFlyingCard(
  surface: HTMLElement,
  direction: DeckDirection,
  mode: FlightRenderMode,
): HTMLElement | null {
  if (mode === "disabled") return null;

  const rect = surface.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const flight = document.createElement("div");
  flight.className = `study-card-flight study-card-flight--${direction} study-card-flight--${mode}`;
  flight.setAttribute("aria-hidden", "true");
  flight.style.top = `${rect.top}px`;
  flight.style.left = `${rect.left}px`;
  flight.style.width = `${rect.width}px`;
  flight.style.height = `${rect.height}px`;

  if (mode === "full") {
    flight.style.borderRadius = window.getComputedStyle(surface).borderRadius || "0.75rem";
    const clone = surface.cloneNode(true) as HTMLElement;
    clone.classList.remove("study-card-deck__surface");
    clone.style.width = "100%";
    clone.style.height = "100%";
    clone.style.margin = "0";
    clone.style.pointerEvents = "none";
    removeDuplicateIds(clone);
    flight.appendChild(clone);
  } else {
    flight.style.borderRadius = "0.75rem";
  }

  document.body.appendChild(flight);
  markPendingEnter(direction);
  window.requestAnimationFrame(() => flight.classList.add("study-card-flight--active"));
  return flight;
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
  const surfaceRef = useRef<HTMLElement | null>(null);
  const activeFlightRef = useRef<HTMLElement | null>(null);
  const startRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const consumedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const enterTimerRef = useRef<number | null>(null);
  const flightTimerRef = useRef<number | null>(null);

  const clearActiveFlight = useCallback(() => {
    if (flightTimerRef.current !== null) {
      window.clearTimeout(flightTimerRef.current);
      flightTimerRef.current = null;
    }
    activeFlightRef.current?.remove();
    activeFlightRef.current = null;
  }, []);

  const prepareTransition = useCallback((direction: DeckDirection) => {
    const surface = surfaceRef.current;
    if (!surface) return;

    clearActiveFlight();
    const flight = launchFlyingCard(surface, direction, getFlightRenderMode(surface));
    activeFlightRef.current = flight;
    if (flight) {
      flightTimerRef.current = window.setTimeout(() => {
        if (activeFlightRef.current === flight) clearActiveFlight();
        else flight.remove();
      }, 420);
    }
  }, [clearActiveFlight]);

  useLayoutEffect(() => {
    const deck = deckRef.current;
    const content = contentRef.current;
    if (!deck || !content) return;

    let surface: HTMLElement | null = null;
    let frame = 0;
    let retryFrame = 0;
    let enterApplied = false;

    const measure = () => {
      if (!surface || !surface.isConnected) {
        delete deck.dataset.deckSurfaceReady;
        return;
      }

      const deckRect = deck.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      if (surfaceRect.width <= 0 || surfaceRect.height <= 0) {
        delete deck.dataset.deckSurfaceReady;
        return;
      }

      deck.style.setProperty("--deck-surface-top", `${surfaceRect.top - deckRect.top}px`);
      deck.style.setProperty("--deck-surface-left", `${surfaceRect.left - deckRect.left}px`);
      deck.style.setProperty("--deck-surface-width", `${surfaceRect.width}px`);
      deck.style.setProperty("--deck-surface-height", `${surfaceRect.height}px`);
      deck.dataset.deckSurfaceReady = "true";

      if (!enterApplied) {
        enterApplied = true;
        const direction = consumePendingEnter();
        if (direction) {
          if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current);
          deck.dataset.deckEnter = direction;
          enterTimerRef.current = window.setTimeout(() => {
            delete deck.dataset.deckEnter;
            enterTimerRef.current = null;
          }, 340);
        }
      }
    };

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };

    const resizeObserver = new ResizeObserver(scheduleMeasure);

    const clearSurface = () => {
      if (surface) {
        resizeObserver.unobserve(surface);
        surface.classList.remove("study-card-deck__surface");
      }
      surface = null;
      surfaceRef.current = null;
      delete deck.dataset.deckSurfaceReady;
    };

    const connectSurface = () => {
      const nextSurface = content.querySelector<HTMLElement>(SURFACE_SELECTOR);
      if (!nextSurface) return false;
      if (nextSurface === surface) {
        scheduleMeasure();
        return true;
      }

      clearSurface();
      surface = nextSurface;
      surfaceRef.current = nextSurface;
      surface.classList.add("study-card-deck__surface");
      deck.style.setProperty(
        "--deck-surface-radius",
        window.getComputedStyle(nextSurface).borderRadius || "0.75rem",
      );
      resizeObserver.observe(surface);
      scheduleMeasure();
      return true;
    };

    resizeObserver.observe(deck);
    window.addEventListener("resize", scheduleMeasure);
    if (!connectSurface()) retryFrame = window.requestAnimationFrame(connectSurface);

    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(retryFrame);
      window.removeEventListener("resize", scheduleMeasure);
      resizeObserver.disconnect();
      surface?.classList.remove("study-card-deck__surface");
      surfaceRef.current = null;
      delete deck.dataset.deckSurfaceReady;
    };
  }, [cardKey]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isInteractiveTarget(event.target)) return;
      if (event.key === "ArrowLeft") prepareTransition("previous");
      if (event.key === "ArrowRight") prepareTransition("next");
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [prepareTransition]);

  useEffect(() => () => {
    clearActiveFlight();
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current);
  }, [clearActiveFlight]);

  const handleTouchStartCapture = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1 || isInteractiveTarget(event.target)) {
      startRef.current = null;
      return;
    }

    const touch = event.touches[0];
    startRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    consumedRef.current = false;
  };

  const handleTouchEndCapture = (event: TouchEvent<HTMLDivElement>) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    const action = resolveDeckSwipe({
      dx: touch.clientX - start.x,
      dy: touch.clientY - start.y,
      elapsedMs: Date.now() - start.time,
      canGoNext: swipeNavigation?.canGoNext !== false,
      canGoPrevious: swipeNavigation?.canGoPrevious !== false,
    });

    if (!action) return;
    prepareTransition(action);
    if (!swipeNavigation) return;

    consumedRef.current = true;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (action === "next") swipeNavigation.onNext?.();
      else swipeNavigation.onPrevious?.();
    }, 32);
  };

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const direction = inferButtonDirection(event.target);
    if (direction) prepareTransition(direction);

    if (!consumedRef.current) return;
    consumedRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      ref={deckRef}
      className={cn(
        "study-card-deck",
        `study-card-deck--${density}`,
        swipeNavigation && "study-card-deck--swipe",
        className,
      )}
      onTouchStartCapture={handleTouchStartCapture}
      onTouchEndCapture={handleTouchEndCapture}
      onClickCapture={handleClickCapture}
      style={{ touchAction: swipeNavigation ? "pan-y" : undefined }}
    >
      <span aria-hidden="true" className="study-card-deck__layer study-card-deck__layer--back" />
      <span aria-hidden="true" className="study-card-deck__layer study-card-deck__layer--middle" />
      <div ref={contentRef} className="study-card-deck__content">{children}</div>
    </div>
  );
}
