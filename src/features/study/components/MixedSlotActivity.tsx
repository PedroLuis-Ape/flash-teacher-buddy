import type { MergedHint } from "@/features/study/lib/glossaryMerge";
import { WriteStudyView } from "./WriteStudyView";
import { PronunciationStudyView } from "./PronunciationStudyView";

interface MixedSlotActivityProps {
  mode: "write" | "pronunciation";
  front: string;
  back: string;
  hint?: string | null;
  direction: string;
  flashcardId?: string;
  wordHintsA?: unknown;
  mergedHintsA?: MergedHint[];
  mergedHintsB?: MergedHint[];
  langA?: string;
  langB?: string;
  labelA?: string;
  labelB?: string;
  isFavorite?: boolean;
  isRedListed?: boolean;
  onToggleFavorite?: () => void;
  onToggleRedList?: () => void;
  isSpecial?: boolean;
  onToggleSpecial?: () => void;
  onCorrect: () => void;
  onIncorrect: () => void;
}

export function MixedSlotActivity(props: MixedSlotActivityProps) {
  if (props.mode === "pronunciation") {
    return (
      <PronunciationStudyView
        front={props.front}
        back={props.back}
        wordHintsA={props.wordHintsA}
        mergedHintsA={props.mergedHintsA}
        mergedHintsB={props.mergedHintsB}
        langA={props.langA}
        langB={props.langB}
        labelA={props.labelA}
        labelB={props.labelB}
        isFavorite={props.isFavorite}
        isRedListed={props.isRedListed}
        onToggleFavorite={props.onToggleFavorite}
        onToggleRedList={props.onToggleRedList}
        isSpecial={props.isSpecial}
        onToggleSpecial={props.onToggleSpecial}
        onNext={props.onCorrect}
      />
    );
  }

  return (
    <WriteStudyView
      front={props.front}
      back={props.back}
      hint={props.hint}
      flashcardId={props.flashcardId}
      wordHintsA={props.wordHintsA}
      mergedHintsA={props.mergedHintsA}
      mergedHintsB={props.mergedHintsB}
      direction={props.direction}
      langA={props.langA}
      langB={props.langB}
      isFavorite={props.isFavorite}
      isRedListed={props.isRedListed}
      onToggleFavorite={props.onToggleFavorite}
      onToggleRedList={props.onToggleRedList}
      isSpecial={props.isSpecial}
      onToggleSpecial={props.onToggleSpecial}
      onCorrect={props.onCorrect}
      onIncorrect={props.onIncorrect}
      onSkip={props.onIncorrect}
    />
  );
}
