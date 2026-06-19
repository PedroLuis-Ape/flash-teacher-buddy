import { lazy, Suspense, useMemo, type ComponentProps } from "react";
import { listIdFromPath, isPublicListPath } from "@/lib/listRoute";
import { useListPrimarySide } from "@/lib/useListPrimarySide";
import { primarySideToDirection } from "@/lib/primarySideDirection";

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

export const FlipStudyView = (props: FlipStudyViewProps) => {
  const listId = useMemo(() => listIdFromPath(window.location.pathname), []);
  const publicRoute = useMemo(() => isPublicListPath(window.location.pathname), []);
  const { side } = useListPrimarySide(listId, publicRoute);

  if (!listId) {
    return (
      <Suspense fallback={<StudyModeFallback />}>
        <LazyFlipStudyView {...props} />
      </Suspense>
    );
  }

  const primaryLabel = side === "b" ? props.labelB : props.labelA;
  const sessionLabel = props.direction === "b-a" ? props.labelB : props.direction === "a-b" ? props.labelA : "Misto";
  const followsPrimary = props.direction === primarySideToDirection(side);

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap justify-center gap-2 text-[11px]">
        <span className="rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary">
          Principal: {primaryLabel}
        </span>
        {!followsPrimary && (
          <span className="rounded-full bg-amber-500/10 px-2 py-1 font-medium text-amber-700 dark:text-amber-300">
            Primeiro nesta sessão: {sessionLabel}
          </span>
        )}
      </div>
      <Suspense fallback={<StudyModeFallback />}>
        <LazyFlipStudyView {...props} />
      </Suspense>
    </div>
  );
};
