import type { ComponentProps } from "react";
import { FlipStudyView as BaseFlipStudyView } from "./FlipStudyView.impl";
import { useAnimatedDeckNavigation } from "./useAnimatedDeckNavigation";

type FlipProps = ComponentProps<typeof BaseFlipStudyView>;

export function FlipStudyView(props: FlipProps) {
  const cardKey = props.flashcardId || `${props.front}:${props.back}`;
  const navigation = useAnimatedDeckNavigation(cardKey, props.onNext, props.onPrevious);

  return (
    <div
      className={`study-deck-motion study-deck-motion--${navigation.phase}`}
      data-motion-phase={navigation.phase}
    >
      <BaseFlipStudyView
        {...props}
        onNext={navigation.next}
        onPrevious={navigation.previous}
      />
    </div>
  );
}
