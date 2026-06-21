import { lazy, Suspense, useCallback, type ComponentProps } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useStudyPreferences } from "@/hooks/useStudyPreferences";
import { savePronunciationOutcome } from "@/features/speech/pronunciationResultHandoff";
import { StudyCardDeck } from "./StudyCardDeck";

const LazyPronunciationStudyView = lazy(() =>
  import("./PronunciationStudyView.impl").then((module) => ({ default: module.PronunciationStudyView }))
);

type ImplementationProps = ComponentProps<typeof LazyPronunciationStudyView>;
type PronunciationStudyViewProps = Omit<ImplementationProps, "direction" | "onResult"> & {
  direction?: ImplementationProps["direction"];
  onResult?: ImplementationProps["onResult"];
  /** Compatibility with the existing Study page while preserving the assessed result. */
  onNext?: () => void;
};

export const PronunciationStudyView = ({
  direction,
  onResult,
  onNext,
  ...props
}: PronunciationStudyViewProps) => {
  const { userId } = useAuth();
  const { prefs } = useStudyPreferences(userId ?? undefined);
  const resolvedDirection = direction ?? prefs.direction;

  const handleResult = useCallback<ImplementationProps["onResult"]>((outcome) => {
    if (onResult) {
      onResult(outcome);
      return;
    }
    savePronunciationOutcome(outcome.result, props.flashcardId);
    onNext?.();
  }, [onNext, onResult, props.flashcardId]);

  return (
    <StudyCardDeck cardKey={`${props.front}:${props.back}:${resolvedDirection}`} density="compact">
      <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Preparando pronúncia...</div>}>
        <LazyPronunciationStudyView
          {...props}
          direction={resolvedDirection}
          onResult={handleResult}
        />
      </Suspense>
    </StudyCardDeck>
  );
};
