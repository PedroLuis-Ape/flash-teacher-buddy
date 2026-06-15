import { lazy, Suspense, type ComponentProps } from "react";

const LazyStudyCompletionModal = lazy(() =>
  import("./StudyCompletionModal.impl").then((m) => ({ default: m.StudyCompletionModal }))
);

type Props = ComponentProps<typeof LazyStudyCompletionModal>;

export const StudyCompletionModal = (props: Props) => (
  <Suspense fallback={null}>
    <LazyStudyCompletionModal {...props} />
  </Suspense>
);
