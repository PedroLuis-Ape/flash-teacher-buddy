import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useListGlossary } from "@/hooks/useListGlossary";
import {
  mergeGlossaryAndManual,
  parseExtendedWordHints,
  type MergedHint,
} from "@/features/study/lib/glossaryMerge";
import { FEATURE_FLAGS } from "@/lib/featureFlags";

interface ResolveStudyGlossaryHintsInput {
  front?: string | null;
  back?: string | null;
  wordHints?: unknown;
  mergedHintsA?: MergedHint[];
  mergedHintsB?: MergedHint[];
  langA?: string;
  langB?: string;
}

function listIdFromPath(pathname: string): string | undefined {
  return pathname.match(/^\/(?:portal\/)?list\/([^/]+)(?:\/|$)/u)?.[1];
}

/**
 * Safety net shared by every study view.
 *
 * The main Study screen normally resolves folder glossary hints before passing
 * props down. Other runtimes, such as MixedStudy, historically passed only the
 * card-local word_hints. This hook preserves explicitly supplied merged hints
 * and fills any missing side from the list's folder glossary.
 */
export function useResolvedStudyGlossaryHints(
  input: ResolveStudyGlossaryHintsInput,
): { mergedHintsA?: MergedHint[]; mergedHintsB?: MergedHint[]; isLoading: boolean } {
  const location = useLocation();
  const needsRuntimeGlossary =
    FEATURE_FLAGS.glossary_enabled
    && FEATURE_FLAGS.word_hints_enabled
    && (input.mergedHintsA === undefined || input.mergedHintsB === undefined);
  const listId = needsRuntimeGlossary ? listIdFromPath(location.pathname) : undefined;
  const { activeGlossary, isLoading } = useListGlossary(listId);

  const manualHints = useMemo(
    () => parseExtendedWordHints(input.wordHints),
    [input.wordHints],
  );

  const computedA = useMemo(() => {
    if (!input.front?.trim()) return undefined;
    if (activeGlossary.length === 0 && manualHints.length === 0) return undefined;
    return mergeGlossaryAndManual(
      input.front,
      "A",
      activeGlossary,
      manualHints,
      { langA: input.langA, langB: input.langB },
    );
  }, [activeGlossary, input.front, input.langA, input.langB, manualHints]);

  const computedB = useMemo(() => {
    if (!input.back?.trim()) return undefined;
    if (activeGlossary.length === 0 && manualHints.length === 0) return undefined;
    return mergeGlossaryAndManual(
      input.back,
      "B",
      activeGlossary,
      manualHints,
      { langA: input.langA, langB: input.langB },
    );
  }, [activeGlossary, input.back, input.langA, input.langB, manualHints]);

  return {
    mergedHintsA: input.mergedHintsA ?? computedA,
    mergedHintsB: input.mergedHintsB ?? computedB,
    isLoading: Boolean(listId && needsRuntimeGlossary && isLoading),
  };
}
