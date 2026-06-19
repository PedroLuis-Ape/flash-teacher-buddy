import { lazy, Suspense, type ComponentProps } from "react";
import { firstSide } from "@/lib/firstSide";

const LazyPronunciationStudyView = lazy(() =>
  import("./PronunciationStudyView.impl").then((module) => ({ default: module.PronunciationStudyView }))
);

type PronunciationStudyViewProps = ComponentProps<typeof LazyPronunciationStudyView>;

export const PronunciationStudyView = (props: PronunciationStudyViewProps) => {
  const params = new URLSearchParams(location.search);
  const direction = params.get("dir") || params.get("direction") || "b-a";
  const resolved = firstSide(direction) === "a" ? {
    ...props,
    front: props.back,
    back: props.front,
    langA: props.langB,
    langB: props.langA,
    labelA: props.labelB,
    labelB: props.labelA,
    mergedHintsA: props.mergedHintsB,
    mergedHintsB: props.mergedHintsA,
  } : props;
  return (
    <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Preparando pronúncia...</div>}>
      <LazyPronunciationStudyView {...resolved} />
    </Suspense>
  );
};
