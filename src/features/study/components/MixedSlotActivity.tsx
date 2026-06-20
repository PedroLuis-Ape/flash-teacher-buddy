import { WriteStudyView } from "./WriteStudyView";
import { PronunciationStudyView } from "./PronunciationStudyView";

interface MixedSlotActivityProps {
  mode: "write" | "pronunciation";
  front: string;
  back: string;
  direction: string;
  flashcardId?: string;
  langA?: string;
  langB?: string;
  labelA?: string;
  labelB?: string;
  onCorrect: () => void;
  onIncorrect: () => void;
}

export function MixedSlotActivity(props: MixedSlotActivityProps) {
  if (props.mode === "pronunciation") {
    return (
      <PronunciationStudyView
        front={props.front}
        back={props.back}
        langA={props.langA}
        langB={props.langB}
        labelA={props.labelA}
        labelB={props.labelB}
        onNext={props.onCorrect}
      />
    );
  }

  return (
    <WriteStudyView
      front={props.front}
      back={props.back}
      flashcardId={props.flashcardId}
      direction={props.direction}
      langA={props.langA}
      langB={props.langB}
      onCorrect={props.onCorrect}
      onIncorrect={props.onIncorrect}
      onSkip={props.onIncorrect}
    />
  );
}
