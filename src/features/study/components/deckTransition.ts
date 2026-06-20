import { useCallback, useEffect, useRef, useState } from "react";

export type DeckDirection = "next" | "previous";
export type DeckMotionPhase =
  | "idle"
  | "exit-next"
  | "exit-previous"
  | "enter-next"
  | "enter-previous";

const EXIT_DURATION_MS = 190;
const ENTER_DURATION_MS = 260;

export function useDeckTransition(cardKey: string) {
  const [phase, setPhase] = useState<DeckMotionPhase>("idle");
  const previousKeyRef = useRef(cardKey);
  const directionRef = useRef<DeckDirection>("next");
  const exitTimerRef = useRef<number | null>(null);
  const enterTimerRef = useRef<number | null>(null);
  const lockedRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current);
    exitTimerRef.current = null;
    enterTimerRef.current = null;
  }, []);

  useEffect(() => {
    if (previousKeyRef.current === cardKey) return;
    previousKeyRef.current = cardKey;

    const direction = directionRef.current;
    setPhase(direction === "next" ? "enter-next" : "enter-previous");
    enterTimerRef.current = window.setTimeout(() => {
      setPhase("idle");
      lockedRef.current = false;
    }, ENTER_DURATION_MS);
  }, [cardKey]);

  useEffect(() => clearTimers, [clearTimers]);

  const run = useCallback(
    (direction: DeckDirection, callback?: () => void) => {
      if (!callback || lockedRef.current) return;

      clearTimers();
      lockedRef.current = true;
      directionRef.current = direction;
      setPhase(direction === "next" ? "exit-next" : "exit-previous");

      exitTimerRef.current = window.setTimeout(() => {
        callback();

        // If the callback does not change cards (for example at a boundary),
        // restore the current card instead of leaving it off-screen.
        enterTimerRef.current = window.setTimeout(() => {
          if (previousKeyRef.current === cardKey) {
            setPhase(direction === "next" ? "enter-previous" : "enter-next");
            enterTimerRef.current = window.setTimeout(() => {
              setPhase("idle");
              lockedRef.current = false;
            }, ENTER_DURATION_MS);
          }
        }, 40);
      }, EXIT_DURATION_MS);
    },
    [cardKey, clearTimers],
  );

  const goNext = useCallback((callback?: () => void) => run("next", callback), [run]);
  const goPrevious = useCallback((callback?: () => void) => run("previous", callback), [run]);

  return {
    phase,
    goNext,
    goPrevious,
    isAnimating: phase !== "idle",
  };
}
