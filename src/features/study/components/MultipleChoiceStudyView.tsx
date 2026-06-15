import { lazy, Suspense, type ComponentProps } from "react";

const LazyMultipleChoiceStudyView = lazy(() =>
  import("./MultipleChoiceStudyView.impl").then((module) => ({ default: module.MultipleChoiceStudyView }))
);

type MultipleChoiceStudyViewProps = ComponentProps<typeof LazyMultipleChoiceStudyView>;

export const MultipleChoiceStudyView = (props: MultipleChoiceStudyViewProps) => (
  <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Preparando múltipla escolha...</div>}>
    <LazyMultipleChoiceStudyView {...props} />
  </Suspense>
);
