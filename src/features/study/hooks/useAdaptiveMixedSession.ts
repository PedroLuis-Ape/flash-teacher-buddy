import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  answerAdaptiveMixedCard,
  createAdaptiveMixedSession,
  getAdaptiveMixedProgress,
  repairAdaptiveMixedState,
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

function readLocalState(
  storageKey: string,
  cardIds: string[],
  flowMode: "mastery_rounds" | "continuous",
): AdaptiveMixedSessionState | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return repairAdaptiveMixedState(parsed, cardIds, flowMode);
  } catch {
    return null;
  }
}

export function useAdaptiveMixedSession({
  cardIds,
  storageKey,
  remoteState,
  remoteLoaded = true,
  flowMode = "mastery_rounds",
  random,
  weightByCardId,
  onPersist,
}: UseAdaptiveMixedSessionOptions) {
  const deckSignature = useMemo(() => [...new Set(cardIds)].sort().join("|"), [cardIds]);
  const initializationSignature = `${storageKey}|${deckSignature}`;
  const [state, setState] = useState<AdaptiveMixedSessionState | null>(null);
  const initializedSignatureRef = useRef("");
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (cardIds.length === 0) {
      initializedSignatureRef.current = "";
      setState(null);
      return;
    }
    if (!remoteLoaded) return;
    if (initializedSignatureRef.current === initializationSignature) return;

    const local = readLocalState(storageKey, cardIds, flowMode);
    const remote = repairAdaptiveMixedState(remoteState, cardIds, flowMode);
    const candidates = [local, remote].filter((candidate): candidate is AdaptiveMixedSessionState => Boolean(candidate));
    const next = candidates.sort((left, right) => right.updatedAt - left.updatedAt)[0]
      ?? createAdaptiveMixedSession(cardIds, { random, weightByCardId, flowMode });

    initializedSignatureRef.current = initializationSignature;
    setState(next);
  }, [cardIds, flowMode, initializationSignature, remoteLoaded, remoteState, storageKey, random, weightByCardId]);

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
      ? restartAdaptiveMixedJourney(current, { random, weightByCardId, flowMode })
      : createAdaptiveMixedSession(cardIds, { random, weightByCardId, flowMode }));
  }, [cardIds, flowMode, random, weightByCardId]);

  const clearPersistedJourney = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch {}
    initializedSignatureRef.current = "";
    setState(createAdaptiveMixedSession(cardIds, { random, weightByCardId, flowMode }));
  }, [cardIds, flowMode, random, storageKey, weightByCardId]);

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
