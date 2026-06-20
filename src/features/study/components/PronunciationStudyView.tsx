import { lazy, Suspense, type ComponentProps } from "react";
import { StudyCardDeck } from "./StudyCardDeck";

const LazyPronunciationStudyView = lazy(() =>
  import("./PronunciationStudyView.impl").then((module) => ({ default: module.PronunciationStudyView }))
);

type PronunciationStudyViewProps = ComponentProps<typeof LazyPronunciationStudyView>;

function languagePrefix(value?: string): string {
  return (value || "").trim().toLowerCase().split("-")[0].split("_")[0];
}

export const PronunciationStudyView = (props: PronunciationStudyViewProps) => {
  const languageA = languagePrefix(props.langA);
  const languageB = languagePrefix(props.langB);

  // The implementation always treats side A as the visual hint and side B as
  // the phrase the student must pronounce. Normalize the physical card sides
  // from language metadata instead of relying on front/back or game direction.
  const shouldSwap = languageA === "en" && languageB === "pt";

  return (
    <StudyCardDeck cardKey={`${props.front}:${props.back}`} density="compact">
      <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Preparando pronúncia...</div>}>
        <LazyPronunciationStudyView
          {...props}
          front={shouldSwap ? props.back : props.front}
          back={shouldSwap ? props.front : props.back}
          langA={shouldSwap ? props.langB : props.langA}
          langB={shouldSwap ? props.langA : props.langB}
          labelA={shouldSwap ? props.labelB : props.labelA}
          labelB={shouldSwap ? props.labelA : props.labelB}
          mergedHintsA={shouldSwap ? props.mergedHintsB : props.mergedHintsA}
          mergedHintsB={shouldSwap ? props.mergedHintsA : props.mergedHintsB}
        />
      </Suspense>
    </StudyCardDeck>
  );
};
