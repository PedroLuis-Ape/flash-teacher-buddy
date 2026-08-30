import { useAttentionPointMutation, type AttentionPointMutationInput } from "./useAttentionPoint";
import type { SpecialFocusContext } from './useSpecialFlashcards';
import { takePendingSpecialFocusDraft } from "@/features/study/lib/specialFocusDraft";

interface LegacySpecialLayerInput {
  visibleLayerId: string;
  listId?: string | null;
  enable: boolean;
  focus?: SpecialFocusContext | null;
  institutionId?: string | null;
  sourceGroupId?: string | null;
}

function toCanonicalInput(input: LegacySpecialLayerInput): AttentionPointMutationInput {
  const pendingFocus = input.enable ? input.focus ?? takePendingSpecialFocusDraft() : null;
  return {
    sourceCardId: input.visibleLayerId,
    enabled: input.enable,
    institutionId: input.institutionId ?? null,
    sourceGroupId: input.sourceGroupId ?? null,
    // Focus drafts are only consumed for ON. Explicit OFF can never be
    // turned back into ON by a stale sessionStorage draft.
    focus: pendingFocus,
  };
}

/** Compatibility adapter. All writes go through useAttentionPointMutation. */
export function useSetSpecialLayer(userId?: string) {
  const mutation = useAttentionPointMutation(userId);
  return {
    ...mutation,
    mutate: (input: LegacySpecialLayerInput, options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate(toCanonicalInput(input), options),
    mutateAsync: (input: LegacySpecialLayerInput) => mutation.mutateAsync(toCanonicalInput(input)),
  };
}
