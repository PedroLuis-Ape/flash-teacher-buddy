import { lazy, Suspense, type ComponentProps } from "react";

const LazyDetailedExplanationPanel = lazy(() =>
  import("./DetailedExplanationPanel.impl").then((module) => ({ default: module.DetailedExplanationPanel }))
);

type DetailedExplanationPanelProps = ComponentProps<typeof LazyDetailedExplanationPanel>;

export const DetailedExplanationPanel = (props: DetailedExplanationPanelProps) => (
  <Suspense fallback={null}>
    <LazyDetailedExplanationPanel {...props} />
  </Suspense>
);
