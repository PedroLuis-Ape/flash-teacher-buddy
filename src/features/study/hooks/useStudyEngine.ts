import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SaveProgressResult } from "@/features/study/lib/saveProgressResult";
import { toast } from "sonner";
import { recordStudyAnswer, settleStudySession } from "@/lib/rewardEngine";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { useListActivity } from "@/hooks/useListActivity";
import { updateGoalProgress } from "@/hooks/useGoals";
import { useTurmaActivity } from "@/features/classroom/hooks/useTurmaActivity";
import { useTurmaEngagementTracking } from "@/features/classroom/hooks/useTurmaEngagementTracking";
import { perfLog } from "@/lib/perfLog";
import {
  orderByIntelligence,
  reinjectFailedCard,
  type CardProgressLike,
} from "@/features/study/lib/intelligenceScoring";
import {
  buildCanonicalToPlayableMap,
  mapCanonicalIdsToPlayable,
} from "@/features/cards/lib/cardStatusIdentity";
import { shouldInjectRedPriority } from "@/features/study/lib/studyScopePolicy";
import {
  buildLegacyStudySnapshotKey,
  buildStudySnapshotKey,
  clearStudySnapshot,
  readStudySnapshot,
  readRawStudySnapshot,
  readSameSessionSnapshot,
  sanitizeStudyLayerSnapshot,
  writeStudySnapshot,
  type StudySessionLayerSnapshot,
  type StudySessionSnapshot,
} from "@/features/study/lib/studySessionSnapshot";
import {
  buildMasterySnapshotKey,
  clearMasterySnapshot,
  readMasterySnapshot,
  readMasterySnapshotWithMeta,
  sanitizeMasterySnapshot,
  writeMasterySnapshot,
} from "@/features/study/lib/masterySessionSnapshot";
import {
  buildLegacyStudySessionScopeKey,
  buildStudySessionScopeKey,
  buildStudySessionSettingsSnapshot,
  isPersistedStudySessionCompatible,
  studySessionSettingsToPresetOverride,
  type StudySessionSettingsSnapshot,
  type StudySessionContextInput,
} from "@/features/study/lib/studySessionContext";
import {
  createLatestWriteQueue,
  type LatestWriteQueue,
} from "@/features/study/lib/latestWriteQueue";
import {
  createStudyProgressOperationId,
  recordStudyProgressAttempt,
  type StudyProgressAttempt,
} from "@/features/study/lib/studyProgressRepository";
import {
  claimStudySession,
  persistStudySession,
} from "@/features/study/lib/studySessionRepository";
import {
  enqueueStudySessionSnapshot,
  enqueueStudyProgress,
  listPendingStudySessionSnapshots,
  listPendingStudyProgress,
  markStudySessionSnapshotFailed,
  markStudySessionSnapshotSuccess,
  markStudyProgressFailed,
  markStudyProgressSuccess,
  requeueStudyOutbox,
} from "@/features/study/lib/studyPersistenceOutbox";
import { fetchRequestedStudySession, type RequestedStudySessionClient } from "@/features/study/lib/requestedStudySession";
import { assertStudySessionWrite, restoreStudySession, restoreMasterySession, type RestorableStudySession } from "@/features/study/lib/restoreStudySession";
import { clearStudyLayerSnapshot } from "@/features/study/lib/studyLayerSnapshot";
import {
  createMasterySession,
  getCurrentCardId,
  recordResult as recordMasteryResult,
  summarizeCurrentRound,
  startNextRound as startNextMasteryRound,
  type MasterySessionState,
  type StudyCardResult,
  type StudyFlowMode,
} from "@/features/study/lib/studySessionFlow";
import {
  logStudyRuntime,
  STUDY_REMOTE_RESTORE_TIMEOUT_MS,
  withStudyRuntimeTimeout,
} from "@/features/study/lib/studySessionRuntime";

export interface StudyResult {
  flashcardId: string;
  correct: boolean;
  skipped: boolean;
  attempts: number;
}

export interface StudySession {
  collectionId: string;
  mode: "flip" | "write" | "mixed";
  direction: "a-b" | "b-a" | "any";
  results: StudyResult[];
  startTime: number;
  endTime?: number;
}

export interface GameSettings {
  mode: 'sequential' | 'random';
  subset: 'all' | 'favorites';
  fastMode?: boolean;
  /** Independent red-only study scope. The parent supplies the filtered
   *  deck; the engine preserves it as a sequential, non-repeating run. */
  redFocus?: boolean;
}

interface FlashcardWithProgress {
  id: string;
  term: string;
  translation: string;
  incorrectCount: number;
  lastReviewed: string | null;
}

type PendingProgressEntry = Required<StudyProgressAttempt> & {
  timestamp: number;
};

interface StudySessionWriteRequest {
  sessionId: string;
  userId: string;
  listId: string;
  mode: string;
  sessionScopeKey: string;
  payload: Record<string, unknown>;
  stage: string;
}

async function writeStudySession(request: StudySessionWriteRequest): Promise<void> {
  assertStudySessionWrite(request.payload);
  const revision = Math.max(0, Math.floor(Number(request.payload.client_revision) || Date.now()));
  const key = `${request.userId}:${request.sessionId}`;
  let queued = false;
  try {
    queued = await enqueueStudySessionSnapshot({
      key,
      userId: request.userId,
      sessionId: request.sessionId,
      listId: request.listId,
      mode: request.mode,
      sessionScopeKey: request.sessionScopeKey,
      revision,
      payload: request.payload,
      updatedAt: Date.parse(String(request.payload.updated_at ?? "")) || Date.now(),
    });
  } catch (error) {
    // IndexedDB is a durable enhancement, not a reason to stop a usable
    // online session. The synchronous localStorage snapshot remains active.
    if (import.meta.env.DEV) console.debug("[StudyEngine] Outbox indisponível", { stage: request.stage });
  }

  try {
    const result = await persistStudySession({
      sessionId: request.sessionId,
      userId: request.userId,
      listId: request.listId,
      mode: request.mode,
      revision,
      payload: request.payload,
      stage: request.stage,
    });
    if (queued) {
      await markStudySessionSnapshotSuccess(key, revision);
    }
    if (!result.accepted && result.revision > revision) {
      throw new Error("session-write-conflict-newer-remote-revision");
    }
    if (import.meta.env.DEV) {
      logStudyRuntime("session-write", {
        sessionId: request.sessionId,
        mode: request.mode,
        revision,
        source: result.usedRpc ? "rpc" : "legacy-fallback",
        accepted: result.accepted,
      });
    }
  } catch (error) {
    if (queued) await markStudySessionSnapshotFailed(key, revision, error).catch(() => undefined);
    throw error;
  }
}

function nextStudySessionRevision(ref: { current: number }): number {
  const revision = Math.max(Date.now(), ref.current + 1);
  ref.current = revision;
  return revision;
}

function buildStudyProgressSnapshot(input: {
  sessionId: string | null;
  currentIndex: number;
  cardsOrder: string[];
  results: StudyResult[];
  layer?: StudySessionLayerSnapshot;
  roundNumber?: number;
  roundResults?: StudyResult[];
  unseenCards?: string[];
  missedCards?: string[];
  isFinished?: boolean;
}): StudySessionSnapshot {
  return {
    version: 2,
    sessionId: input.sessionId,
    currentIndex: input.currentIndex,
    cardsOrder: [...input.cardsOrder],
    results: input.results.map((result) => ({ ...result })),
    timestamp: Date.now(),
    ...(input.roundNumber !== undefined ? { roundNumber: input.roundNumber } : {}),
    ...(input.roundResults ? { roundResults: input.roundResults.map((result) => ({ ...result })) } : {}),
    ...(input.unseenCards ? { unseenCards: [...input.unseenCards] } : {}),
    ...(input.missedCards ? { missedCards: [...input.missedCards] } : {}),
    ...(input.isFinished !== undefined ? { isFinished: input.isFinished } : {}),
    ...(input.layer ? { layer: { ...input.layer } } : {}),
  };
}

// Batch size — only used by mixed mode (straight-through modes use all cards)
const BATCH_SIZE = 10;

/**
 * Inject red-list cards as extra appearances with spaced repetition.
 * Only active when studying favorites (subset === 'favorites').
 * Each red card gets up to 3 extra appearances, spaced ~2-3 cards apart.
 */
function injectRedListRepetitions(
  cardIds: string[],
  redListIds: string[],
  isFavoritesMode: boolean
): string[] {
  if (!isFavoritesMode || redListIds.length === 0) return cardIds;

  const redSet = new Set(redListIds);
  const redInSession = cardIds.filter(id => redSet.has(id));
  if (redInSession.length === 0) return cardIds;

  const result = [...cardIds];
  const MAX_EXTRA = 3;
  const BASE_SPACING = 2;

  // For each red card, insert up to MAX_EXTRA extra copies spaced throughout
  for (const redId of redInSession) {
    const firstIndex = result.indexOf(redId);
    if (firstIndex === -1) continue;

    let lastInsert = firstIndex;
    for (let extra = 0; extra < MAX_EXTRA; extra++) {
      // spacing varies slightly: 2, 3, 2, 3...
      const spacing = BASE_SPACING + (extra % 2);
      const insertAt = Math.min(lastInsert + spacing + 1, result.length);
      result.splice(insertAt, 0, redId);
      lastInsert = insertAt;
    }
  }

  return result;
}

