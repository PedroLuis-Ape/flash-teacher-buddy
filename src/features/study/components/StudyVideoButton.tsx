import { lazy, Suspense, type ComponentProps } from "react";

const LazyStudyVideoButton = lazy(() =>
  import("./StudyVideoButton.impl").then((module) => ({ default: module.StudyVideoButton }))
);

type StudyVideoButtonProps = ComponentProps<typeof LazyStudyVideoButton>;

export const StudyVideoButton = (props: StudyVideoButtonProps) => (
  <Suspense fallback={null}>
    <LazyStudyVideoButton {...props} />
  </Suspense>
);
