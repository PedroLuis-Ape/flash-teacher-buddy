import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  sanitizePersistedStudyOrder,
  sanitizeStudyLayerSnapshot,
  sanitizeStudySnapshot,
  writeStudySnapshot,
  type StudySessionLayerSnapshot,
  type StudySessionSnapshot,
} from "@/features/study/lib/studySessionSnapshot";
import {
  buildMasterySnapshotKey,
  clearMasterySnapshot,
  readMasterySnapshot,
  sanitizeMasterySnapshot,
  writeMasterySnapshot,
} from "@/features/study/lib/masterySessionSnapshot";
import {
  buildLegacyStudySessionScopeKey,
  buildStudySessionScopeKey,
  buildStudySessionSettingsSnapshot,
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
import { claimStudySession } from "@/features/study/lib/studySessionRepository";
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
  const controller = new AbortController();
  const { data, error } = await withStudyRuntimeTimeout(
    supabase
      .from("study_sessions")
      .update(request.payload)
      .eq("id", request.sessionId)
      .eq("user_id", request.userId)
      .eq("list_id", request.listId)
      .eq("mode", request.mode)
      .select("id")
      .maybeSingle()
      .abortSignal(controller.signal),
    STUDY_REMOTE_RESTORE_TIMEOUT_MS,
    request.stage,
    () => controller.abort(),
  );
  if (error) throw error;
  if (!data?.id) throw new Error(`${request.stage}-unconfirmed`);
}

