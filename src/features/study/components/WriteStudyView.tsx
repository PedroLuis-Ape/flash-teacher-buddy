import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentProps,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { StudyCardDeck } from "./StudyCardDeck";
import { getBalancedDirection, type RuntimeDirection } from "@/features/study/lib/runtimeStudySchedule";
import { normalizeKey } from "@/features/study/lib/keyboardShortcuts";
import { useShortcutMap } from "@/hooks/useKeyboardShortcuts";

const LazyWriteStudyView = lazy(() =>
  import("./WriteStudyView.impl").then((module) => ({ default: module.WriteStudyView }))
);

type WriteStudyViewProps = ComponentProps<typeof LazyWriteStudyView>;

function findActionButton(root: HTMLElement, label: string): HTMLButtonElement | null {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
    button.textContent?.trim().toLocaleLowerCase().includes(label),
  ) ?? null;
}

function setStyle(element: HTMLElement | null, property: string, value: string) {
  element?.style.setProperty(property, value);
}

function clearStyle(element: HTMLElement | null, properties: string[]) {
  properties.forEach((property) => element?.style.removeProperty(property));
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

  useLayoutEffect(() => {
    const root = boundaryRef.current;
    if (!root) return;

    const media = window.matchMedia("(max-width: 639px)");

    const applyLayout = () => {
      const skipButton = findActionButton(root, "pular");
      const hintButton = findActionButton(root, "dica");
      const correctButton = findActionButton(root, "corrigir");
      const row = skipButton?.parentElement ?? null;
      const dock = row?.parentElement ?? null;
      const labels = [
        skipButton?.querySelector<HTMLElement>("span") ?? null,
        hintButton?.querySelector<HTMLElement>("span") ?? null,
      ];

      if (media.matches && skipButton && hintButton && correctButton && row && dock) {
        setStyle(dock, "position", "static");
        setStyle(dock, "bottom", "auto");
        setStyle(dock, "width", "100%");
        setStyle(dock, "max-width", "100%");
        setStyle(dock, "min-width", "0");
        setStyle(dock, "overflow", "visible");
        setStyle(dock, "z-index", "20");

        setStyle(row, "display", "grid");
        setStyle(row, "grid-template-columns", "minmax(4.25rem, .85fr) minmax(4rem, .8fr) minmax(0, 1.8fr)");
        setStyle(row, "align-items", "stretch");
        setStyle(row, "width", "100%");
        setStyle(row, "min-width", "0");
        setStyle(row, "gap", ".5rem");

        [skipButton, hintButton, correctButton].forEach((button) => {
          setStyle(button, "display", "inline-flex");
          setStyle(button, "width", "100%");
          setStyle(button, "min-width", "0");
          setStyle(button, "height", "3rem");
          setStyle(button, "min-height", "3rem");
          setStyle(button, "padding-inline", ".5rem");
          setStyle(button, "justify-content", "center");
        });

        labels.forEach((label) => {
          setStyle(label, "display", "inline");
          setStyle(label, "margin-left", ".375rem");
          setStyle(label, "font-size", ".75rem");
        });
        return;
      }

      clearStyle(dock, ["position", "bottom", "width", "max-width", "min-width", "overflow", "z-index"]);
      clearStyle(row, ["display", "grid-template-columns", "align-items", "width", "min-width", "gap"]);
      [skipButton, hintButton, correctButton].forEach((button) => {
        clearStyle(button, ["display", "width", "min-width", "height", "min-height", "padding-inline", "justify-content"]);
      });
      labels.forEach((label) => clearStyle(label, ["display", "margin-left", "font-size"]));
    };

    const observer = new MutationObserver(applyLayout);
    observer.observe(root, { childList: true, subtree: true });
    media.addEventListener("change", applyLayout);
    applyLayout();

    return () => {
      observer.disconnect();
      media.removeEventListener("change", applyLayout);
    };
  }, [cardKey, direction]);

  const runOnce = (action: () => void) => {
    if (navigationLockedRef.current) return;
    navigationLockedRef.current = true;
    action();
  };

  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) return;

    const key = normalizeKey(event.key);
    const confirmKey = normalizeKey(shortcuts.confirm);
    const skipKey = normalizeKey(shortcuts.skip);
    if (key !== confirmKey && key !== skipKey) return;
    if (event.target instanceof HTMLTextAreaElement && event.key === "Enter" && event.shiftKey) return;

    event.preventDefault();
    event.stopPropagation();
    const label = key === confirmKey ? "corrigir" : "pular";
    findActionButton(event.currentTarget, label)?.click();
  };

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("button");
    if (!button?.textContent?.toLocaleLowerCase().includes("corrigir")) return;

    const value = boundaryRef.current
      ?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea")
      ?.value.trim();
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
