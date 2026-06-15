import { lazy, Suspense, type ComponentProps } from "react";

const LazyFlipStudyView = lazy(() =>
  import("./FlipStudyView.impl").then((module) => ({ default: module.FlipStudyView }))
);

type FlipStudyViewProps = ComponentProps<typeof LazyFlipStudyView>;

function StudyModeFallback() {
  return (
    <div className="flex min-h-64 w-full items-center justify-center text-sm text-muted-foreground">
      Preparando modo Flip...
    </div>
  );
}

export const FlipStudyView = (props: FlipStudyViewProps) => (
  <Suspense fallback={<StudyModeFallback />}>
    <LazyFlipStudyView {...props} />
  </Suspense>
);