function buildStudyProgressSnapshot(input: {
  sessionId: string | null;
  currentIndex: number;
  cardsOrder: string[];
  results: StudyResult[];
  layer?: StudySessionLayerSnapshot;
}): StudySessionSnapshot {
  return {
    version: 2,
    sessionId: input.sessionId,
    currentIndex: input.currentIndex,
    cardsOrder: [...input.cardsOrder],
    results: input.results.map((result) => ({ ...result })),
    timestamp: Date.now(),
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
) {
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
  // React state is intentionally mirrored in a ref because exit handlers,
  // visibility handlers, and completion can run before the claim promise has
  // produced the next render. The ref is the persistence authority for the
  // current runtime session.
  const sessionIdRef = useRef<string | null>(null);
  const pendingSessionClaimRef = useRef<Promise<string | null> | null>(null);
  const completionInFlightRef = useRef(false);
  const restartInFlightRef = useRef(false);
  const pitecoinWritesRef = useRef<Set<Promise<unknown>>>(new Set());
  const masteryAnswerGuardRef = useRef<{ session: MasterySessionState; key: string } | null>(null);
  const masteryRoundStartGuardRef = useRef<MasterySessionState | null>(null);
  const sessionLayerRef = useRef<StudySessionLayerSnapshot | undefined>(undefined);
  const restoredSettingsIdentityRef = useRef<string | null>(null);

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
    initializationAbortRef.current?.abort();
    const abortController = new AbortController();
    initializationAbortRef.current = abortController;
    const generation = ++initializationGenerationRef.current;
    const isCurrent = () =>
      mountedRef.current && initializationGenerationRef.current === generation;
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
    ].join("|");
    if (!deckReady) {
      if (isCurrent()) {
        completedInitSignatureRef.current = "";
        setInitializationState("loading");
        setIsLoading(true);
      }
      return;
    }
    if (!force && completedInitSignatureRef.current === initKey) {
      return;
    }

    const markReady = () => {
      if (!isCurrent()) return;
      completedInitSignatureRef.current = initKey;
      setInitializationState("ready");
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
    setInitializationState("loading");
    setIsLoading(true);
    logStudyRuntime("initialization-start", {
      generation,
      mode,
      flow: studyFlowMode,
      cards: flashcards.length,
      forced: force,
    });
    
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
      let restored = readMasterySnapshot(masterySnapshotKey, availableSet);
      let restoredRemoteSessionId: string | null = null;
      sessionLayerRef.current = undefined;

      if (userScope && listId) {
        try {
          const { data: remoteSessions } = await withStudyRuntimeTimeout(
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
          const remote = (remoteSessions ?? [])
            .map((candidate) => ({
              id: candidate.id as string,
              scopeKey: candidate.session_scope_key as string | null,
              state: sanitizeMasterySnapshot(candidate.session_snapshot, availableSet),
              layer: sanitizeStudyLayerSnapshot(candidate.session_snapshot?.layer),
              settingsSnapshot: candidate.settings_snapshot,
              updatedAt: candidate.updated_at,
            }))
            .filter((candidate) => candidate.scopeKey === sessionScopeKey || candidate.scopeKey?.startsWith("study-session-v1:"))
            .sort((left, right) => Number(right.scopeKey === sessionScopeKey) - Number(left.scopeKey === sessionScopeKey))
            // Reuse the durable row even when its rich snapshot is missing or
            // malformed. A local snapshot may still be newer, and a new
            // session row here would make the same journey impossible to
            // resume after a refresh.
            .find((candidate) => candidate.scopeKey === sessionScopeKey || candidate.scopeKey?.startsWith("study-session-v1:"));
          restoredRemoteSessionId = remote?.id ?? null;
          if (remote) {
            applyRestoredSessionSettings({
              id: remote.id,
              updated_at: remote.updatedAt,
              settings_snapshot: remote.settingsSnapshot,
            });
          }
          if (remote?.layer) sessionLayerRef.current = remote.layer;
          if (!restored && remote?.state) {
            restored = remote.state;
          }
        } catch {
          // Local persistence remains the safe fallback if remote restore is unavailable.
        }
      }

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
            ? (card as any).__layers.map((layer: { id?: unknown }) => layer.id).filter((id: unknown): id is string => typeof id === "string")
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
      const sanitizeSessionOrder = (sessionOrder: unknown, currentIndex: unknown) =>
        sanitizePersistedStudyOrder({
          sessionOrder,
          currentIndex,
          availableCardIds,
          enforceUniqueOrder: !!gameSettings.redFocus,
        });

      // A persisted session belongs to this scope only when it contains the
      // same effective card set. In red focus the sanitizer additionally
      // repairs legacy duplicated/random queues to the canonical deck order.
      const sessionMatchesCurrentScope = (sessionOrder: unknown): boolean =>
        sanitizeSessionOrder(sessionOrder, 0) !== null;

      const selectCurrentScopeSession = (sessions: any[] | null | undefined) =>
        (sessions ?? [])
          .filter((candidate) => candidate.session_scope_key === sessionScopeKey || candidate.session_scope_key?.startsWith("study-session-v1:"))
          .filter((candidate) => sessionMatchesCurrentScope(candidate.cards_order))
          .sort((left, right) => {
            const leftIsCurrent = left.session_scope_key === sessionScopeKey;
            const rightIsCurrent = right.session_scope_key === sessionScopeKey;
            if (leftIsCurrent !== rightIsCurrent) return leftIsCurrent ? -1 : 1;
            return Date.parse(String(right.updated_at ?? "")) - Date.parse(String(left.updated_at ?? ""));
          })[0] ?? null;

      const chooseNewestStudySnapshot = (
        local: ReturnType<typeof readStudySnapshot>,
        remote: StudySessionSnapshot | null,
        remoteSessionId: string,
        remoteUpdatedAt: unknown,
      ): StudySessionSnapshot | null => {
        if (!remote) return local;
        if (!local) return remote;
        const localBelongsToRemote = local.sessionId === null || local.sessionId === remoteSessionId;
        if (!localBelongsToRemote) return remote;
        const remoteTimestamp = Date.parse(String(remoteUpdatedAt ?? ""));
        return local.timestamp > (Number.isFinite(remoteTimestamp) ? remoteTimestamp : 0)
          ? local
          : remote;
      };

      const readRemoteStudySnapshot = (session: any): StudySessionSnapshot | null =>
        sanitizeStudySnapshot(
          session?.session_snapshot,
          availableCardIds,
          { enforceUniqueOrder: !!gameSettings.redFocus, resultCardIds },
        );

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
        const { data: openSessions } = await withStudyRuntimeTimeout(
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

        const matchingSession = selectCurrentScopeSession(openSessions);

        if (matchingSession) {
          applyRestoredSessionSettings(matchingSession);
          const remoteSnapshot = readRemoteStudySnapshot(matchingSession);
          const restoredSnapshot = chooseNewestStudySnapshot(
            localSnapshot,
            remoteSnapshot,
            matchingSession.id,
            matchingSession.updated_at,
          );
          sessionLayerRef.current = restoredSnapshot?.layer;
          const restoredSession = restoredSnapshot
            ? {
              cardsOrder: restoredSnapshot.cardsOrder,
              currentIndex: restoredSnapshot.currentIndex,
              repaired: false,
            }
            : sanitizeSessionOrder(matchingSession.cards_order, matchingSession.current_index);

          if (restoredSession) {
            setTrackedSessionId(matchingSession.id);
            setCurrentIndex(restoredSession.currentIndex);
            setCardsOrder(restoredSession.cardsOrder);

            if (restoredSession.repaired) {
              setResults([]);
              void sessionWriteQueueRef.current?.enqueue({
                sessionId: matchingSession.id,
                userId: user.id,
                listId,
                mode,
                sessionScopeKey,
                payload: {
                  cards_order: restoredSession.cardsOrder,
                  current_index: 0,
                  session_scope_key: sessionScopeKey,
                  settings_snapshot: sessionSettingsSnapshot,
                  schema_version: 1,
                  updated_at: new Date().toISOString(),
                },
                stage: "flip-session-repair",
              }).catch(() => undefined);
              toast.info("Fila do Foco Vermelho corrigida. Recomeçando do primeiro card.");
            } else {
              setResults(restoredSnapshot?.results ?? []);
              toast.success("Continuando de onde você parou!");
            }

            markReady();
            return;
          }
        }

        // Fallback to localStorage if no database session
        const savedProgress = loadFlipProgress();
        
        // CRITICAL FIX: Use the exact order from flashcards passed by Study.tsx
        // Study.tsx already applied random/sequential ordering before passing here
        const orderedCards = localSnapshot?.cardsOrder ?? flashcards.map(f => f.id);
        const restoredIndex = localSnapshot?.currentIndex ?? savedProgress?.index ?? 0;
        
        setCardsOrder(orderedCards);
        
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
      const { data: openSessions } = await withStudyRuntimeTimeout(
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

      const matchingSession = selectCurrentScopeSession(openSessions);

      if (matchingSession) {
        // Quiz/write/pronunciation modes must restore the same settings as
        // flip. Otherwise a resumed queue can be rendered with a different
        // direction, filter or flow contract than the one that was saved.
        applyRestoredSessionSettings(matchingSession);
        const remoteSnapshot = readRemoteStudySnapshot(matchingSession);
        const restoredSnapshot = chooseNewestStudySnapshot(
          localSnapshot,
          remoteSnapshot,
          matchingSession.id,
          matchingSession.updated_at,
        );
        sessionLayerRef.current = restoredSnapshot?.layer;
        const restoredSession = restoredSnapshot
          ? {
            cardsOrder: restoredSnapshot.cardsOrder,
            currentIndex: restoredSnapshot.currentIndex,
            repaired: false,
          }
          : sanitizeSessionOrder(matchingSession.cards_order, matchingSession.current_index);

        if (restoredSession) {
          setTrackedSessionId(matchingSession.id);
          setCurrentIndex(restoredSession.currentIndex);
          setCardsOrder(restoredSession.cardsOrder);

          if (restoredSession.repaired) {
            setResults([]);
            void sessionWriteQueueRef.current?.enqueue({
              sessionId: matchingSession.id,
              userId: user.id,
              listId,
              mode,
              sessionScopeKey,
              payload: {
                cards_order: restoredSession.cardsOrder,
                current_index: 0,
                session_scope_key: sessionScopeKey,
                settings_snapshot: sessionSettingsSnapshot,
                schema_version: 1,
                updated_at: new Date().toISOString(),
              },
              stage: "quiz-session-repair",
            }).catch(() => undefined);
            toast.info("Fila do Foco Vermelho corrigida. Recomeçando do primeiro card.");
          } else {
            setResults(restoredSnapshot?.results ?? []);
            toast.success("Continuando de onde você parou!");
          }

          markReady();
          return;
        }
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
        }),
        signal: abortController.signal,
        stage: "quiz-session-create",
      }, isCurrent).catch(() => undefined);
    } catch (error) {
      if (!isCurrent()) return;
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
    studyFlowMode,
    studySnapshotKey,
    trackListOpened,
    applyRestoredSessionSettings,
    userScope,
  ]);

  const retryInitialization = useCallback(() => {
    completedInitSignatureRef.current = "";
    void initializeSession(true);
  }, [initializeSession]);

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
            .maybeSingle()
            .abortSignal(controller.signal),
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
    // Clear any pending save
    if (saveProgressTimeoutRef.current) {
      clearTimeout(saveProgressTimeoutRef.current);
    }
    
    // Debounce by 500ms
    saveProgressTimeoutRef.current = setTimeout(async () => {
      const userId = authUserIdRef.current;
      const activeSessionId = sessionIdRef.current;
      if (!activeSessionId || !listId || !userId) return;

      const payload: Record<string, unknown> = {
        current_index: currentIndex,
        ...(!isMasteryMode
          ? {
            session_snapshot: buildStudyProgressSnapshot({
              sessionId: activeSessionId,
              currentIndex,
              cardsOrder,
              results,
              layer: sessionLayerRef.current,
            }),
          }
          : {}),
        session_scope_key: sessionScopeKey,
        settings_snapshot: sessionSettingsSnapshot,
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
            outcomes[index] = {
              status: "fulfilled",
              value: await recordStudyProgressAttempt(entry),
            };
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
    progressBufferRef.current.push({
      userId: progressUserId,
      flashcardId,
      listId,
      correct,
      operationId: createStudyProgressOperationId(),
      timestamp: Date.now(),
    });
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
      const sessionId = activeSessionId;
      const userId = authUserIdRef.current;

      if (isAuthenticated && sessionId) {
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
            settleStudySession(sessionId, true),
            STUDY_REMOTE_RESTORE_TIMEOUT_MS,
            'settle-study-session',
          ).catch((error) => {
            console.warn('[StudyEngine] Recompensa pendente; a sessão continuará sendo concluída:', error);
            return {
              success: false,
              ptsAwarded: 0,
              xpAwarded: 0,
              pitecoinAwarded: 0,
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
            .eq('id', sessionId)
            .eq('user_id', userId)
            .eq('list_id', listId)
            .eq('mode', mode)
            .select('id')
            .maybeSingle()
            .abortSignal(completionController.signal),
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
              updateGoalProgress(userId, sessionId, listId, mode, fromStepId),
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
            .maybeSingle()
            .abortSignal(listReadController.signal),
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
          .maybeSingle()
          .abortSignal(controller.signal),
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
      if (error) return false;
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
              .maybeSingle()
              .abortSignal(previousController.signal),
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
    if (isLoading || isFinished || cardsOrder.length === 0) return;
    writeStudySnapshot(studySnapshotKey, {
      version: 2,
      sessionId,
      currentIndex,
      cardsOrder,
      results,
      timestamp: Date.now(),
      ...(sessionLayerRef.current ? { layer: { ...sessionLayerRef.current } } : {}),
    });
  }, [studySnapshotKey, sessionId, currentIndex, cardsOrder, results, isLoading, isFinished]);

  // Persist mastery session state so rounds survive a refresh. The regular
  // study snapshot only captures the current round; the mastery snapshot adds
  // queue/retry/mastered bookkeeping owned by studySessionFlow.ts.
  useEffect(() => {
    if (!isMasteryMode) return;
    if (isLoading || !masterySession) return;
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
        completed: masterySession.status === "journey-complete",
        updated_at: new Date().toISOString(),
      },
      stage: "mastery-session-persist",
    }).catch(() => undefined);
  }, [isMasteryMode, listId, masterySession, masterySnapshotKey, isLoading, mode, sessionId, sessionScopeKey, sessionSettingsSnapshot]);

  // Force-save current index immediately (no debounce). Used when switching
  // study scope so the previous trail's index isn't lost while waiting for
  // the debounced save to fire.
  const saveProgressNow = useCallback(async (layer?: StudySessionLayerSnapshot) => {
    if (layer) sessionLayerRef.current = { ...layer };
    const snapshotSessionId = sessionIdRef.current ?? sessionId;
    if (cardsOrder.length > 0 && !isFinished) {
      writeStudySnapshot(studySnapshotKey, {
        version: 2,
        sessionId: snapshotSessionId,
        currentIndex,
        cardsOrder,
        results,
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
    await flushProgressBuffer();
    if (!sessionIdRef.current && pendingSessionClaimRef.current) {
      await pendingSessionClaimRef.current.catch(() => null);
    }
    const activeSessionId = sessionIdRef.current;
    if (!activeSessionId || !listId || !authUserIdRef.current) return;
    try {
      const userId = authUserIdRef.current;
      const payload: Record<string, unknown> = {
        current_index: currentIndex,
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
            }),
          }),
        session_scope_key: sessionScopeKey,
        settings_snapshot: sessionSettingsSnapshot,
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
    } catch (error) {
      console.warn('[StudyEngine] saveProgressNow remoto pendente:', error);
    }
  }, [sessionId, currentIndex, listId, mode, cardsOrder, results, isFinished, studySnapshotKey, isMasteryMode, masterySession, masterySnapshotKey, sessionScopeKey, sessionSettingsSnapshot, flushProgressBuffer]);

  useEffect(() => {
    const flushBeforeLeave = () => { void saveProgressNow(); };
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') void saveProgressNow();
    };
    window.addEventListener('pagehide', flushBeforeLeave);
    document.addEventListener('visibilitychange', flushWhenHidden);
    return () => {
      window.removeEventListener('pagehide', flushBeforeLeave);
      document.removeEventListener('visibilitychange', flushWhenHidden);
    };
  }, [saveProgressNow]);

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
      // Flush turma activity
      flushActivity();
    };
  }, [flushProgressBuffer, flushActivity]);

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
    // Chave do snapshot atual — permite persistência satélite (ex: camada visível).
    studySnapshotKey,
  };
}
