import { useCallback } from "react";
import { useDeckTransition } from "./deckTransition";

export function useAnimatedDeckNavigation(
  cardKey: string,
  onNext?: () => void,
  onPrevious?: () => void,
) {
  const transition = useDeckTransition(cardKey);

  const next = useCallback(() => {
    transition.goNext(onNext);
  }, [onNext, transition]);

  const previous = useCallback(() => {
    transition.goPrevious(onPrevious);
  }, [onPrevious, transition]);

  return {
    phase: transition.phase,
    next,
    previous,
    isAnimating: transition.isAnimating,
  };
}
