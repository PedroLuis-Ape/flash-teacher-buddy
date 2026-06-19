import { lazy, Suspense, type ComponentProps } from "react";

const LazyPronunciationStudyView = lazy(() =>
  import("./PronunciationStudyView.impl").then((module) => ({ default: module.PronunciationStudyView }))
);

type PronunciationStudyViewProps = ComponentProps<typeof LazyPronunciationStudyView>;

export const PronunciationStudyView = (props: PronunciationStudyViewProps) => {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("dir") || params.get("direction") || "b-a";
  const hash = `${props.front}:${props.back}`.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const direction = requested === "any" ? (hash % 2 === 0 ? "a-b" : "b-a") : requested;
  const speakA = direction === "a-b";

  return (
    <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Preparando pronúncia...</div>}>
      <LazyPronunciationStudyView
        {...props}
        front={speakA ? props.back : props.front}
        back={speakA ? props.front : props.back}
        langA={speakA ? props.langB : props.langA}
        langB={speakA ? props.langA : props.langB}
        labelA={speakA ? props.labelB : props.labelA}
        labelB={speakA ? props.labelA : props.labelB}
        mergedHintsA={speakA ? props.mergedHintsB : props.mergedHintsA}
        mergedHintsB={speakA ? props.mergedHintsA : props.mergedHintsB}
      />
    </Suspense>
  );
};
