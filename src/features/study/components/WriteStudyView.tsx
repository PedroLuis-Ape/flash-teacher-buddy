import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  type ComponentProps,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { StudyCardDeck } from "./StudyCardDeck";
import { getBalancedDirection, type RuntimeDirection } from "@/features/study/lib/runtimeStudySchedule";
import { normalizeKey } from "@/features/study/lib/keyboardShortcuts";
import { useShortcutMap } from "@/hooks/useKeyboardShortcuts";
import "./studyMobileActions.css";

const LazyWriteStudyView = lazy(() =>
  import("./WriteStudyView.impl").then((module) => ({ default: module.WriteStudyView }))
);

type WriteStudyViewProps = ComponentProps<typeof LazyWriteStudyView>;

function findActionButton(root: HTMLElement, label: string): HTMLButtonElement | null {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
    button.textContent?.trim().toLocaleLowerCase().includes(label),
  ) ?? null;
}

export const WriteStudyView = (props: WriteStudyViewProps) => {
  const cardKey = props.flashcardId || `${props.front}:${props.back}`;
  const direction = getBalancedDirection(cardKey, props.direction as RuntimeDirection);
  const boundaryRef = useRef<HTMLDivElement>(null);
  const submitLockedRef = useRef(false);
  const navigationLockedRef = useRef(false);
  const shortcuts = useShortcutMap();

  useEffect(() => {
    submitLockedRef.current = false;
    navigationLockedRef.current = false;
  }, [cardKey, direction]);

  const runOnce = (action: () => void) => {
    if (navigationLockedRef.current) return;
    navigationLockedRef.current = true;
    action();
  };

  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.target instanceof HTMLInputElement)) return;

    const key = normalizeKey(event.key);
    const confirmKey = normalizeKey(shortcuts.confirm);
    const skipKey = normalizeKey(shortcuts.skip);
    if (key !== confirmKey && key !== skipKey) return;

    event.preventDefault();
    event.stopPropagation();
    const label = key === confirmKey ? "corrigir" : "pular";
    findActionButton(event.currentTarget, label)?.click();
  };

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("button");
    if (!button?.textContent?.toLocaleLowerCase().includes("corrigir")) return;

    const value = boundaryRef.current?.querySelector<HTMLInputElement>("input")?.value.trim();
    if (!value) return;
    if (!submitLockedRef.current) {
      submitLockedRef.current = true;
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <StudyCardDeck cardKey={cardKey} density="compact">
      <div
        ref={boundaryRef}
        data-write-study-boundary="true"
        onKeyDownCapture={handleKeyDownCapture}
        onClickCapture={handleClickCapture}
      >
        <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Preparando modo Escrita...</div>}>
          <LazyWriteStudyView
            {...props}
            direction={direction}
            onCorrect={() => runOnce(props.onCorrect)}
            onIncorrect={() => runOnce(props.onIncorrect)}
            onSkip={() => runOnce(props.onSkip)}
          />
        </Suspense>
      </div>
    </StudyCardDeck>
  );
};
