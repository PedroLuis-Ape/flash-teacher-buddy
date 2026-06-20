import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type DeckTransitionDirection = "next" | "previous";
export type DeckTransitionPhase =
  | "idle"
  | "exit-next"
  | "exit-previous"
  | "enter-next"
  | "enter-previous";

const EXIT_MS = 210;
const ENTER_MS = 280;

export function useDeckNavigationTransition(cardKey: string) {
  const [phase, setPhase] = useState<DeckTransitionPhase>("idle");
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
    const direction = directionRef.current;
    setPhase(direction === "next" ? "enter-next" : "enter-previous");

    enterTimerRef.current = window.setTimeout(() => {
      setPhase("idle");
      lockedRef.current = false;
    }, ENTER_MS);
  }, [cardKey]);

  useEffect(() => clearTimers, [clearTimers]);

  const run = useCallback(
    (direction: DeckTransitionDirection, action?: () => void) => {
      if (!action || lockedRef.current) return;

      clearTimers();
      lockedRef.current = true;
      directionRef.current = direction;
      setPhase(direction === "next" ? "exit-next" : "exit-previous");

      exitTimerRef.current = window.setTimeout(() => {
        action();

        // When an action is blocked at a boundary, return the same card to place.
        enterTimerRef.current = window.setTimeout(() => {
          if (previousCardKeyRef.current === cardKey) {
            setPhase(direction === "next" ? "enter-previous" : "enter-next");
            enterTimerRef.current = window.setTimeout(() => {
              setPhase("idle");
              lockedRef.current = false;
            }, ENTER_MS);
          }
        }, 48);
      }, EXIT_MS);
    },
    [cardKey, clearTimers],
  );

  return {
    phase,
    isAnimating: phase !== "idle",
    next: (action?: () => void) => run("next", action),
    previous: (action?: () => void) => run("previous", action),
  };
}
