import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  answerAdaptiveMixedCard,
  createAdaptiveMixedSession,
  getAdaptiveMixedProgress,
  isAdaptiveMixedStateCompatible,
  restartAdaptiveMixedJourney,
  restartAdaptiveMixedRound,
  startNextAdaptiveMixedRound,
  type AdaptiveMixedSessionState,
  type CreateAdaptiveMixedSessionOptions,
} from "@/features/study/lib/adaptiveMixedSession";

interface UseAdaptiveMixedSessionOptions extends CreateAdaptiveMixedSessionOptions {
  cardIds: string[];
  storageKey: string;
  remoteState?: unknown;
  remoteLoaded?: boolean;
  onPersist?: (state: AdaptiveMixedSessionState) => void | Promise<void>;
}

function readLocalState(storageKey: string, cardIds: string[]): AdaptiveMixedSessionState | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isAdaptiveMixedStateCompatible(parsed, cardIds) ? parsed : null;
  } catch {
    return null;
  }
}

export function useAdaptiveMixedSession({
  cardIds,
  storageKey,
  remoteState,
  remoteLoaded = true,
  random,
  weightByCardId,
  onPersist,
}: UseAdaptiveMixedSessionOptions) {
  const deckSignature = useMemo(() => [...new Set(cardIds)].sort().join("|"), [cardIds]);
  const [state, setState] = useState<AdaptiveMixedSessionState | null>(null);
  const initializedSignatureRef = useRef("");
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!remoteLoaded || cardIds.length === 0) return;
    if (initializedSignatureRef.current === deckSignature) return;

    const local = readLocalState(storageKey, cardIds);
    const remote = isAdaptiveMixedStateCompatible(remoteState, cardIds)
      ? remoteState
      : null;
    const next = local ?? remote ?? createAdaptiveMixedSession(cardIds, { random, weightByCardId });

    initializedSignatureRef.current = deckSignature;
    setState(next);
  }, [cardIds, deckSignature, remoteLoaded, remoteState, storageKey, random, weightByCardId]);

  useEffect(() => {
    if (!state) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Browsers with restricted storage still keep the in-memory session alive.
    }

    if (!onPersist) return;
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(() => {
      void onPersist(state);
    }, 350);

    return () => {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    };
  }, [state, storageKey, onPersist]);

  const answer = useCallback((correct: boolean, skipped = false) => {
    setState((current) => current ? answerAdaptiveMixedCard(current, correct, skipped) : current);
  }, []);

  const restartRound = useCallback(() => {
    setState((current) => current ? restartAdaptiveMixedRound(current, random) : current);
  }, [random]);

  const nextRound = useCallback(() => {
    setState((current) => current ? startNextAdaptiveMixedRound(current, random) : current);
  }, [random]);

  const restartJourney = useCallback(() => {
    setState((current) => current
      ? restartAdaptiveMixedJourney(current, { random, weightByCardId })
      : createAdaptiveMixedSession(cardIds, { random, weightByCardId }));
  }, [cardIds, random, weightByCardId]);

  const clearPersistedJourney = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch {}
    initializedSignatureRef.current = "";
    setState(createAdaptiveMixedSession(cardIds, { random, weightByCardId }));
  }, [cardIds, random, storageKey, weightByCardId]);

  const progress = state ? getAdaptiveMixedProgress(state) : null;
  const currentCardId = state?.currentRoundCardIds[state.currentIndex] ?? null;
  const activityMode = currentCardId ? state?.activityByCardId[currentCardId] ?? null : null;

  return {
    state,
    progress,
    currentCardId,
    activityMode,
    answer,
    restartRound,
    nextRound,
    restartJourney,
    clearPersistedJourney,
  };
}
