import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type DeckTransitionDirection = "next" | "previous";
export type DeckTransitionPhase =
  | "idle"
  | "exit-next"
  | "exit-previous"
  | "enter-next"
  | "enter-previous";

const EXIT_MS = 230;
const ENTER_MS = 280;

export function useDeckNavigationTransition(cardKey: string) {
  const [phase, setPhase] = useState<DeckTransitionPhase>("idle");
  const [direction, setDirection] = useState<DeckTransitionDirection>("next");
  const previousCardKeyRef = useRef(cardKey);
  const directionRef = useRef<DeckTransitionDirection>("next");
  const lockedRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);
  const enterTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current);
    exitTimerRef.current = null;
    enterTimerRef.current = null;
  }, []);

  useLayoutEffect(() => {
    if (previousCardKeyRef.current === cardKey) return;

    previousCardKeyRef.current = cardKey;
    const activeDirection = directionRef.current;
    setDirection(activeDirection);
    setPhase(activeDirection === "next" ? "enter-next" : "enter-previous");

    enterTimerRef.current = window.setTimeout(() => {
      setPhase("idle");
      lockedRef.current = false;
    }, ENTER_MS);
  }, [cardKey]);

  useEffect(() => clearTimers, [clearTimers]);

  const run = useCallback(
    (nextDirection: DeckTransitionDirection, action?: () => void) => {
      if (!action || lockedRef.current) return;

      clearTimers();
      lockedRef.current = true;
      directionRef.current = nextDirection;
      setDirection(nextDirection);
      setPhase(nextDirection === "next" ? "exit-next" : "exit-previous");

      exitTimerRef.current = window.setTimeout(() => {
        action();

        // If the engine refuses navigation at a boundary, return the current
        // card to the front instead of leaving the deck mid-transition.
        enterTimerRef.current = window.setTimeout(() => {
          if (previousCardKeyRef.current === cardKey) {
            setPhase(nextDirection === "next" ? "enter-previous" : "enter-next");
            enterTimerRef.current = window.setTimeout(() => {
              setPhase("idle");
              lockedRef.current = false;
            }, ENTER_MS);
          }
        }, 56);
      }, EXIT_MS);
    },
    [cardKey, clearTimers],
  );

  const next = useCallback((action?: () => void) => run("next", action), [run]);
  const previous = useCallback((action?: () => void) => run("previous", action), [run]);

  return {
    phase,
    direction,
    isAnimating: phase !== "idle",
    next,
    previous,
  };
}
