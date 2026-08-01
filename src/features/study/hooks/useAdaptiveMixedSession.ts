import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  answerAdaptiveMixedCard,
  createAdaptiveMixedSession,
  getAdaptiveMixedProgress,
  persistLatestAdaptiveState,
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
  const persistGenerationRef = useRef(0);
  const latestStateRef = useRef<AdaptiveMixedSessionState | null>(null);
  const persistInFlightRef = useRef<Promise<void> | null>(null);

  // A timer from a previous list/user/mode must not call the current remote
  // writer after navigation. The in-memory state can change immediately, but
  // persistence is allowed only for the active initialization generation.
  useEffect(() => {
    persistGenerationRef.current += 1;
    latestStateRef.current = null;
    return () => {
      persistGenerationRef.current += 1;
      latestStateRef.current = null;
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    };
  }, [initializationSignature]);

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

  const persistNow = useCallback(async () => {
    if (!onPersist || !latestStateRef.current) return;
    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
      persistTimeoutRef.current = null;
    }
    if (persistInFlightRef.current) {
      await persistInFlightRef.current;
      return;
    }

    const generation = persistGenerationRef.current;
    const request = persistLatestAdaptiveState(
      () => generation === persistGenerationRef.current ? latestStateRef.current : null,
      (state) => onPersist(state),
    );
    persistInFlightRef.current = request;
    try {
      await request;
    } finally {
      if (persistInFlightRef.current === request) persistInFlightRef.current = null;
    }
  }, [onPersist]);

  useEffect(() => {
    if (!state) return;
    latestStateRef.current = state;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Browsers with restricted storage still keep the in-memory session alive.
    }

    if (!onPersist) return;
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    const generation = persistGenerationRef.current;
    persistTimeoutRef.current = setTimeout(() => {
      if (generation !== persistGenerationRef.current) return;
      void persistNow().catch((error) => {
        // Local persistence already succeeded; keep the in-memory session
        // usable while exposing the remote failure to diagnostics.
        console.warn("[MixedStudy] Falha ao sincronizar a sessão:", error);
      });
    }, 350);

    return () => {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    };
  }, [onPersist, persistNow, state, storageKey]);

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
    persistGenerationRef.current += 1;
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
    persistNow,
    clearPersistedJourney,
  };
}
