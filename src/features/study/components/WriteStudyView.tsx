import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { StudyCardDeck } from "./StudyCardDeck";
import { getBalancedDirection, type RuntimeDirection } from "@/features/study/lib/runtimeStudySchedule";
import { normalizeKey } from "@/features/study/lib/keyboardShortcuts";
import { useShortcutMap } from "@/hooks/useKeyboardShortcuts";
import { useResolvedStudyGlossaryHints } from "@/features/study/hooks/useResolvedStudyGlossaryHints";
import {
  DEFAULT_WRITE_ACTIVITY_PREFERENCE,
  WRITE_ACTIVITY_PREFERENCE_CHANGED_EVENT,
  readWriteActivityPreference,
  resolveRewriteSideForCard,
  resolveWriteActivityGameMode,
  type WriteActivityPreference,
  type WriteActivityPreferenceChangedDetail,
} from "@/features/study/lib/writeActivityMode";

const LazyWriteStudyView = lazy(() =>
  import("./WriteStudyView.impl").then((module) => ({ default: module.WriteStudyView }))
);

const REWRITE_TRANSLATION_RETRY_DELAYS = [0, 50, 150, 350] as const;

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

function findRewriteInstruction(root: HTMLElement): HTMLElement | null {
  return Array.from(root.querySelectorAll<HTMLElement>("p")).find((node) =>
    node.textContent?.trim().startsWith("Reescreva exatamente como aparece acima"),
  ) ?? null;
}

function normalizeRewriteText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

// The visible prompt is the authoritative source of which side is being
// rewritten. Reading it from the DOM keeps the small translation line always
// on the opposite side, even when the side resolution is recomputed elsewhere.
function readRewritePromptText(instruction: HTMLElement): string {
  let sibling = instruction.previousElementSibling as HTMLElement | null;
  while (sibling && sibling.dataset?.writeRewriteTranslation === "true") {
    sibling = sibling.previousElementSibling as HTMLElement | null;
  }
  return sibling?.textContent ?? "";
}