export function useStudyEngine(
  listId: string | undefined,
  flashcards: {
    id: string;
    term: string;
    translation: string;
    parent_card_id?: string | null;
  }[],
  mode: "flip" | "multiple-choice" | "write" | "unscramble" | "mixed" | "pronunciation",
  unlimitedMode: boolean = false,
  favoriteIds: string[] = [],
  initialSettings?: Partial<GameSettings>,
  redListIds: string[] = [],
  userScope?: string | null,
  studyFlowMode: StudyFlowMode = "continuous",
  sessionContextOverrides: Partial<StudySessionContextInput> = {},
  /** The page has authoritatively finished loading the deck and preset. */
  deckReady: boolean = true,
  /** Applies a restored session snapshot without mutating the saved preset. */
  onSessionSettingsRestored?: (settings: StudySessionSettingsSnapshot) => void,
  /** Stable local-storage scope for non-list resources such as collections. */
  storageResourceId?: string,
  /**
   * Sessão exata pedida pelo banner "Continuar". Quando informada, a restauração
   * prefere esta sessionId em vez de simplesmente abrir a mais recente.
   */
  requestedSessionIdInput?: string | null,
  presetReady: boolean = true,
) {
  const [dismissedResumeId, setDismissedResumeId] = useState<string | null>(null);
  const requestedSessionId = requestedSessionIdInput === dismissedResumeId ? null : requestedSessionIdInput;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardsOrder, setCardsOrder] = useState<string[]>([]);
  const [results, setResults] = useState<StudyResult[]>([]);
  const [startTime] = useState(Date.now());
  const [isFinished, setIsFinished] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [masterySession, setMasterySession] = useState<MasterySessionState | null>(null);
  const [initializationState, setInitializationState] = useState<
    "loading" | "ready" | "failed"
  >("loading");

  const isMasteryMode = useMemo(
    () => studyFlowMode === "mastery_rounds" && (
      mode === "flip" || mode === "write" || mode === "mixed" || mode === "multiple-choice"
      || mode === "unscramble" || mode === "pronunciation"
    ),
    [studyFlowMode, mode],
  );
  const localResourceId = storageResourceId || listId;

  
  // Refs for preventing duplicate init, debouncing saves, and batching progress
  const completedInitSignatureRef = useRef<string>("");
  const initializationGenerationRef = useRef(0);
  const initializationAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const saveProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressBufferRef = useRef<PendingProgressEntry[]>([]);
  const flushProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressFlushInFlightRef = useRef<Promise<void> | null>(null);
  const sessionWriteQueueRef = useRef<LatestWriteQueue<StudySessionWriteRequest> | null>(null);
  if (!sessionWriteQueueRef.current) {
    sessionWriteQueueRef.current = createLatestWriteQueue(writeStudySession);
  }
  const sessionWriteIdentityRef = useRef<string | null>(null);
  const authUserIdRef = useRef<string | null>(userScope ?? null);
  // Keep the authoritative session id in a ref: fast exit/completion actions
  // can run before React renders the id returned by the claim request.
  const sessionIdRef = useRef<string | null>(null);
  const sessionRevisionRef = useRef(0);
  const pendingSessionClaimRef = useRef<Promise<string | null> | null>(null);
  const completionInFlightRef = useRef(false);
  const restartInFlightRef = useRef(false);
  const pitecoinWritesRef = useRef<Set<Promise<unknown>>>(new Set());
  const masteryAnswerGuardRef = useRef<{ session: MasterySessionState; key: string } | null>(null);
  const masteryRoundStartGuardRef = useRef<MasterySessionState | null>(null);
  const sessionLayerRef = useRef<StudySessionLayerSnapshot | undefined>(undefined);
  // Exposed to the view layer so a cold start on a new device can reopen the
  // exact layer stored in the authenticated session snapshot.
  const [restoredSessionLayer, setRestoredSessionLayer] = useState<StudySessionLayerSnapshot | null>(null);
  const restoredSettingsIdentityRef = useRef<string | null>(null);
  const runtimeWritableRef = useRef(false);
  const liveSessionSnapshotRef = useRef<{ identity: string; snapshot: StudySessionSnapshot } | null>(null);
  const [resumeAttempt, setResumeAttempt] = useState(0);
  const [requestedRestore, setRequestedRestore] = useState<{
    key: string; row?: RestorableStudySession; error?: string;
  } | null>(null);

  const setTrackedSessionId = useCallback((nextSessionId: string | null) => {
    sessionIdRef.current = nextSessionId;
    setSessionId(nextSessionId);
  }, []);

  const claimAndTrackSession = useCallback(
    (
      input: Parameters<typeof claimStudySession>[0],
      isCurrentClaim: () => boolean = () => mountedRef.current,
    ): Promise<string | null> => {
      let tracked: Promise<string | null>;
      tracked = claimStudySession(input)
        .then(({ id }) => {
          if (!id) return null;
          if (isCurrentClaim()) setTrackedSessionId(id);
          return id;
        })
        .finally(() => {
          if (pendingSessionClaimRef.current === tracked) {
            pendingSessionClaimRef.current = null;
          }
        });
      pendingSessionClaimRef.current = tracked;
      return tracked;
    },
    [setTrackedSessionId],
  );

  // Game settings state — initialized from URL params passed by Study.tsx
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    mode: initialSettings?.mode ?? 'random',
    subset: initialSettings?.subset ?? 'all',
    fastMode: initialSettings?.fastMode,
    redFocus: initialSettings?.redFocus,
  });

  // Spaced Repetition Lite state
  const [unseenCards, setUnseenCards] = useState<string[]>([]);
  const [missedCards, setMissedCards] = useState<string[]>([]);
  const [roundNumber, setRoundNumber] = useState(1);
  const [roundResults, setRoundResults] = useState<StudyResult[]>([]);

  const isFlipMode = mode === "flip";

  // List activity tracking
  const { trackListOpened, trackListStudied } = useListActivity();

  // Turma activity tracking (for professor dashboard)
  const { initTurmaTracking, updateTurmaActivity, flushActivity } = useTurmaActivity();
  const { trackCardViewed, trackAnswer, trackCompleted } = useTurmaEngagementTracking({ listId, mode });

  // Create stable signature from flashcard IDs to detect meaningful changes
  const cardsSignature = useMemo(() => 
    flashcards.map(c => c.id).sort().join("|"), 
    [flashcards]
  );

  // Canonical→playable mapping for the current deck. Favorites & Red List are
  // stored under the canonical group id (parent_card_id), but cardsOrder is
  // built from the playable entry id (layers[0].id). Without this translation
  // step, layered groups marked as red would never get the spaced-repetition
  // injection because their canonical id is absent from cardsOrder.
  const canonicalToPlayable = useMemo(
    () => buildCanonicalToPlayableMap(flashcards),
    [flashcards],
  );
  const effectiveRedPlayableIds = useMemo(
    () => mapCanonicalIdsToPlayable(redListIds, canonicalToPlayable),
    [redListIds, canonicalToPlayable],
  );

  // Session identity is stable for user + list + mode. The settings snapshot
  // below carries the queue-affecting options; changing them must not create a
  // second resumable row or silently discard the current position.
  const sessionContext = useMemo(() => ({
    mode,
    subset: gameSettings.subset ?? 'all',
    order: gameSettings.mode ?? 'random',
    redFocus: gameSettings.redFocus ?? false,
    fastMode: gameSettings.fastMode ?? false,
    studyFlowMode,
    ...sessionContextOverrides,
  }), [gameSettings.fastMode, gameSettings.mode, gameSettings.redFocus, gameSettings.subset, mode, sessionContextOverrides, studyFlowMode]);
  const sessionScopeKey = useMemo(
    () => buildStudySessionScopeKey(sessionContext),
    [sessionContext],
  );
  const legacySessionScopeKey = useMemo(
    () => buildLegacyStudySessionScopeKey(sessionContext),
    [sessionContext],
  );
  const sessionSettingsSnapshot = useMemo(
    () => buildStudySessionSettingsSnapshot(sessionContext),
    [sessionContext],
  );

  const applyRestoredSessionSettings = useCallback((session: {
    id?: unknown;
    updated_at?: unknown;
    settings_snapshot?: unknown;
  }) => {
    const snapshot = session.settings_snapshot;
    const overrides = studySessionSettingsToPresetOverride(snapshot);
    if (!overrides || typeof snapshot !== "object" || snapshot === null) return;

    const identity = `${String(session.id ?? "unknown")}:${String(session.updated_at ?? "")}:${JSON.stringify(overrides)}`;
    if (restoredSettingsIdentityRef.current === identity) return;
    restoredSettingsIdentityRef.current = identity;

    const typedSnapshot = snapshot as StudySessionSettingsSnapshot;
    setGameSettings((current) => ({
      ...current,
      mode: overrides.order ?? current.mode,
      subset: overrides.scope ?? current.subset,
      fastMode: overrides.fastMode ?? current.fastMode,
      redFocus: typedSnapshot.redFocus,
    }));
    onSessionSettingsRestored?.(typedSnapshot);
  }, [onSessionSettingsRestored]);

  // Fetch and apply settings independently of deck readiness: the saved scope
  // may be the reason the current (preset-filtered) deck is empty.
  const requestedKey = `${userScope}:${listId}:${mode}:${requestedSessionId}:${resumeAttempt}`;
  const restoreSettingsRef = useRef(applyRestoredSessionSettings);
  restoreSettingsRef.current = applyRestoredSessionSettings;
  useEffect(() => {
    if (!requestedSessionId || !userScope || !listId || !presetReady) return;
    authUserIdRef.current = userScope;
    setIsAuthenticated(true);
    const controller = new AbortController();
    runtimeWritableRef.current = false;
    void fetchRequestedStudySession<RestorableStudySession>({
      client: supabase as unknown as RequestedStudySessionClient,
      sessionId: requestedSessionId, userId: userScope, listId, mode,
      includeCompleted: true, signal: controller.signal,
    }).then(result => {
      if (controller.signal.aborted) return;
      if (result.status === "found") {
        restoreSettingsRef.current(result.session);
        setRequestedRestore({ key: requestedKey, row: result.session });
      } else if (result.status !== "cancelled") {
        const local = result.status === "unavailable"
          ? readSameSessionSnapshot(userScope, listId, mode, requestedSessionId) : null;
        if (local) {
          const row: RestorableStudySession = {
            id: requestedSessionId, cards_order: local.cardsOrder, current_index: local.currentIndex,
            session_snapshot: local.masterySnapshot ?? local, settings_snapshot: local.settingsSnapshot,
          };
          restoreSettingsRef.current(row);
          setRequestedRestore({ key: requestedKey, row });
          return;
        }
        setRequestedRestore({ key: requestedKey, error: result.status === "not-found"
          ? "study-resume-session-not-found" : "study-resume-session-unavailable" });
      }
    });
    return () => controller.abort();
  }, [requestedKey, requestedSessionId, userScope, listId, mode, presetReady]);

  const sessionWriteIdentity = `${userScope ?? "anon"}:${listId ?? "no-list"}:${mode}:${sessionScopeKey}`;
  useEffect(() => {
    if (sessionWriteIdentityRef.current !== null && sessionWriteIdentityRef.current !== sessionWriteIdentity) {
      sessionWriteQueueRef.current?.invalidate();
    }
    sessionWriteIdentityRef.current = sessionWriteIdentity;
  }, [sessionWriteIdentity]);

  const studySnapshotKey = useMemo(() => buildStudySnapshotKey({
    userScope: userScope || 'anon',
    listId: localResourceId,
    mode,
    sessionScopeKey,
    cardsSignature,
  }), [userScope, localResourceId, mode, sessionScopeKey, cardsSignature]);
  const legacyStudySnapshotKey = useMemo(() => buildLegacyStudySnapshotKey({
    userScope: userScope || 'anon',
    listId: localResourceId,
    mode,
    sessionScopeKey: legacySessionScopeKey,
    cardsSignature,
  }), [userScope, localResourceId, mode, legacySessionScopeKey, cardsSignature]);

  const masterySnapshotKey = useMemo(
    () => buildMasterySnapshotKey(studySnapshotKey),
    [studySnapshotKey],
  );

  const correctCount = results.filter((r) => r.correct && !r.skipped).length;
  const errorCount = results.filter((r) => !r.correct && !r.skipped).length;
  const skippedCount = results.filter((r) => r.skipped).length;
  const progress = cardsOrder.length > 0 ? ((currentIndex + 1) / cardsOrder.length) * 100 : 0;

  // Game is complete when all cards have been seen (straight-through: same as isFinished)
  const isGameComplete = isFinished;

  // Generate next round using Priority A + B algorithm
  const generateNextRound = useCallback(() => {
    const nextRound: string[] = [];
    
    // Priority A: All missed cards from previous rounds
    const missedToAdd = [...missedCards];
    nextRound.push(...missedToAdd.slice(0, BATCH_SIZE));
    
    // Priority B: Fill remaining slots with unseen cards
    const slotsRemaining = BATCH_SIZE - nextRound.length;
    if (slotsRemaining > 0 && unseenCards.length > 0) {
      const unseenToAdd = unseenCards.slice(0, slotsRemaining);
      nextRound.push(...unseenToAdd);
      
      // Remove from unseen pool
      setUnseenCards(prev => prev.filter(id => !unseenToAdd.includes(id)));
    }
    
    // Shuffle the round
    const shuffledRound = nextRound.sort(() => Math.random() - 0.5);
    setCardsOrder(shuffledRound);
    setCurrentIndex(0);
    setRoundNumber(prev => prev + 1);
    setRoundResults([]);
    setIsFinished(false);
    
    // Clear missed cards that are now in this round
    setMissedCards(prev => prev.filter(id => !shuffledRound.includes(id)));
    
    return shuffledRound;
  }, [missedCards, unseenCards]);

  // Local flip progress follows the same stable session identity. A legacy
  // key is read once as a compatibility fallback, then new writes converge on
  // the stable user/list/mode key.
  const flipProgressKey = useMemo(() => {
    const uid = userScope || 'anon';
    return `flip-progress-${uid}-${localResourceId ?? 'no-resource'}-${mode}-${sessionScopeKey}`;
  }, [userScope, localResourceId, mode, sessionScopeKey]);
  const legacyFlipProgressKey = useMemo(() => {
    const uid = userScope || 'anon';
    return `flip-progress-${uid}-${localResourceId ?? 'no-resource'}-${mode}-${legacySessionScopeKey}`;
  }, [userScope, localResourceId, mode, legacySessionScopeKey]);

  // Load flip mode progress from localStorage (scoped)
  const loadFlipProgress = useCallback(() => {
    if (!localResourceId) return null;
    try {
      const saved = localStorage.getItem(flipProgressKey)
        ?? localStorage.getItem(legacyFlipProgressKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading flip progress:', e);
    }
    return null;
  }, [localResourceId, flipProgressKey, legacyFlipProgressKey]);

  // Save flip mode progress to localStorage (scoped)
  const saveFlipProgress = useCallback(() => {
    if (!localResourceId || !isFlipMode) return;
    try {
      localStorage.setItem(flipProgressKey, JSON.stringify({
        index: currentIndex,
        knownCards: results.filter(r => r.correct).map(r => r.flashcardId),
        timestamp: Date.now(),
      }));
    } catch (e) {
      console.error('Error saving flip progress:', e);
    }
  }, [localResourceId, isFlipMode, currentIndex, results, flipProgressKey]);

  const getPrioritizedFlashcards = useCallback(async (
    userId: string,
    targetListId: string,
    cards: { id: string }[],
    useAll: boolean,
    signal: AbortSignal,
  ): Promise<string[]> => {
    try {
      if (FEATURE_FLAGS.intelligent_study_engine) {
        const { data: progressData } = await supabase
          .from('flashcard_progress')
          .select('flashcard_id, correct_count, incorrect_count, last_reviewed')
          .eq('user_id', userId)
          .eq('list_id', targetListId)
          .abortSignal(signal);

        const progressMap = new Map<string, CardProgressLike>(
          (progressData ?? []).map((progress) => [
            progress.flashcard_id,
            progress as CardProgressLike,
          ]),
        );
        const ordered = orderByIntelligence(
          cards,
          progressMap,
          new Set(effectiveRedPlayableIds),
        );
        return useAll ? ordered : ordered.slice(0, BATCH_SIZE);
      }

      const { data: progressData } = await supabase
        .from('flashcard_progress')
        .select('flashcard_id, incorrect_count')
        .eq('user_id', userId)
        .eq('list_id', targetListId)
        .abortSignal(signal);
      const progressMap = new Map(
        progressData?.map((progress) => [
          progress.flashcard_id,
          progress.incorrect_count,
        ]) || [],
      );
      const ordered = cards
        .map((card) => ({
          id: card.id,
          incorrectCount: progressMap.get(card.id) || 0,
        }))
        .sort((left, right) =>
          right.incorrectCount !== left.incorrectCount
            ? right.incorrectCount - left.incorrectCount
            : Math.random() - 0.5,
        )
        .map((card) => card.id);
      return useAll ? ordered : ordered.slice(0, BATCH_SIZE);
    } catch {
      const fallback = cards.map((card) => card.id).sort(() => Math.random() - 0.5);
      return useAll ? fallback : fallback.slice(0, BATCH_SIZE);
    }
  }, [effectiveRedPlayableIds]);

  // Initialization is idempotent and generation-scoped. A signature is only
  // considered complete after a playable queue (or a legitimate empty deck)
  // has been committed.
  const initializeSession = useCallback(async (force = false) => {
    if (restartInFlightRef.current) return;
    const __t0 = performance.now();
    // Skip if already initialized with same signature.
    // IMPORTANT: include sessionScopeKey so switching between "all"/"favorites"
    // (or toggling redFocus / order) re-initializes the engine and loads the
    // saved session for that scope instead of reusing the previous one.
    const initKey = [
      userScope || "anon",
      localResourceId || "no-resource",
      mode,
      studyFlowMode,
      cardsSignature,
      sessionScopeKey,
      JSON.stringify(sessionSettingsSnapshot),
      requestedSessionId ?? "",
    ].join("|");
    // Equivalent renders must not abort a pending claim or invalidate a save.
    if (!force && deckReady && completedInitSignatureRef.current === initKey
      && (!requestedSessionId || requestedRestore?.key === requestedKey)) {
      runtimeWritableRef.current = requestedRestore?.row?.completed !== true;
      setInitializationState("ready");
      setIsLoading(false);
      return;
    }
    initializationAbortRef.current?.abort();
    const abortController = new AbortController();
    initializationAbortRef.current = abortController;
    const generation = ++initializationGenerationRef.current;
    const isCurrent = () =>
      mountedRef.current && initializationGenerationRef.current === generation;
    if (requestedSessionId && (requestedRestore?.key !== requestedKey || requestedRestore.error)) {
      runtimeWritableRef.current = false;
      setInitializationState(requestedRestore?.key === requestedKey && requestedRestore.error ? "failed" : "loading");
      setIsLoading(requestedRestore?.key !== requestedKey);
      return;
    }
    if (!deckReady) {
      runtimeWritableRef.current = false;
      if (isCurrent()) {
        // Keep the committed queue through temporary scope/auth refetches.
        // The final deck signature decides whether reconciliation is needed.
        setInitializationState("loading");
        // The engine is gated by the page deck, not actively initializing.
        // Keeping this true would leave recovery actions disabled forever
        // after the deck request reaches a terminal failure.
        setIsLoading(false);
      }
      return;
    }

    const markReady = () => {
      if (!isCurrent()) return;
      completedInitSignatureRef.current = initKey;
      setInitializationState("ready");
      runtimeWritableRef.current = true;
      setIsLoading(false);
      logStudyRuntime("initialization-ready", {
        generation,
        mode,
        flow: studyFlowMode,
        cards: flashcards.length,
        durationMs: Math.round(performance.now() - __t0),
      });
    };

    completedInitSignatureRef.current = "";
    runtimeWritableRef.current = false;
    if (saveProgressTimeoutRef.current) clearTimeout(saveProgressTimeoutRef.current);
    sessionWriteQueueRef.current?.invalidate();
    setInitializationState("loading");
    setIsLoading(true);
    logStudyRuntime("initialization-start", {
      generation,
      mode,
      flow: studyFlowMode,
      cards: flashcards.length,
      forced: force,
    });
    
    if (requestedSessionId && requestedRestore?.row?.completed) {
      const restored = restoreStudySession({ session: requestedRestore.row, eligibleIds: flashcards.map(card => card.id) });
      setTrackedSessionId(requestedRestore.row.id);
      setCardsOrder(restored.snapshot.cardsOrder);
      setCurrentIndex(restored.snapshot.currentIndex);
      setResults(restored.snapshot.results);
      setIsFinished(true);
      markReady();
      runtimeWritableRef.current = false;
      return;
    }
    if (flashcards.length === 0) {
      if (isCurrent()) {
        setCardsOrder([]);
        setCurrentIndex(0);
        markReady();
      }
      return;
    }

    // Mastery rounds: use the dedicated round engine for write/mixed modes.
    // This bypasses the legacy continuous/batching path so the new flow engine
    // owns the queue, round boundaries, and repetition logic.
    if (isMasteryMode) {
      setIsAuthenticated(Boolean(userScope));
      authUserIdRef.current = userScope ?? null;
      const eligibleIds = flashcards.map((card) => card.id);
      const availableSet = new Set(eligibleIds);
      const localMastery = readMasterySnapshotWithMeta(masterySnapshotKey, availableSet);
      let restored = localMastery?.state ?? null;
      let restoredRemoteSessionId: string | null = null;
      sessionLayerRef.current = undefined;
      setRestoredSessionLayer(null);

      if (userScope && listId) {
        try {
          // A sessão pedida é consultada por ID antes de qualquer heurística de
          // recência e não é filtrada pelo preset atual.
          const requestedRow = requestedSessionId ? requestedRestore?.row : null;
          const { data: remoteSessions } = requestedSessionId
            ? { data: [] as any[] }
            : await withStudyRuntimeTimeout(
              supabase
                .from("study_sessions")
                .select("id,session_scope_key,session_snapshot,settings_snapshot,updated_at")
                .eq("user_id", userScope)
                .eq("list_id", listId)
                .eq("mode", mode)
                .eq("completed", false)
                .order("updated_at", { ascending: false })
                .limit(10)
                .abortSignal(abortController.signal),
              STUDY_REMOTE_RESTORE_TIMEOUT_MS,
              "mastery-session-restore",
              () => abortController.abort(),
            );
          const candidateRows = requestedRow
            ? [requestedRow]
            : (remoteSessions ?? []);
          const mapCandidate = (candidate: any) => ({
            id: candidate.id as string,
            scopeKey: candidate.session_scope_key as string | null,
            state: candidate.id === requestedSessionId
              ? restoreMasterySession(candidate, eligibleIds, gameSettings.mode === "random")
              : sanitizeMasterySnapshot(candidate.session_snapshot, availableSet),
            layer: sanitizeStudyLayerSnapshot(
              (candidate.session_snapshot as { layer?: unknown } | null)?.layer,
            ),
            settingsSnapshot: candidate.settings_snapshot,
            updatedAt: candidate.updated_at,
          });
          const requestedCandidate = requestedRow ? mapCandidate(requestedRow) : null;
          const fallbackCandidate = candidateRows
            .filter((candidate: any) => !requestedRow || candidate.id !== requestedRow.id)
            .map(mapCandidate)
            .filter((candidate) => isPersistedStudySessionCompatible({
              expected: sessionContext,
              sessionScopeKey: candidate.scopeKey,
              settingsSnapshot: candidate.settingsSnapshot,
            }))
            .sort((left, right) =>
              Number(right.scopeKey === sessionScopeKey) - Number(left.scopeKey === sessionScopeKey))
            .find((candidate) => candidate.state);
          // Sessão pedida vence qualquer sessão mais recente. Quando ela existe
          // mas não pode ser aberta, não caímos em outra sessão aleatória.
          const remote = requestedCandidate ?? fallbackCandidate;
          if (requestedSessionId && !remote?.state) {
            throw new Error("study-resume-session-invalid");
          }
          if (!isCurrent()) return;
          if (remote && !requestedSessionId) {
            applyRestoredSessionSettings({
              id: remote.id,
              updated_at: remote.updatedAt,
              settings_snapshot: remote.settingsSnapshot,
            });
          }
          if (remote?.layer) sessionLayerRef.current = remote.layer;
          if (remote?.layer) setRestoredSessionLayer(remote.layer);
          if (remote?.state) {
            // Precedence by recency: a session saved on another device/tab must
            // win over an older local mirror, and vice-versa.
            const remoteTimestamp = Date.parse(String(remote.updatedAt ?? ""));
            const remoteAt = Number.isFinite(remoteTimestamp) ? remoteTimestamp : 0;
            if (requestedSessionId || !restored || remoteAt > (localMastery?.savedAt ?? 0)) {
              restored = remote.state;
              restoredRemoteSessionId = remote.id;
            }
          }
        } catch {
          if (requestedSessionId) {
            setInitializationState("failed");
            setIsLoading(false);
            toast.error("N\\u00e3o foi poss\\u00edvel retomar esta sess\\u00e3o. Tente novamente.");
            return;
          }
          // Local persistence remains the safe fallback when opening normally.
        }
      }

      if (!isCurrent()) return;
      const session = restored
        ?? createMasterySession(eligibleIds, {
          shuffle: gameSettings.mode === "random",
        });
      if (restoredRemoteSessionId) setTrackedSessionId(restoredRemoteSessionId);
      setMasterySession(session);
      setCardsOrder(session.currentRoundIds);
      setCurrentIndex(session.currentRoundIndex);
      setRoundNumber(session.roundNumber);
      setRoundResults([]);
      setMissedCards([]);
      setUnseenCards([]);
      setIsFinished(session.status !== "active");
      markReady();
      if (userScope && listId && !restoredRemoteSessionId) {
        void claimAndTrackSession({
          userId: userScope,
          listId,
          mode,
          currentIndex: session.currentRoundIndex,
          cardsOrder: session.currentRoundIds,
          sessionScopeKey,
          settingsSnapshot: sessionSettingsSnapshot,
          sessionSnapshot: session,
          signal: abortController.signal,
          stage: "mastery-session-create",
        }, isCurrent).catch(() => undefined);
      }
      return;
    }

    let fallbackLocalSnapshot: ReturnType<typeof readStudySnapshot> = null;
    try {
      const user = userScope ? { id: userScope } : null;
      authUserIdRef.current = userScope ?? null;
      const snapshotCardIds = new Set(flashcards.map((card) => card.id));
      const resultCardIds = new Set([
        ...snapshotCardIds,
        ...flashcards.flatMap((card) =>
          Array.isArray((card as any).__layers)
            ? (card as any).__layers
              .map((layer: { id?: unknown }) => layer.id)
              .filter((id: unknown): id is string => typeof id === "string")
            : [],
        ),
      ]);
      const localSnapshot = readStudySnapshot(studySnapshotKey, snapshotCardIds, {
        enforceUniqueOrder: !!gameSettings.redFocus,
        resultCardIds,
      }) ?? readStudySnapshot(legacyStudySnapshotKey, snapshotCardIds, {
        enforceUniqueOrder: !!gameSettings.redFocus,
        resultCardIds,
      });
      sessionLayerRef.current = localSnapshot?.layer;
      setRestoredSessionLayer(localSnapshot?.layer ?? null);
      fallbackLocalSnapshot = localSnapshot;

      if (!user) {
        if (localSnapshot) {
          setCardsOrder(localSnapshot.cardsOrder);
          setCurrentIndex(localSnapshot.currentIndex);
          setResults(localSnapshot.results);
          toast.success("Continuando de onde você parou!");
          markReady();
          return;
        }
        setIsAuthenticated(false);

        // For flip mode without auth: use EXACT order from flashcards (already ordered by Study.tsx)
        if (isFlipMode) {
          const orderedIds = flashcards.map(f => f.id);
          setCardsOrder(orderedIds);
          setCurrentIndex(0);
          markReady();
          return;
        }

        // Standard modes respect the order chosen in the hub. Mixed mode
        // owns its adaptive order and therefore remains randomized.
        const baseIds = flashcards.map(f => f.id);
        const orderedIds = !gameSettings.redFocus && (mode === "mixed" || gameSettings.mode === "random")
          ? [...baseIds].sort(() => Math.random() - 0.5)
          : baseIds;

        setCardsOrder(orderedIds);
        setCurrentIndex(0);
        markReady();
        return;
      }

      setIsAuthenticated(true);

      if (!listId) {
        // No listId (e.g. collection or portal route) — standard modes
        // respect the order already prepared by Study.tsx.
        const baseIds = flashcards.map(f => f.id);
        const cardIds = !gameSettings.redFocus && (mode === "mixed" || gameSettings.mode === "random")
          ? [...baseIds].sort(() => Math.random() - 0.5)
          : baseIds;
        setCardsOrder(cardIds);
        setCurrentIndex(0);
        markReady();
        return;
      }

      const availableCardIds = new Set(flashcards.map((card) => card.id));

      const selectCurrentScopeSession = (sessions: any[] | null | undefined) =>
        (sessions ?? [])
          .filter((candidate) => isPersistedStudySessionCompatible({
            expected: sessionContext,
            sessionScopeKey: candidate.session_scope_key,
            settingsSnapshot: candidate.settings_snapshot,
          }))
          .sort((left, right) => {
            const leftIsCurrent = left.session_scope_key === sessionScopeKey;
            const rightIsCurrent = right.session_scope_key === sessionScopeKey;
            if (leftIsCurrent !== rightIsCurrent) return leftIsCurrent ? -1 : 1;
            return Date.parse(String(right.updated_at ?? "")) - Date.parse(String(left.updated_at ?? ""));
          })[0] ?? null;

      // A sessão pedida ("Continuar") é consultada por ID — não depende do
      // limite das dez mais recentes nem do preset atual. Suas configurações
      // são aplicadas antes do deck (applyRestoredSessionSettings).
      const requestedSessionRow = requestedSessionId ? requestedRestore?.row : null;
      const resolveSession = (sessions: any[] | null | undefined) =>
        requestedSessionId ? requestedSessionRow : selectCurrentScopeSession(sessions);

      const restoreRow = (row: RestorableStudySession) => {
        const live = liveSessionSnapshotRef.current;
        const continuing = live?.identity === `${userScope}:${listId}:${mode}:${sessionScopeKey}`
          && live.snapshot.sessionId === row.id ? live.snapshot : null;
        const restored = restoreStudySession({
          session: continuing ? { ...row, session_snapshot: continuing } : row,
          eligibleIds: flashcards.map(card => card.id),
          local: readRawStudySnapshot(studySnapshotKey) ?? readRawStudySnapshot(legacyStudySnapshotKey),
          unique: !!gameSettings.redFocus, resultCardIds,
        });
        const snapshot = { ...restored.snapshot, settingsSnapshot: sessionSettingsSnapshot };
        setTrackedSessionId(row.id);
        sessionLayerRef.current = snapshot.layer;
        setRestoredSessionLayer(snapshot.layer ?? null);
        setCardsOrder(snapshot.cardsOrder);
        setCurrentIndex(snapshot.currentIndex);
        setResults(snapshot.results);
        setRoundNumber(snapshot.roundNumber ?? 1);
        setRoundResults(snapshot.roundResults ?? []);
        setUnseenCards(snapshot.unseenCards ?? []);
        setMissedCards(snapshot.missedCards ?? []);
        setIsFinished(row.completed === true || snapshot.isFinished === true);
        writeStudySnapshot(studySnapshotKey, snapshot);
        logStudyRuntime("session-restored", {
          requestedSessionId, sessionId: row.id, source: restored.source,
          cardsOrderLength: snapshot.cardsOrder.length, eligibleCardIdsLength: availableCardIds.size,
          currentIndex: snapshot.currentIndex, repaired: restored.repaired,
        });
        if (snapshot.cardsOrder.length) {
          void sessionWriteQueueRef.current?.enqueue({
            sessionId: row.id, userId: user.id, listId, mode, sessionScopeKey,
            payload: {
              cards_order: snapshot.cardsOrder, current_index: snapshot.currentIndex,
              session_snapshot: snapshot, session_scope_key: sessionScopeKey,
              settings_snapshot: sessionSettingsSnapshot,
              client_revision: nextStudySessionRevision(sessionRevisionRef),
              updated_at: new Date().toISOString(),
            },
            stage: "session-restore-repair",
          }).catch(() => toast.warning("Sessão recuperada neste aparelho; sincronização pendente."));
        }
        markReady();
      };

      // Track that the user opened this list
      trackListOpened(listId);

      // Classroom tracking is useful but not required to render the first card.
      void withStudyRuntimeTimeout(
        initTurmaTracking(listId),
        STUDY_REMOTE_RESTORE_TIMEOUT_MS,
        "turma-tracking",
      ).catch(() => undefined);

      // For flip mode: use EXACT order from flashcards (Study.tsx already applied random/sequential)
      if (isFlipMode) {
        // Try to restore from database first (for session continuity).
        // We fetch the recent open sessions and pick the one whose card-set
        // matches the current scope, so "all" and "favorites" stay isolated.
        const { data: openSessions } = requestedSessionId
          ? { data: [] as any[] }
          : await withStudyRuntimeTimeout(
            supabase
              .from('study_sessions')
              .select('*')
              .eq('user_id', user.id)
              .eq('list_id', listId)
              .eq('mode', mode)
               .eq('completed', false)
              .order('updated_at', { ascending: false })
              .limit(10)
              .abortSignal(abortController.signal),
            STUDY_REMOTE_RESTORE_TIMEOUT_MS,
            "flip-session-restore",
            () => abortController.abort(),
          );
        if (!isCurrent()) return;

        const matchingSession = resolveSession(openSessions);

        if (matchingSession) {
          restoreRow(matchingSession);
          return;
        }

        // Fallback to localStorage if no database session
        const savedProgress = loadFlipProgress();
        
        // CRITICAL FIX: Use the exact order from flashcards passed by Study.tsx
        // Study.tsx already applied random/sequential ordering before passing here
        const orderedCards = localSnapshot?.cardsOrder ?? flashcards.map(f => f.id);
        const restoredIndex = localSnapshot?.currentIndex ?? savedProgress?.index ?? 0;
        
        setCardsOrder(orderedCards);
        setRoundNumber(localSnapshot?.roundNumber ?? 1);
        setRoundResults(localSnapshot?.roundResults ?? []);
        setUnseenCards(localSnapshot?.unseenCards ?? []);
        setMissedCards(localSnapshot?.missedCards ?? []);
        setIsFinished(localSnapshot?.isFinished ?? false);
        
        if (localSnapshot) {
          setCurrentIndex(restoredIndex);
          setResults(localSnapshot.results);
          toast.success("Continuando de onde você parou!");
        } else if (savedProgress && savedProgress.index < orderedCards.length) {
          setCurrentIndex(savedProgress.index);
          const restoredResults = savedProgress.knownCards?.map((id: string) => ({
            flashcardId: id,
            correct: true,
            skipped: false,
            attempts: 1,
          })) || [];
          setResults(restoredResults);
          toast.success("Continuando de onde você parou!");
        } else {
          setCurrentIndex(0);
        }
        markReady();

        void claimAndTrackSession({
          userId: user.id,
          listId,
          mode,
          currentIndex: restoredIndex,
          cardsOrder: orderedCards,
          sessionScopeKey,
          settingsSnapshot: sessionSettingsSnapshot,
          sessionSnapshot: buildStudyProgressSnapshot({
            sessionId: null,
            currentIndex: restoredIndex,
            cardsOrder: orderedCards,
            results: localSnapshot?.results ?? [],
            layer: sessionLayerRef.current,
            roundNumber: localSnapshot?.roundNumber ?? 1,
            roundResults: localSnapshot?.roundResults ?? [],
            unseenCards: localSnapshot?.unseenCards ?? [],
            missedCards: localSnapshot?.missedCards ?? [],
            isFinished: localSnapshot?.isFinished ?? false,
          }),
          signal: abortController.signal,
          stage: "flip-session-create",
        }, isCurrent).catch(() => undefined);
        return;
      }

      // For quiz modes: pick the open session whose card-set matches the
      // current scope. This keeps "all" and "favorites" (and redFocus) on
      // separate persisted rows so toggling between them never zeroes the
      // other trail.
      const { data: openSessions } = requestedSessionId
        ? { data: [] as any[] }
        : await withStudyRuntimeTimeout(
          supabase
            .from('study_sessions')
            .select('*')
            .eq('user_id', user.id)
            .eq('list_id', listId)
            .eq('mode', mode)
             .eq('completed', false)
            .order('updated_at', { ascending: false })
            .limit(10)
            .abortSignal(abortController.signal),
          STUDY_REMOTE_RESTORE_TIMEOUT_MS,
          "quiz-session-restore",
          () => abortController.abort(),
        );
      if (!isCurrent()) return;

      const matchingSession = resolveSession(openSessions);

      if (matchingSession) {
        restoreRow(matchingSession);
        return;
      }

      // Create new session with ALL flashcards (straight-through, no batching)
      let orderedCards = localSnapshot?.cardsOrder
        ?? (mode === "mixed" && !gameSettings.redFocus
          ? await withStudyRuntimeTimeout(
              getPrioritizedFlashcards(
                user.id,
                listId,
                flashcards,
                true,
                abortController.signal,
              ),
              STUDY_REMOTE_RESTORE_TIMEOUT_MS,
              "progress-prioritization",
              () => abortController.abort(),
            )
          : gameSettings.mode === "sequential"
            ? flashcards.map(card => card.id)
            : flashcards.map(card => card.id).sort(() => Math.random() - 0.5));
      // A restored snapshot already contains its exact repetition order.
      if (!localSnapshot) {
        orderedCards = injectRedListRepetitions(
          orderedCards,
          effectiveRedPlayableIds,
          shouldInjectRedPriority(gameSettings),
        );
      }
      
      setCardsOrder(orderedCards);
      setCurrentIndex(localSnapshot?.currentIndex ?? 0);
      setRoundNumber(localSnapshot?.roundNumber ?? 1);
      setRoundResults(localSnapshot?.roundResults ?? []);
      setUnseenCards(localSnapshot?.unseenCards ?? []);
      setMissedCards(localSnapshot?.missedCards ?? []);
      setIsFinished(localSnapshot?.isFinished ?? false);
      if (localSnapshot) {
        setResults(localSnapshot.results);
        toast.success("Continuando de onde você parou!");
      }
      markReady();

      void claimAndTrackSession({
        userId: user.id,
        listId,
        mode,
        currentIndex: localSnapshot?.currentIndex ?? 0,
        cardsOrder: orderedCards,
        sessionScopeKey,
        settingsSnapshot: sessionSettingsSnapshot,
        sessionSnapshot: buildStudyProgressSnapshot({
          sessionId: null,
          currentIndex: localSnapshot?.currentIndex ?? 0,
          cardsOrder: orderedCards,
          results: localSnapshot?.results ?? [],
          layer: sessionLayerRef.current,
          roundNumber: localSnapshot?.roundNumber ?? 1,
          roundResults: localSnapshot?.roundResults ?? [],
          unseenCards: localSnapshot?.unseenCards ?? [],
          missedCards: localSnapshot?.missedCards ?? [],
          isFinished: localSnapshot?.isFinished ?? false,
        }),
        signal: abortController.signal,
        stage: "quiz-session-create",
      }, isCurrent).catch(() => undefined);
    } catch (error) {
      if (!isCurrent()) return;
      if (requestedSessionId) {
        setInitializationState("failed");
        setIsLoading(false);
        toast.error("N\\u00e3o foi poss\\u00edvel retomar esta sess\\u00e3o. Tente novamente.");
        return;
      }
      logStudyRuntime("initialization-fallback", {
        generation,
        mode,
        reason: error instanceof Error ? error.name : "unknown",
      });
      const baseIds = flashcards.map(f => f.id);
      const fallbackIds = fallbackLocalSnapshot?.cardsOrder
        ?? (!gameSettings.redFocus && (mode === "mixed" || gameSettings.mode === "random")
          ? [...baseIds].sort(() => Math.random() - 0.5)
          : baseIds);
      
      setCardsOrder(fallbackIds);
      setCurrentIndex(fallbackLocalSnapshot?.currentIndex ?? 0);
      setResults(fallbackLocalSnapshot?.results ?? []);
      if (fallbackIds.length > 0) {
        // A remote restore failure is recoverable when the already-loaded deck
        // can still form a valid queue. Do not confuse that fallback with a
        // failed initialization, but also never report ready with an empty
        // order: the readiness layer would otherwise hide a real failure.
        markReady();
      } else {
        setInitializationState("failed");
        setIsLoading(false);
      }
    } finally {
      perfLog("useStudyEngine.initializeSession", __t0, { listId, mode, cards: flashcards.length });
    }
    // Includes gameSettings.subset and redListIds because they materially affect
    // the cardsOrder shape (favorites scope + red-list spaced repetition injection).
  }, [
    cardsSignature,
    claimAndTrackSession,
    deckReady,
    effectiveRedPlayableIds,
    flashcards,
    gameSettings,
    getPrioritizedFlashcards,
    initTurmaTracking,
    isFlipMode,
    isMasteryMode,
    listId,
    localResourceId,
    legacyStudySnapshotKey,
    loadFlipProgress,
    masterySnapshotKey,
    mode,
    sessionScopeKey,
    sessionSettingsSnapshot,
    setTrackedSessionId,
    requestedSessionId,
    requestedRestore,
    requestedKey,
    sessionContext,
    studyFlowMode,
    studySnapshotKey,
    trackListOpened,
    applyRestoredSessionSettings,
    userScope,
  ]);

  const retryInitialization = useCallback(() => {
    liveSessionSnapshotRef.current = null;
    completedInitSignatureRef.current = "";
    if (requestedSessionId) {
      restoredSettingsIdentityRef.current = null;
      setResumeAttempt(attempt => attempt + 1);
    } else {
      void initializeSession(true);
    }
  }, [initializeSession, requestedSessionId]);

  const startFreshSession = useCallback(async () => {
    if (isRestarting || restartInFlightRef.current) return;
    restartInFlightRef.current = true;

    if (!sessionIdRef.current && pendingSessionClaimRef.current) {
      await pendingSessionClaimRef.current.catch(() => null);
    }
    const previousSessionId = sessionIdRef.current ?? sessionId;
    const remoteUserId = authUserIdRef.current;

    // Invalidate every in-flight initializer before touching local state. A
    // late insert from the old generation must never resurrect the discarded
    // session after the user explicitly chose "começar do zero".
    initializationAbortRef.current?.abort();
    initializationGenerationRef.current += 1;
    sessionWriteQueueRef.current?.invalidate();
    await sessionWriteQueueRef.current?.drain();
    completedInitSignatureRef.current = "";
    sessionLayerRef.current = undefined;
    setIsRestarting(true);

    // Closing the old row is a safety boundary: if it cannot be confirmed,
    // keep the current session intact rather than creating two resumable rows.
    if (previousSessionId && isAuthenticated && remoteUserId && listId) {
      try {
        const controller = new AbortController();
        const { data: closedSession, error } = await withStudyRuntimeTimeout(
          supabase
            .from('study_sessions')
            .update({ completed: true, updated_at: new Date().toISOString() })
            .eq('id', previousSessionId)
            .eq('user_id', remoteUserId)
            .eq('list_id', listId)
            .eq('mode', mode)
            .select('id')
          .abortSignal(controller.signal)
            .maybeSingle(),
          STUDY_REMOTE_RESTORE_TIMEOUT_MS,
          'fresh-close-previous-session',
          () => controller.abort(),
        );
        if (error) throw error;
        if (!closedSession?.id) throw new Error('fresh-close-previous-session-unconfirmed');
      } catch (error) {
        console.error('[StudyEngine] Não foi possível fechar a sessão anterior:', error);
        toast.error('Não foi possível iniciar uma sessão nova com segurança. Tente novamente.');
        setIsRestarting(false);
        restartInFlightRef.current = false;
        return;
      }
    }

    setDismissedResumeId(requestedSessionIdInput ?? null);
    liveSessionSnapshotRef.current = null;
    clearStudySnapshot(studySnapshotKey);
    clearMasterySnapshot(masterySnapshotKey);
    clearStudyLayerSnapshot(studySnapshotKey);
    if (listId && isFlipMode) {
      try {
        localStorage.removeItem(flipProgressKey);
        localStorage.removeItem(legacyFlipProgressKey);
      } catch {}
    }

    setTrackedSessionId(null);
    setResults([]);
    setRoundResults([]);
    setMissedCards([]);
    setUnseenCards([]);
    setRoundNumber(1);
    setIsFinished(false);

    const eligibleIds = flashcards.map((card) => card.id);
    let freshMastery: MasterySessionState | null = null;
    let freshCardsOrder = eligibleIds;
    if (isMasteryMode) {
      freshMastery = createMasterySession(eligibleIds, {
        shuffle: gameSettings.mode === "random",
      });
      setMasterySession(freshMastery);
      freshCardsOrder = freshMastery.currentRoundIds;
      setCardsOrder(freshCardsOrder);
      setCurrentIndex(freshMastery.currentRoundIndex);
    } else {
      const baseOrder =
        gameSettings.mode === "random" && !gameSettings.redFocus
          ? [...eligibleIds].sort(() => Math.random() - 0.5)
          : eligibleIds;
      setMasterySession(null);
      freshCardsOrder = injectRedListRepetitions(
        baseOrder,
        effectiveRedPlayableIds,
        shouldInjectRedPriority(gameSettings),
      );
      setCardsOrder(freshCardsOrder);
      setCurrentIndex(0);
    }
    setInitializationState(eligibleIds.length > 0 ? "ready" : "failed");
    runtimeWritableRef.current = eligibleIds.length > 0;
    setIsLoading(false);

    // A new row is created only after the previous row was confirmed closed.
    // If this best-effort creation is unavailable, the local session remains
    // usable and the user gets an explicit warning instead of a false resume.
    if (isAuthenticated && remoteUserId && listId && eligibleIds.length > 0) {
      try {
        const controller = new AbortController();
        await claimAndTrackSession({
          userId: remoteUserId,
          listId,
          mode,
          currentIndex: 0,
          cardsOrder: freshCardsOrder,
          sessionScopeKey,
          settingsSnapshot: sessionSettingsSnapshot,
          sessionSnapshot: freshMastery ?? buildStudyProgressSnapshot({
            sessionId: null,
            currentIndex: 0,
            cardsOrder: freshCardsOrder,
            results: [],
            layer: sessionLayerRef.current,
            roundNumber: 1,
            roundResults: [],
            unseenCards: [],
            missedCards: [],
            isFinished: false,
          }),
          signal: controller.signal,
          stage: 'fresh-create-session',
        });
      } catch (error) {
        console.warn('[StudyEngine] Sessão nova ficou apenas local:', error);
        toast.warning('O jogo reiniciou neste aparelho, mas a sincronização online falhou.');
      }
    }

    setIsRestarting(false);
    restartInFlightRef.current = false;
    logStudyRuntime("fresh-session-recovery", {
      mode,
      flow: studyFlowMode,
      cards: eligibleIds.length,
    });
  }, [
    effectiveRedPlayableIds,
    requestedSessionIdInput,
    claimAndTrackSession,
    flashcards,
    flipProgressKey,
    legacyFlipProgressKey,
    gameSettings,
    isAuthenticated,
    isRestarting,
    isFlipMode,
    isMasteryMode,
    listId,
    masterySnapshotKey,
    mode,
    sessionId,
    sessionScopeKey,
    sessionSettingsSnapshot,
    setTrackedSessionId,
    studyFlowMode,
    studySnapshotKey,
  ]);
  
  // Store flashcards in a ref for stable access
  const flashcardsRef = useRef(flashcards);
  useEffect(() => {
    flashcardsRef.current = flashcards;
  }, [flashcards]);

  // Save progress with debounce to reduce DB writes
  const saveProgress = useCallback(async () => {
    if (!runtimeWritableRef.current || cardsOrder.length === 0) return;
    const scheduledSessionId = sessionIdRef.current;
    const scheduledUserId = authUserIdRef.current;
    const scheduledGeneration = initializationGenerationRef.current;
    // Clear any pending save
    if (saveProgressTimeoutRef.current) {
      clearTimeout(saveProgressTimeoutRef.current);
    }
    
    // Debounce by 500ms
    saveProgressTimeoutRef.current = setTimeout(async () => {
      const userId = scheduledUserId;
      const activeSessionId = scheduledSessionId;
      if (!runtimeWritableRef.current || scheduledGeneration !== initializationGenerationRef.current
        || activeSessionId !== sessionIdRef.current || userId !== authUserIdRef.current) return;
      if (!activeSessionId || !listId || !userId) return;

      const payload: Record<string, unknown> = {
        current_index: currentIndex,
        cards_order: cardsOrder,
        ...(!isMasteryMode
          ? {
            session_snapshot: buildStudyProgressSnapshot({
              sessionId: activeSessionId,
              currentIndex,
              cardsOrder,
              results,
              layer: sessionLayerRef.current,
              roundNumber,
              roundResults,
              unseenCards,
              missedCards,
              isFinished,
            }),
          }
          : {}),
        session_scope_key: sessionScopeKey,
        settings_snapshot: sessionSettingsSnapshot,
        client_revision: nextStudySessionRevision(sessionRevisionRef),
        updated_at: new Date().toISOString(),
      };

      try {
        await sessionWriteQueueRef.current?.enqueue({
          sessionId: activeSessionId,
          userId,
          listId,
          mode,
          sessionScopeKey,
          payload,
          stage: "debounced-save-progress",
        });
      } catch (error) {
        console.warn('[StudyEngine] Salvamento remoto pendente:', error);
      }
    }, 500);
  }, [cardsOrder, currentIndex, isMasteryMode, listId, mode, results, sessionScopeKey, sessionSettingsSnapshot]);

  // Flush buffered progress to database
  const flushProgressBuffer = useCallback(async () => {
    if (progressFlushInFlightRef.current) {
      await progressFlushInFlightRef.current;
      return;
    }
    const userId = authUserIdRef.current;
    if (!listId || !userId || progressBufferRef.current.length === 0) return;

    const entries = progressBufferRef.current.splice(0);
    const flush = (async () => {
      const groupedEntries = new Map<string, Array<{ entry: PendingProgressEntry; index: number }>>();
      entries.forEach((entry, index) => {
        const key = `${entry.userId}:${entry.flashcardId}`;
        const group = groupedEntries.get(key) ?? [];
        group.push({ entry, index });
        groupedEntries.set(key, group);
      });
      const outcomes: Array<PromiseSettledResult<unknown> | undefined> = new Array(entries.length);
      await Promise.all(Array.from(groupedEntries.values()).map(async (group) => {
        for (const { entry, index } of group) {
          try {
            const result = await recordStudyProgressAttempt(entry);
            outcomes[index] = {
              status: "fulfilled",
              value: result,
            };
            await markStudyProgressSuccess(entry.operationId).catch(() => undefined);
          } catch (reason) {
            outcomes[index] = { status: "rejected", reason };
          }
        }
      }));
      const failedEntries = entries.filter((_, index) => outcomes[index]?.status === "rejected");
      if (failedEntries.length > 0) {
        progressBufferRef.current = [...failedEntries, ...progressBufferRef.current];
        const firstFailure = outcomes.find(
          (outcome): outcome is PromiseRejectedResult => outcome?.status === "rejected",
        );
        console.warn(
          "[StudyEngine] Progresso remoto pendente após falha:",
          firstFailure?.reason,
        );
      }
    })();
    progressFlushInFlightRef.current = flush;
    try {
      await flush;
    } finally {
      if (progressFlushInFlightRef.current === flush) {
        progressFlushInFlightRef.current = null;
      }
    }
  }, [listId]);

  // Schedule flush with debounce (every 5 seconds or 10 cards)
  const scheduleFlush = useCallback(() => {
    const FLUSH_INTERVAL_MS = 5000; // 5 seconds
    const FLUSH_CARD_THRESHOLD = 10;

    // Clear existing timeout
    if (flushProgressTimeoutRef.current) {
      clearTimeout(flushProgressTimeoutRef.current);
    }

    // Flush immediately if buffer is large enough
    if (progressBufferRef.current.length >= FLUSH_CARD_THRESHOLD) {
      void flushProgressBuffer();
      return;
    }

    // Otherwise schedule a flush
    flushProgressTimeoutRef.current = setTimeout(() => {
      flushProgressBuffer();
    }, FLUSH_INTERVAL_MS);
  }, [flushProgressBuffer]);

  /**
   * Replays writes that survived a tab close or a network interruption. This
   * is intentionally scoped by the authenticated account; a new login can
   * never drain another account's study data.
   */
  const flushPersistedStudyOutbox = useCallback(async () => {
    const userId = authUserIdRef.current;
    if (!userId) return;

    try {
      await requeueStudyOutbox(userId);
    } catch {
      return;
    }

    const sessions = await listPendingStudySessionSnapshots(userId).catch(() => []);
    for (const record of sessions) {
      try {
        const result = await persistStudySession({
          sessionId: record.sessionId,
          userId: record.userId,
          listId: record.listId,
          mode: record.mode,
          revision: record.revision,
          payload: record.payload,
          stage: "study-outbox-session-replay",
        });
        // A false CAS result means another tab already has a newer snapshot;
        // retaining this stale item would only replay it forever.
        await markStudySessionSnapshotSuccess(record.key, record.revision);
        if (import.meta.env.DEV) {
          logStudyRuntime("outbox-session-replay", {
            sessionId: record.sessionId,
            mode: record.mode,
            revision: record.revision,
            accepted: result.accepted,
          });
        }
      } catch (error) {
        await markStudySessionSnapshotFailed(record.key, record.revision, error).catch(() => undefined);
      }
    }

    const progress = await listPendingStudyProgress(userId).catch(() => []);
    for (const record of progress) {
      try {
        await recordStudyProgressAttempt({
          userId: record.userId,
          flashcardId: record.flashcardId,
          listId: record.listId,
          correct: record.correct,
          operationId: record.operationId,
        });
        await markStudyProgressSuccess(record.operationId);
      } catch (error) {
        await markStudyProgressFailed(record.operationId, error).catch(() => undefined);
      }
    }
  }, []);

  // Record result and buffer flashcard progress for batch save
  const recordResult = useCallback(async (
    flashcardId: string,
    correct: boolean,
    skipped: boolean = false,
    engineCardId: string = flashcardId,
  ) => {
    // Mastery rounds: drive the dedicated flow engine so round boundaries and
    // repetition logic stay centralized in studySessionFlow.ts.
    if (isMasteryMode) {
      const currentMasteryCardId = masterySession ? getCurrentCardId(masterySession) : null;
      if (!currentMasteryCardId || currentMasteryCardId !== engineCardId || !masterySession) return;
      const masteryAnswerKey = `${masterySession.roundNumber}:${masterySession.currentRoundIndex}:${engineCardId}`;
      const lastAnswer = masteryAnswerGuardRef.current;
      if (lastAnswer?.session === masterySession && lastAnswer.key === masteryAnswerKey) return;
      masteryAnswerGuardRef.current = { session: masterySession, key: masteryAnswerKey };

      const resultType: StudyCardResult = skipped ? "skipped" : correct ? "correct" : "incorrect";
      setMasterySession((prev) => {
        if (!prev) return prev;
        const currentCardId = getCurrentCardId(prev);
        // Use the submitted identity as an advance gate. A repeated click or
        // duplicated keyboard event must never answer the following card.
        if (!currentCardId || currentCardId !== engineCardId) return prev;
        return recordMasteryResult({
          ...prev,
          currentRoundIds: [...prev.currentRoundIds],
          unseenIds: [...prev.unseenIds],
          retryIds: [...prev.retryIds],
          masteredIds: [...prev.masteredIds],
          attemptsByCard: { ...prev.attemptsByCard },
          mistakesByCard: { ...prev.mistakesByCard },
          correctThisRoundIds: [...prev.correctThisRoundIds],
          failedThisRoundIds: [...prev.failedThisRoundIds],
          reviewSourceThisRound: [...prev.reviewSourceThisRound],
          currentRoundResults: { ...prev.currentRoundResults },
        }, engineCardId, resultType);
      });
    }

    // Update results
    setResults((prev) => {
      const existing = prev.find((r) => r.flashcardId === flashcardId);
      if (existing) {
        return prev.map((r) =>
          r.flashcardId === flashcardId
            ? { ...r, correct, skipped, attempts: r.attempts + 1 }
            : r
        );
      }
      return [...prev, { flashcardId, correct, skipped, attempts: 1 }];
    });

    // Update round results for spaced repetition
    setRoundResults((prev) => {
      const existing = prev.find((r) => r.flashcardId === flashcardId);
      if (existing) {
        return prev.map((r) =>
          r.flashcardId === flashcardId
            ? { ...r, correct, skipped, attempts: r.attempts + 1 }
            : r
        );
      }
      return [...prev, { flashcardId, correct, skipped, attempts: 1 }];
    });

    // Straight-through: no missed-card recycling within the same run
    // (missed tracking disabled for standard modes)

    // V2 — Intelligent dynamic re-injection: when a non-flip card is missed,
    // schedule it ~5 slots ahead so the user retries it before the run ends.
    // Pure positional update; does not touch persistence or counters.
    if (
      FEATURE_FLAGS.intelligent_study_engine &&
      mode === "mixed" &&
      !gameSettings.redFocus &&
      !skipped &&
      !correct
    ) {
      setCardsOrder((prev) =>
        reinjectFailedCard(prev, currentIndex, flashcardId, 5, 3)
      );
    }

    trackAnswer(flashcardId, correct, skipped);

    // Persist the exact card result for the server-authoritative PiteCOIN
    // settlement. The write is queued so the UI stays responsive, then all
    // pending writes are flushed before the session reward is calculated.
    const answerSessionId = sessionIdRef.current
      ?? (pendingSessionClaimRef.current
        ? await pendingSessionClaimRef.current.catch(() => null)
        : null);
    if (isAuthenticated && answerSessionId && FEATURE_FLAGS.economy_enabled) {
      const write = recordStudyAnswer(answerSessionId, flashcardId, correct, skipped);
      pitecoinWritesRef.current.add(write);
      void write
        .then((result) => {
          if (!result.success) {
            console.warn('[PiteCOIN] Answer not recorded:', result.error);
          }
        })
        .finally(() => pitecoinWritesRef.current.delete(write));
    }

    if (!isAuthenticated || !listId || skipped) return;

    // Track study activity (debounced by the hook)
    trackListStudied(listId);

    // Buffer the progress update instead of writing immediately
    const progressUserId = authUserIdRef.current;
    if (!progressUserId) return;
    const progressEntry: PendingProgressEntry = {
      userId: progressUserId,
      flashcardId,
      listId,
      correct,
      operationId: createStudyProgressOperationId(),
      timestamp: Date.now(),
    };
    // Write the event to the durable outbox before relying on the in-memory
    // buffer. A failed IndexedDB write is non-fatal; the current tab still
    // retains the previous in-memory behavior and retries on the next event.
    await enqueueStudyProgress(progressEntry).catch(() => undefined);
    progressBufferRef.current.push(progressEntry);
    scheduleFlush();

    // Update turma activity (debounced internally)
    updateTurmaActivity({
      listId,
      mode,
      totalCards: cardsOrder.length,
      currentIndex
    });
  }, [listId, isAuthenticated, isMasteryMode, masterySession, trackListStudied, scheduleFlush, updateTurmaActivity, trackAnswer, mode, cardsOrder.length, currentIndex, gameSettings.redFocus]);

  const goToNext = useCallback(() => {
    if (isMasteryMode) {
      // recordResult owns card advancement atomically. A finished round waits
      // on the summary screen until the user explicitly starts the next one.
      return;
    }
    if (currentIndex < cardsOrder.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // NO AUTO-COMPLETE: Just set isFinished, let user click "Concluir" manually
      setIsFinished(true);
    }
  }, [currentIndex, cardsOrder.length, isMasteryMode]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  // Navigate without recording result (for arrow navigation in flip mode)
  const navigateNext = useCallback(() => {
    if (currentIndex < cardsOrder.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // NO AUTO-COMPLETE: Just set isFinished
      setIsFinished(true);
    }
  }, [currentIndex, cardsOrder.length]);

  const navigatePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  // Start next round (for quiz modes)
  const startNextRound = useCallback(() => {
    if (isMasteryMode) {
      if (!masterySession || masterySession.status !== "round-complete") return;
      if (masteryRoundStartGuardRef.current === masterySession) return;
      masteryRoundStartGuardRef.current = masterySession;

      const sessionAtStart = masterySession;
      const nextRoundState = startNextMasteryRound({
        ...sessionAtStart,
        currentRoundIds: [...sessionAtStart.currentRoundIds],
        unseenIds: [...sessionAtStart.unseenIds],
        retryIds: [...sessionAtStart.retryIds],
        masteredIds: [...sessionAtStart.masteredIds],
      });

      setMasterySession((prev) => {
        if (!prev || prev !== sessionAtStart || prev.status !== "round-complete") return prev;
        return nextRoundState;
      });
      setRoundResults([]);
      setIsFinished(nextRoundState.status !== "active");
      if (nextRoundState.status === "active") {
        toast.info(`Rodada ${nextRoundState.roundNumber} iniciada!`);
      }
      return;
    }
    if (isGameComplete) {
      toast.success("Parabéns! Você completou todos os cards! 🎉");
      return;
    }
    
    const newRound = generateNextRound();
    if (newRound.length === 0) {
      toast.success("Parabéns! Você completou todos os cards! 🎉");
      setIsFinished(true);
    } else {
      toast.info(`Rodada ${roundNumber + 1} iniciada!`);
    }
  }, [generateNextRound, isGameComplete, roundNumber, isMasteryMode, masterySession]);

  const completeSession = useCallback(async (): Promise<boolean> => {
    if (completionInFlightRef.current) return false;
    completionInFlightRef.current = true;
    setIsCompleting(true);

    try {
      await flushProgressBuffer();
      if (progressBufferRef.current.length > 0) {
        toast.error('O progresso ainda não foi sincronizado. Tente concluir novamente quando a conexão voltar.');
        return false;
      }
      // Do not mark the session complete while an older snapshot update is
      // still in flight. The queue serializes the final session state first.
      await sessionWriteQueueRef.current?.drain();
      // A fast run can finish before the asynchronous claim has caused a
      // React render. Await that claim before settling or clearing local
      // state, otherwise the durable row remains open and resume loses status.
      if (!sessionIdRef.current && pendingSessionClaimRef.current) {
        await pendingSessionClaimRef.current.catch(() => null);
      }
      const activeSessionId = sessionIdRef.current;
      const userId = authUserIdRef.current;

      if (isAuthenticated && activeSessionId) {
        // The reward RPC owns the final settlement and must run before the
        // session is hidden from the active-session pool. Flush every answer
        // write first so the final card is never lost in a race.
        if (FEATURE_FLAGS.economy_enabled) {
          await withStudyRuntimeTimeout(
            Promise.allSettled(Array.from(pitecoinWritesRef.current)),
            STUDY_REMOTE_RESTORE_TIMEOUT_MS,
            'answer-writes-before-settlement',
          ).catch((error) => {
            console.warn('[StudyEngine] Algumas respostas ainda estão sincronizando:', error);
          });
          const reward = await withStudyRuntimeTimeout(
            settleStudySession(activeSessionId, true),
            STUDY_REMOTE_RESTORE_TIMEOUT_MS,
            'settle-study-session',
          ).catch((error) => {
            console.warn('[StudyEngine] Recompensa pendente; a sessão continuará sendo concluída:', error);
            return {
              success: false,
              ptsAwarded: 0,
              xpAwarded: 0,
              pitecoinAwarded: 0,
              alreadyProcessed: false,
              error: 'SETTLEMENT_TIMEOUT',
            };
          });

          if (reward.success && !reward.alreadyProcessed) {
            const pieces = [
              reward.pitecoinAwarded > 0 ? '+₱' + reward.pitecoinAwarded : null,
              reward.ptsAwarded > 0 ? '+' + reward.ptsAwarded + ' PTS' : null,
              reward.xpAwarded > 0 ? '+' + reward.xpAwarded + ' XP' : null,
            ].filter(Boolean);
            if (pieces.length > 0) {
              toast.success('Recompensa recebida: ' + pieces.join(' · '), { duration: 6000 });
            }
          } else if (!reward.success && reward.error) {
            const messages: Record<string, string> = {
              LIST_TOO_SHORT: 'Esta lista precisa ter pelo menos 5 cards para gerar recompensa.',
              SESSION_TOO_SHORT: 'Pratique pelo menos 5 cards antes de receber recompensa.',
              SESSION_NOT_FOUND: 'A sessão foi concluída, mas a recompensa não encontrou o registro ativo.',
            };
            toast.info(messages[reward.error] ?? 'Sessão concluída sem recompensa desta vez.');
          }
        }

        // Harmless fallback for environments where the reward RPC only
        // calculates values but does not mark the session itself.
        const completionController = new AbortController();
        const { data: completedSession, error: completionError } = await withStudyRuntimeTimeout(
          supabase
            .from('study_sessions')
            .update({ completed: true, updated_at: new Date().toISOString() })
            .eq('id', activeSessionId)
            .eq('user_id', userId)
            .eq('list_id', listId)
            .eq('mode', mode)
            .select('id')
          .abortSignal(completionController.signal)
            .maybeSingle(),
          STUDY_REMOTE_RESTORE_TIMEOUT_MS,
          'complete-study-session',
          () => completionController.abort(),
        );
        if (completionError) throw completionError;
        if (!completedSession?.id) throw new Error('complete-study-session-unconfirmed');

        if (userId && listId) {
          try {
            const urlParams = new URLSearchParams(window.location.search);
            const fromStepId = urlParams.get('from_step');
            const result = await withStudyRuntimeTimeout(
              updateGoalProgress(userId, activeSessionId, listId, mode, fromStepId),
              STUDY_REMOTE_RESTORE_TIMEOUT_MS,
              'update-goal-progress',
            );
            if (result.updated) {
              if (result.goalCompleted) toast.success("🎯 Meta concluída! Parabéns!");
              else if (result.stepInfo) toast.info(`Meta atualizada: Etapa (${result.stepInfo})`);
            }
          } catch (goalError) {
            console.error('Erro ao atualizar progresso de metas:', goalError);
          }
        }
      }

      if (isAuthenticated && listId) {
        try {
        const listController = new AbortController();
        await withStudyRuntimeTimeout(
          supabase
            .from('lists')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', listId)
            .abortSignal(listController.signal),
          STUDY_REMOTE_RESTORE_TIMEOUT_MS,
          'touch-study-list',
          () => listController.abort(),
        );
        const listReadController = new AbortController();
        const { data: listData } = await withStudyRuntimeTimeout(
          supabase
            .from('lists')
            .select('folder_id')
            .eq('id', listId)
          .abortSignal(listReadController.signal)
            .maybeSingle(),
          STUDY_REMOTE_RESTORE_TIMEOUT_MS,
          'read-study-folder',
          () => listReadController.abort(),
        );
        if (listData?.folder_id) {
          const folderController = new AbortController();
          await withStudyRuntimeTimeout(
            supabase
              .from('folders')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', listData.folder_id)
              .abortSignal(folderController.signal),
            STUDY_REMOTE_RESTORE_TIMEOUT_MS,
            'touch-study-folder',
            () => folderController.abort(),
          );
        }
        } catch (metadataError) {
          // Folder/list timestamps are secondary metadata. Never turn a
          // completed study session into a stuck completion screen because
          // this optional refresh is unavailable.
          console.warn('[StudyEngine] Metadados da lista não atualizados:', metadataError);
        }
      }

      clearStudySnapshot(studySnapshotKey);
      clearMasterySnapshot(masterySnapshotKey);
      clearStudyLayerSnapshot(studySnapshotKey);
      if (isFlipMode && listId) {
        localStorage.removeItem(flipProgressKey);
        localStorage.removeItem(legacyFlipProgressKey);
      }
      setTrackedSessionId(null);
      toast.success("Sessão de estudo concluída! 🎉");
      return true;
    } catch (error) {
      console.error('Erro ao completar sessão:', error);
      toast.error("Não foi possível concluir a sessão. Tente novamente.");
      return false;
    } finally {
      completionInFlightRef.current = false;
      setIsCompleting(false);
    }
  }, [isAuthenticated, flushProgressBuffer, listId, isFlipMode, mode, flipProgressKey, legacyFlipProgressKey, studySnapshotKey, masterySnapshotKey, setTrackedSessionId]);

  const discardSession = useCallback(async () => {
    if (!sessionIdRef.current && pendingSessionClaimRef.current) {
      await pendingSessionClaimRef.current.catch(() => null);
    }
    const currentSessionId = sessionIdRef.current ?? sessionId;
    if (!currentSessionId || !isAuthenticated) {
      clearStudySnapshot(studySnapshotKey);
      clearMasterySnapshot(masterySnapshotKey);
      clearStudyLayerSnapshot(studySnapshotKey);
      if (listId && isFlipMode) {
        localStorage.removeItem(flipProgressKey);
        localStorage.removeItem(legacyFlipProgressKey);
      }
      setTrackedSessionId(null);
      return true;
    }
    try {
      await sessionWriteQueueRef.current?.drain();
      sessionWriteQueueRef.current?.invalidate();
      const controller = new AbortController();
      const { data: discardedSession, error } = await withStudyRuntimeTimeout(
        supabase
          .from('study_sessions')
          .update({ completed: true, updated_at: new Date().toISOString() })
          .eq('id', currentSessionId)
          .eq('user_id', authUserIdRef.current)
          .eq('list_id', listId)
          .eq('mode', mode)
          .select('id')
          .abortSignal(controller.signal)
          .maybeSingle(),
        STUDY_REMOTE_RESTORE_TIMEOUT_MS,
        'discard-study-session',
        () => controller.abort(),
      );
      if (error) throw error;
      if (!discardedSession?.id) throw new Error('discard-study-session-unconfirmed');
      clearStudySnapshot(studySnapshotKey);
      clearMasterySnapshot(masterySnapshotKey);
      clearStudyLayerSnapshot(studySnapshotKey);
      if (listId && isFlipMode) {
        localStorage.removeItem(flipProgressKey);
        localStorage.removeItem(legacyFlipProgressKey);
      }
      setTrackedSessionId(null);
      return true;
    } catch (error) {
      console.error('[StudyEngine] Falha ao descartar sessão restaurada:', error);
    }
  }, [studySnapshotKey, masterySnapshotKey, listId, isFlipMode, flipProgressKey, legacyFlipProgressKey, sessionId, isAuthenticated, mode, setTrackedSessionId]);

  // Reset session (start fresh)
  const resetSession = useCallback(() => {
    startFreshSession();
  }, [startFreshSession]);

  // Restart session with new settings
  const restartSession = useCallback(async (newSettings?: Partial<GameSettings>) => {
    if (isRestarting || restartInFlightRef.current) return;
    restartInFlightRef.current = true;
    setIsRestarting(true);
    const settings = { ...gameSettings, ...newSettings };
    setGameSettings(settings);

    if (flashcards.length === 0) {
      toast.error('Nenhum card encontrado com os filtros selecionados');
      setIsRestarting(false);
      restartInFlightRef.current = false;
      return;
    }

    let cardIds = flashcards.map(f => f.id);
    if (!settings.redFocus && settings.mode === 'random') cardIds = cardIds.sort(() => Math.random() - 0.5);
    cardIds = injectRedListRepetitions(
      cardIds,
      effectiveRedPlayableIds,
      shouldInjectRedPriority(settings),
    );

    try {
      if (!sessionIdRef.current && pendingSessionClaimRef.current) {
        await pendingSessionClaimRef.current.catch(() => null);
      }
      const previousSessionId = sessionIdRef.current ?? sessionId;
      sessionWriteQueueRef.current?.invalidate();
      await sessionWriteQueueRef.current?.drain();
      const userId = authUserIdRef.current;
      if (isAuthenticated && userId && listId) {
        if (previousSessionId) {
          const previousController = new AbortController();
          const { data: closedSession, error: previousError } = await withStudyRuntimeTimeout(
            supabase
              .from('study_sessions')
              .update({ completed: true, updated_at: new Date().toISOString() })
              .eq('id', previousSessionId)
              .eq('user_id', userId)
              .eq('list_id', listId)
              .eq('mode', mode)
              .select('id')
          .abortSignal(previousController.signal)
              .maybeSingle(),
            STUDY_REMOTE_RESTORE_TIMEOUT_MS,
            'restart-close-previous-session',
            () => previousController.abort(),
          );
          if (previousError) throw previousError;
          if (!closedSession?.id) throw new Error('restart-close-previous-session-unconfirmed');
        }

        clearStudySnapshot(studySnapshotKey);
        clearMasterySnapshot(masterySnapshotKey);
        clearStudyLayerSnapshot(studySnapshotKey);
        sessionLayerRef.current = undefined;
        if (listId && isFlipMode) {
          localStorage.removeItem(flipProgressKey);
          localStorage.removeItem(legacyFlipProgressKey);
        }
        setTrackedSessionId(null);
        setCardsOrder(cardIds);
        setCurrentIndex(0);
        setResults([]);
        setRoundResults([]);
        setMissedCards([]);
        setUnseenCards([]);
        setRoundNumber(1);
        setIsFinished(false);

        const createController = new AbortController();
        await claimAndTrackSession({
          userId,
          listId,
          mode,
          currentIndex: 0,
          cardsOrder: cardIds,
          sessionScopeKey,
          settingsSnapshot: sessionSettingsSnapshot,
          sessionSnapshot: buildStudyProgressSnapshot({
            sessionId: null,
            currentIndex: 0,
            cardsOrder: cardIds,
            results: [],
            layer: sessionLayerRef.current,
            roundNumber: 1,
            roundResults: [],
            unseenCards: [],
            missedCards: [],
            isFinished: false,
          }),
          signal: createController.signal,
          stage: 'restart-create-session',
        });
      } else {
        clearStudySnapshot(studySnapshotKey);
        clearMasterySnapshot(masterySnapshotKey);
        clearStudyLayerSnapshot(studySnapshotKey);
        sessionLayerRef.current = undefined;
        if (listId && isFlipMode) {
          localStorage.removeItem(flipProgressKey);
          localStorage.removeItem(legacyFlipProgressKey);
        }
        setTrackedSessionId(null);
        setCardsOrder(cardIds);
        setCurrentIndex(0);
        setResults([]);
        setRoundResults([]);
        setMissedCards([]);
        setUnseenCards([]);
        setRoundNumber(1);
        setIsFinished(false);
      }
      toast.success('Jogo reiniciado!');
    } catch (error) {
      console.error('[StudyEngine] Falha ao criar nova sessão após reinício:', error);
      toast.warning('O jogo reiniciou neste aparelho, mas a sincronização online falhou.');
    } finally {
      setIsRestarting(false);
      restartInFlightRef.current = false;
    }
  }, [isRestarting, gameSettings, flashcards, effectiveRedPlayableIds, listId, isFlipMode, flipProgressKey, legacyFlipProgressKey, sessionId, studySnapshotKey, masterySnapshotKey, isAuthenticated, mode, sessionScopeKey, sessionSettingsSnapshot, claimAndTrackSession, setTrackedSessionId]);

  // Initialize session on mount
  useEffect(() => {
    void initializeSession();
  }, [initializeSession]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      initializationAbortRef.current?.abort();
      initializationGenerationRef.current += 1;
    };
  }, []);

  // Mastery rounds: keep the legacy cardsOrder/currentIndex in sync with the
  // dedicated flow engine so the rest of the UI (progress bar, card display,
  // persistence snapshot) continues to work unchanged.
  useEffect(() => {
    if (!isMasteryMode || !masterySession) return;
    setCardsOrder(masterySession.currentRoundIds);
    setCurrentIndex(masterySession.currentRoundIndex);
    setRoundNumber(masterySession.roundNumber);
    setIsFinished(masterySession.status !== "active");
  }, [isMasteryMode, masterySession]);

  useEffect(() => {
    if (isLoading) return;
    const cardId = cardsOrder[currentIndex];
    if (cardId) trackCardViewed(cardId, `${roundNumber}:${currentIndex}:${cardsOrder.length}`);
  }, [cardsOrder, currentIndex, isLoading, roundNumber, trackCardViewed]);

  useEffect(() => {
    if (!isFinished) return;
    if (!isMasteryMode || masterySession?.status === "journey-complete") trackCompleted();
  }, [isFinished, isMasteryMode, masterySession?.status, trackCompleted]);

  // Save progress on index change
  useEffect(() => {
    if (!isLoading && sessionId) {
      saveProgress();
    }
  }, [currentIndex, isLoading, sessionId, saveProgress]);

  // Save flip progress on index change
  useEffect(() => {
    if (!isLoading && isFlipMode) {
      saveFlipProgress();
    }
  }, [currentIndex, results, isLoading, isFlipMode, saveFlipProgress]);

  useEffect(() => {
    if (!runtimeWritableRef.current || isLoading || cardsOrder.length === 0) return;
    const activeSessionId = sessionIdRef.current ?? sessionId;
    liveSessionSnapshotRef.current = {
      identity: `${userScope}:${listId}:${mode}:${sessionScopeKey}`,
      snapshot: buildStudyProgressSnapshot({
        sessionId: activeSessionId,
        currentIndex,
        cardsOrder,
        results,
        layer: sessionLayerRef.current,
        roundNumber,
        roundResults,
        unseenCards,
        missedCards,
        isFinished,
      }),
    };
    writeStudySnapshot(studySnapshotKey, {
      version: 2,
      settingsSnapshot: sessionSettingsSnapshot,
      ...(isMasteryMode && masterySession ? { masterySnapshot: masterySession } : {}),
      sessionId: activeSessionId,
      currentIndex,
      cardsOrder,
      results,
      timestamp: Date.now(),
      roundNumber,
      roundResults,
      unseenCards,
      missedCards,
      isFinished,
      ...(sessionLayerRef.current ? { layer: { ...sessionLayerRef.current } } : {}),
    });
  }, [studySnapshotKey, sessionId, currentIndex, cardsOrder, results, isLoading, isFinished, sessionSettingsSnapshot, isMasteryMode, masterySession, userScope, listId, mode, sessionScopeKey]);

  // Persist mastery session state so rounds survive a refresh. The regular
  // study snapshot only captures the current round; the mastery snapshot adds
  // queue/retry/mastered bookkeeping owned by studySessionFlow.ts.
  useEffect(() => {
    if (!isMasteryMode) return;
    if (!runtimeWritableRef.current || isLoading || !masterySession) return;
    writeMasterySnapshot(masterySnapshotKey, masterySession);
    const activeSessionId = sessionIdRef.current;
    if (!activeSessionId || !listId || !authUserIdRef.current) return;
    const userId = authUserIdRef.current;
    void sessionWriteQueueRef.current?.enqueue({
      sessionId: activeSessionId,
      userId,
      listId,
      mode,
      sessionScopeKey,
      payload: {
        current_index: masterySession.currentRoundIndex,
        cards_order: masterySession.currentRoundIds,
        session_snapshot: {
          ...masterySession,
          ...(sessionLayerRef.current ? { layer: { ...sessionLayerRef.current } } : {}),
        },
        session_scope_key: sessionScopeKey,
        settings_snapshot: sessionSettingsSnapshot,
        client_revision: nextStudySessionRevision(sessionRevisionRef),
        completed: masterySession.status === "journey-complete",
        updated_at: new Date().toISOString(),
      },
      stage: "mastery-session-persist",
    }).catch(() => undefined);
  }, [isMasteryMode, listId, masterySession, masterySnapshotKey, isLoading, mode, sessionId, sessionScopeKey, sessionSettingsSnapshot]);

  // Force-save current index immediately (no debounce). Used when switching
  // study scope so the previous trail's index isn't lost while waiting for
  // the debounced save to fire.
  const saveProgressNow = useCallback(async (
    layer?: StudySessionLayerSnapshot,
  ): Promise<SaveProgressResult> => {
    if (!runtimeWritableRef.current || !cardsOrder.length) return { status: "failed", reason: "session-not-ready" };
    const savingGeneration = initializationGenerationRef.current;
    const savingUserId = authUserIdRef.current;
    const savingSessionId = sessionIdRef.current;
    if (saveProgressTimeoutRef.current) clearTimeout(saveProgressTimeoutRef.current);
    if (layer) sessionLayerRef.current = { ...layer };
    const snapshotSessionId = sessionIdRef.current ?? sessionId;
    if (cardsOrder.length > 0) {
      writeStudySnapshot(studySnapshotKey, {
        version: 2,
        settingsSnapshot: sessionSettingsSnapshot,
        ...(isMasteryMode && masterySession ? { masterySnapshot: masterySession } : {}),
        sessionId: snapshotSessionId,
        currentIndex,
        cardsOrder,
        results,
        roundNumber,
        roundResults,
        unseenCards,
        missedCards,
        isFinished,
        timestamp: Date.now(),
        ...(sessionLayerRef.current ? { layer: { ...sessionLayerRef.current } } : {}),
      });
    }
    if (isMasteryMode && masterySession) {
      writeMasterySnapshot(masterySnapshotKey, masterySession);
    }
    // The answer-progress buffer is part of the same exit boundary. Await its
    // confirmed flush before considering the current session safely saved;
    // otherwise a page navigation could preserve the index while losing the
    // last answer's counters.
    await flushPersistedStudyOutbox();
    await flushProgressBuffer();
    if (!sessionIdRef.current && pendingSessionClaimRef.current) {
      await pendingSessionClaimRef.current.catch(() => null);
    }
    const activeSessionId = sessionIdRef.current ?? sessionId;
    if (!runtimeWritableRef.current || savingGeneration !== initializationGenerationRef.current
      || savingUserId !== authUserIdRef.current
      || (savingSessionId !== null && savingSessionId !== activeSessionId)) {
      return { status: "failed", reason: "session-changed-during-save" };
    }
    if (!activeSessionId || !listId || !authUserIdRef.current) {
      return {
        status: "local-only",
        sessionId: activeSessionId ?? null,
        updatedAt: Date.now(),
        reason: !activeSessionId
          ? "no-remote-session"
          : !listId ? "no-list" : "no-authenticated-user",
      };
    }
    try {
      const userId = authUserIdRef.current;
      const payload: Record<string, unknown> = {
        current_index: currentIndex,
        cards_order: cardsOrder,
        ...(isMasteryMode && masterySession
          ? {
            cards_order: masterySession.currentRoundIds,
            session_snapshot: {
              ...masterySession,
              ...(sessionLayerRef.current ? { layer: { ...sessionLayerRef.current } } : {}),
            },
          }
          : {
            session_snapshot: buildStudyProgressSnapshot({
              sessionId: activeSessionId,
              currentIndex,
              cardsOrder,
              results,
              layer: sessionLayerRef.current,
              roundNumber,
              roundResults,
              unseenCards,
              missedCards,
              isFinished,
            }),
          }),
        session_scope_key: sessionScopeKey,
        settings_snapshot: sessionSettingsSnapshot,
        client_revision: nextStudySessionRevision(sessionRevisionRef),
        updated_at: new Date().toISOString(),
      };
      await sessionWriteQueueRef.current?.enqueue({
        sessionId: activeSessionId,
        userId,
        listId,
        mode,
        sessionScopeKey,
        payload,
        stage: "save-progress",
      });
      // `enqueue` only schedules the write. Returning a confirmed status is
      // valid only after the queue has drained, especially before navigation.
      await sessionWriteQueueRef.current?.drain();
      return { status: "remote-confirmed", sessionId: activeSessionId, updatedAt: Date.now() };
    } catch (error) {
      console.warn('[StudyEngine] saveProgressNow remoto pendente:', error);
      return {
        status: "local-only",
        sessionId: activeSessionId,
        updatedAt: Date.now(),
        reason: error instanceof Error ? error.message : "remote-write-failed",
      };
    }
  }, [sessionId, currentIndex, listId, mode, cardsOrder, results, roundNumber, roundResults, unseenCards, missedCards, isFinished, studySnapshotKey, isMasteryMode, masterySession, masterySnapshotKey, sessionScopeKey, sessionSettingsSnapshot, flushPersistedStudyOutbox, flushProgressBuffer]);

  useEffect(() => {
    void flushPersistedStudyOutbox();
    const flushBeforeLeave = () => { void saveProgressNow(); };
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') void saveProgressNow();
    };
    const flushWhenOnline = () => { void flushPersistedStudyOutbox(); };
    const flushWhenVisible = () => {
      if (document.visibilityState === 'visible') void flushPersistedStudyOutbox();
    };
    window.addEventListener('pagehide', flushBeforeLeave);
    window.addEventListener('online', flushWhenOnline);
    document.addEventListener('visibilitychange', flushWhenHidden);
    document.addEventListener('visibilitychange', flushWhenVisible);
    return () => {
      window.removeEventListener('pagehide', flushBeforeLeave);
      window.removeEventListener('online', flushWhenOnline);
      document.removeEventListener('visibilitychange', flushWhenHidden);
      document.removeEventListener('visibilitychange', flushWhenVisible);
    };
  }, [flushPersistedStudyOutbox, saveProgressNow]);

  // Cleanup: flush progress buffer and turma activity on unmount
  useEffect(() => {
    return () => {
      // Clear scheduled flush
      if (flushProgressTimeoutRef.current) {
        clearTimeout(flushProgressTimeoutRef.current);
      }
      if (saveProgressTimeoutRef.current) {
        clearTimeout(saveProgressTimeoutRef.current);
      }
      // Flush any remaining buffered progress
      if (progressBufferRef.current.length > 0) {
        void flushProgressBuffer();
      }
      void flushPersistedStudyOutbox();
      // Flush turma activity
      flushActivity();
    };
  }, [flushProgressBuffer, flushPersistedStudyOutbox, flushActivity]);

  const currentCard = cardsOrder[currentIndex] 
    ? flashcards.find(f => f.id === cardsOrder[currentIndex])
    : null;

  // Calculate round stats
  const masterySummary = isMasteryMode && masterySession
    ? summarizeCurrentRound(masterySession)
    : null;
  const roundCorrect = masterySummary?.correctCards
    ?? roundResults.filter(r => r.correct && !r.skipped).length;
  const roundErrors = masterySummary
    ? masterySummary.incorrectCards + masterySummary.revealedCards
    : roundResults.filter(r => !r.correct && !r.skipped).length;
  const roundRecovered = masterySummary?.recoveredCards ?? 0;
  const hasMoreRounds = isMasteryMode
    ? masterySession?.status === "round-complete"
    : unseenCards.length > 0 || missedCards.length > 0;
  const resolvedGameComplete = isMasteryMode
    ? masterySession?.status === "journey-complete"
    : isGameComplete;

  return {
    currentIndex,
    progress,
    correctCount,
    errorCount,
    skippedCount,
    results,
    isFinished,
    isLoading,
    initializationState,
    initializationError: requestedRestore?.key === requestedKey ? requestedRestore.error : undefined,
    isCompleting,
    isRestarting,
    currentCard,
    cardsOrder,
    totalCards: isMasteryMode ? (masterySession?.currentRoundIds.length ?? cardsOrder.length) : cardsOrder.length,
    recordResult,
    goToNext,
    goToPrevious,
    navigateNext,
    navigatePrevious,
    setCurrentIndex,
    canGoPrevious: currentIndex > 0,
    canGoNext: currentIndex < cardsOrder.length - 1,
    // Spaced repetition exports
    roundNumber,
    roundCorrect,
    roundErrors,
    roundRecovered,
    hasMoreRounds,
    isGameComplete: resolvedGameComplete,
    startNextRound,
    discardSession,
    resetSession,
    retryInitialization,
    startFreshSession,
    restartSession,
    gameSettings,
    setGameSettings,
    unseenCardsCount: masterySummary?.unseenRemaining ?? unseenCards.length,
    missedCardsCount: masterySummary?.pendingReview ?? missedCards.length,
    masteryStatus: masterySession?.status ?? null,
    masteryRoundSummary: masterySummary,
    masteryTotalEligible: masterySession?.totalEligible ?? flashcards.length,
    masteryMasteredCount: masterySession ? new Set(masterySession.masteredIds).size : 0,
    // Manual session completion export
    completeSession,
    // Scope helpers — used by Study.tsx to switch scopes without resetting
    saveProgressNow,
    // Identidade remota da sessão aberta — usada pelo ponteiro de retomada.
    sessionId,
    // Chave do snapshot atual — permite persistência satélite (ex: camada visível).
    studySnapshotKey,
    // Camada restaurada da sessão remota/local — usada como fallback quando o
    // localStorage está vazio (cold start em outro navegador/dispositivo).
    restoredSessionLayer,
  };
}