export const WriteStudyView = (props: WriteStudyViewProps) => {
  const cardKey = props.flashcardId || `${props.front}:${props.back}`;
  const rewriteCardKey = props.flashcardId || `${props.front}|${props.back}`;
  const rewriteLayerKey = `${props.flashcardId ?? "card"}|${props.front}|${props.back}`;
  const direction = getBalancedDirection(cardKey, props.direction as RuntimeDirection);
  const boundaryRef = useRef<HTMLDivElement>(null);
  const submitLockedRef = useRef(false);
  const navigationLockedRef = useRef(false);
  const shortcuts = useShortcutMap();
  const writeActivityGameMode = resolveWriteActivityGameMode();
  const [writeActivity, setWriteActivity] = useState<WriteActivityPreference>(
    () => (typeof window === "undefined"
      ? { ...DEFAULT_WRITE_ACTIVITY_PREFERENCE }
      : readWriteActivityPreference(writeActivityGameMode)),
  );
  const resolvedRewriteSide = resolveRewriteSideForCard(rewriteCardKey, writeActivity.rewriteSide);
  const isRewriteActivity = writeActivityGameMode === "write" && writeActivity.mode === "rewrite";
  const rewriteTranslationText = resolvedRewriteSide === "a" ? props.back : props.front;
  const glossaryHints = useResolvedStudyGlossaryHints({
    front: props.front,
    back: props.back,
    wordHints: props.wordHintsA,
    mergedHintsA: props.mergedHintsA,
    mergedHintsB: props.mergedHintsB,
    langA: props.langA,
    langB: props.langB,
  });

  useEffect(() => {
    submitLockedRef.current = false;
    navigationLockedRef.current = false;
  }, [cardKey, direction]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<WriteActivityPreferenceChangedDetail>).detail;
      if (detail?.gameMode === writeActivityGameMode) setWriteActivity(detail.preference);
    };
    window.addEventListener(WRITE_ACTIVITY_PREFERENCE_CHANGED_EVENT, handler as EventListener);
    return () => window.removeEventListener(WRITE_ACTIVITY_PREFERENCE_CHANGED_EVENT, handler as EventListener);
  }, [writeActivityGameMode]);

  useLayoutEffect(() => {
    const root = boundaryRef.current;
    if (!root) return;

    const media = window.matchMedia("(max-width: 639px)");
    const retryTimers: number[] = [];
    let animationFrame = 0;
    let disposed = false;

    const syncRewriteTranslation = () => {
      if (disposed) return;

      const instruction = findRewriteInstruction(root);
      const existing = root.querySelector<HTMLElement>("[data-write-rewrite-translation]");

      if (!isRewriteActivity || !rewriteTranslationText?.trim()) {
        existing?.remove();
        return;
      }

      if (!instruction) return;

      // Pick the side that is NOT on screen: the small line is only a reminder
      // of the meaning of the visible text, never a copy of it.
      const promptText = normalizeRewriteText(readRewritePromptText(instruction));
      const normalizedFront = normalizeRewriteText(props.front);
      const normalizedBack = normalizeRewriteText(props.back);
      const oppositeText = promptText && normalizedFront && promptText.includes(normalizedFront)
        ? props.back
        : promptText && normalizedBack && promptText.includes(normalizedBack)
          ? props.front
          : rewriteTranslationText;

      if (!oppositeText?.trim() || normalizeRewriteText(oppositeText) === promptText) {
        existing?.remove();
        return;
      }

      const preview = existing ?? document.createElement("p");
      if (!existing) {
        preview.dataset.writeRewriteTranslation = "true";
        preview.className = "mx-auto mb-3 mt-2 max-w-[92%] break-words px-2 text-xs italic leading-relaxed text-muted-foreground/60 sm:mb-4 sm:mt-3 sm:text-sm";
        preview.setAttribute("dir", "auto");
        preview.setAttribute("aria-label", "Tradução do texto para reescrita");
      }

      preview.dataset.writeRewriteTranslationKey = rewriteLayerKey;
      const renderedTranslation = `“${oppositeText}”`;
      if (preview.textContent !== renderedTranslation) preview.textContent = renderedTranslation;

      if (preview.parentElement !== instruction.parentElement || preview.nextElementSibling !== instruction) {
        instruction.insertAdjacentElement("beforebegin", preview);
      }
    };

    const applyLayout = () => {
      syncRewriteTranslation();

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

    const scheduleLayoutSync = () => {
      if (disposed) return;
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(applyLayout);
      REWRITE_TRANSLATION_RETRY_DELAYS.forEach((delay) => {
        retryTimers.push(window.setTimeout(applyLayout, delay));
      });
    };

    const observer = new MutationObserver(scheduleLayoutSync);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ["class"],
    });
    media.addEventListener("change", scheduleLayoutSync);
    scheduleLayoutSync();

    return () => {
      disposed = true;
      observer.disconnect();
      media.removeEventListener("change", scheduleLayoutSync);
      window.cancelAnimationFrame(animationFrame);
      retryTimers.forEach((timer) => window.clearTimeout(timer));
      root.querySelector<HTMLElement>("[data-write-rewrite-translation]")?.remove();
    };
  }, [rewriteLayerKey, direction, isRewriteActivity, rewriteTranslationText]);

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

    if (button.textContent?.toLocaleLowerCase().includes("tentar corrigir")) {
      submitLockedRef.current = false;
      navigationLockedRef.current = false;
      return;
    }

    const value = boundaryRef.current
      ?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea")
      ?.value.trim();
    if (!value) return;
    if (!submitLockedRef.current) {
      // A fresh submission is a new attempt, even when the engine immediately
      // presents the same card again after an error in mastery mode.
      submitLockedRef.current = true;
      navigationLockedRef.current = false;
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  };

  if (glossaryHints.isLoading) {
    return (
      <StudyCardDeck cardKey={cardKey} density="compact">
        <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
          Carregando glossário da pasta...
        </div>
      </StudyCardDeck>
    );
  }

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
            key={rewriteLayerKey}
            {...props}
            mergedHintsA={glossaryHints.mergedHintsA}
            mergedHintsB={glossaryHints.mergedHintsB}
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