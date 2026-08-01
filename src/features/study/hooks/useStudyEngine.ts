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
  buildStudySnapshotKey,
  clearStudySnapshot,
  readStudySnapshot,
  sanitizePersistedStudyOrder,
  writeStudySnapshot,
} from "@/features/study/lib/studySessionSnapshot";
import {
  buildMasterySnapshotKey,
  clearMasterySnapshot,
  readMasterySnapshot,
  writeMasterySnapshot,
} from "@/features/study/lib/masterySessionSnapshot";
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

  
  // Refs for preventing duplicate init, debouncing saves, and batching progress
  const completedInitSignatureRef = useRef<string>("");
  const initializationGenerationRef = useRef(0);
  const initializationAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const saveProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressBufferRef = useRef<Map<string, { correct: boolean; timestamp: number }>>(new Map());
  const flushProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFlushRef = useRef<number>(0);
  const authUserIdRef = useRef<string | null>(userScope ?? null);
  const completionInFlightRef = useRef(false);
  const pitecoinWritesRef = useRef<Set<Promise<unknown>>>(new Set());
  const masteryAnswerGuardRef = useRef<{ session: MasterySessionState; key: string } | null>(null);
  const masteryRoundStartGuardRef = useRef<MasterySessionState | null>(null);

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

  // Scope key — separates persisted sessions per (subset / order / redFocus).
  // Without this, switching between "all" and "favorites" would either reuse the
  // wrong session (and reset the index) or overwrite the other scope's progress.
  // The full set of IDs in `flashcards` already differs between scopes, but we
  // also keep this scope label so we can match sessions back even when the
  // underlying deck composition changes (e.g. user added/removed favorites).
  const sessionScopeKey = useMemo(() => {
    const sub = gameSettings.subset ?? 'all';
    const order = gameSettings.mode ?? 'random';
    const red = gameSettings.redFocus ? 'red' : 'normal';
    return `${sub}:${order}:${red}`;
  }, [gameSettings.subset, gameSettings.mode, gameSettings.redFocus]);

  const studySnapshotKey = useMemo(() => buildStudySnapshotKey({
    userScope: userScope || 'anon',
    listId,
    mode,
    sessionScopeKey,
    cardsSignature,
  }), [userScope, listId, mode, sessionScopeKey, cardsSignature]);

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

  // Scoped flip-progress storage key — keeps "all" and "favorites" (and red focus)
  // progress separate so toggling between them never wipes the other trail.
  const flipProgressKey = useMemo(() => {
    const uid = userScope || 'anon';
    return `flip-progress-${uid}-${listId ?? 'no-list'}-${mode}-${sessionScopeKey}`;
  }, [userScope, listId, mode, sessionScopeKey]);

  // Load flip mode progress from localStorage (scoped)
  const loadFlipProgress = useCallback(() => {
    if (!listId) return null;
    try {
      const saved = localStorage.getItem(flipProgressKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading flip progress:', e);
    }
    return null;
  }, [listId, flipProgressKey]);

  // Save flip mode progress to localStorage (scoped)
  const saveFlipProgress = useCallback(() => {
    if (!listId || !isFlipMode) return;
    try {
      localStorage.setItem(flipProgressKey, JSON.stringify({
        index: currentIndex,
        knownCards: results.filter(r => r.correct).map(r => r.flashcardId),
        timestamp: Date.now(),
      }));
    } catch (e) {
      console.error('Error saving flip progress:', e);
    }
  }, [listId, isFlipMode, currentIndex, results, flipProgressKey]);

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
      listId || "no-list",
      mode,
      studyFlowMode,
      cardsSignature,
      sessionScopeKey,
    ].join("|");
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
      const eligibleIds = flashcards.map((card) => card.id);
      const availableSet = new Set(eligibleIds);
      const restored = readMasterySnapshot(masterySnapshotKey, availableSet);
      const session = restored
        ?? createMasterySession(eligibleIds, {
          shuffle: gameSettings.mode === "random",
        });
      setMasterySession(session);
      setCardsOrder(session.currentRoundIds);
      setCurrentIndex(session.currentRoundIndex);
      setRoundNumber(session.roundNumber);
      setRoundResults([]);
      setMissedCards([]);
      setUnseenCards([]);
      setIsFinished(session.status !== "active");
      markReady();
      return;
    }

    let fallbackLocalSnapshot: ReturnType<typeof readStudySnapshot> = null;
    try {
      const user = userScope ? { id: userScope } : null;
      authUserIdRef.current = userScope ?? null;
      const snapshotCardIds = new Set(flashcards.map((card) => card.id));
      const localSnapshot = readStudySnapshot(studySnapshotKey, snapshotCardIds, {
        enforceUniqueOrder: !!gameSettings.redFocus,
      });
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

        const matchingSession = (openSessions ?? []).find(s =>
          sessionMatchesCurrentScope(s.cards_order)
        );

        if (matchingSession) {
          const restoredSession = sanitizeSessionOrder(
            matchingSession.cards_order,
            matchingSession.current_index,
          );

          if (restoredSession) {
            setSessionId(matchingSession.id);
            setCurrentIndex(restoredSession.currentIndex);
            setCardsOrder(restoredSession.cardsOrder);

            if (restoredSession.repaired) {
              setResults([]);
              void withStudyRuntimeTimeout(
                supabase
                  .from('study_sessions')
                  .update({
                    cards_order: restoredSession.cardsOrder,
                    current_index: 0,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', matchingSession.id)
                  .abortSignal(abortController.signal),
                STUDY_REMOTE_RESTORE_TIMEOUT_MS,
                "flip-session-repair",
              ).catch(() => undefined);
              toast.info("Fila do Foco Vermelho corrigida. Recomeçando do primeiro card.");
            } else {
              if (localSnapshot?.sessionId === matchingSession.id) {
                setResults(localSnapshot.results);
              }
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

        void withStudyRuntimeTimeout(
          supabase
            .from('study_sessions')
            .insert({
              user_id: user.id,
              list_id: listId,
              mode,
              current_index: restoredIndex,
              cards_order: orderedCards,
              completed: false
            })
            .select()
            .abortSignal(abortController.signal)
            .single(),
          STUDY_REMOTE_RESTORE_TIMEOUT_MS,
          "flip-session-create",
        ).then(({ data, error }) => {
          if (!error && data && isCurrent()) setSessionId(data.id);
        }).catch(() => undefined);
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

      const matchingSession = (openSessions ?? []).find(s =>
        sessionMatchesCurrentScope(s.cards_order)
      );

      if (matchingSession) {
        const restoredSession = sanitizeSessionOrder(
          matchingSession.cards_order,
          matchingSession.current_index,
        );

        if (restoredSession) {
          setSessionId(matchingSession.id);
          setCurrentIndex(restoredSession.currentIndex);
          setCardsOrder(restoredSession.cardsOrder);

          if (restoredSession.repaired) {
            setResults([]);
            void withStudyRuntimeTimeout(
              supabase
                .from('study_sessions')
                .update({
                  cards_order: restoredSession.cardsOrder,
                  current_index: 0,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', matchingSession.id)
                .abortSignal(abortController.signal),
              STUDY_REMOTE_RESTORE_TIMEOUT_MS,
              "quiz-session-repair",
            ).catch(() => undefined);
            toast.info("Fila do Foco Vermelho corrigida. Recomeçando do primeiro card.");
          } else {
            if (localSnapshot?.sessionId === matchingSession.id) {
              setResults(localSnapshot.results);
            }
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

      void withStudyRuntimeTimeout(
        supabase
          .from('study_sessions')
          .insert({
            user_id: user.id,
            list_id: listId,
            mode,
            current_index: localSnapshot?.currentIndex ?? 0,
            cards_order: orderedCards,
            completed: false
          })
          .select()
          .abortSignal(abortController.signal)
          .single(),
        STUDY_REMOTE_RESTORE_TIMEOUT_MS,
        "quiz-session-create",
      ).then(({ data, error }) => {
        if (!error && data && isCurrent()) setSessionId(data.id);
      }).catch(() => undefined);
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
    } finally {
      markReady();
      perfLog("useStudyEngine.initializeSession", __t0, { listId, mode, cards: flashcards.length });
    }
    // Includes gameSettings.subset and redListIds because they materially affect
    // the cardsOrder shape (favorites scope + red-list spaced repetition injection).
  }, [
    cardsSignature,
    effectiveRedPlayableIds,
    flashcards,
    gameSettings,
    getPrioritizedFlashcards,
    initTurmaTracking,
    isFlipMode,
    isMasteryMode,
    listId,
    loadFlipProgress,
    masterySnapshotKey,
    mode,
    sessionScopeKey,
    studyFlowMode,
    studySnapshotKey,
    trackListOpened,
    userScope,
  ]);

  const retryInitialization = useCallback(() => {
    completedInitSignatureRef.current = "";
    void initializeSession(true);
  }, [initializeSession]);

  const startFreshSession = useCallback(() => {
    initializationAbortRef.current?.abort();
    initializationGenerationRef.current += 1;
    completedInitSignatureRef.current = "";
    clearStudySnapshot(studySnapshotKey);
    clearMasterySnapshot(masterySnapshotKey);
    clearStudyLayerSnapshot(studySnapshotKey);
    if (listId && isFlipMode) {
      try { localStorage.removeItem(flipProgressKey); } catch {}
    }

    setSessionId(null);
    setResults([]);
    setRoundResults([]);
    setMissedCards([]);
    setUnseenCards([]);
    setRoundNumber(1);
    setIsFinished(false);

    const eligibleIds = flashcards.map((card) => card.id);
    if (isMasteryMode) {
      const freshMastery = createMasterySession(eligibleIds, {
        shuffle: gameSettings.mode === "random",
      });
      setMasterySession(freshMastery);
      setCardsOrder(freshMastery.currentRoundIds);
      setCurrentIndex(freshMastery.currentRoundIndex);
    } else {
      const baseOrder =
        gameSettings.mode === "random" && !gameSettings.redFocus
          ? [...eligibleIds].sort(() => Math.random() - 0.5)
          : eligibleIds;
      setMasterySession(null);
      setCardsOrder(injectRedListRepetitions(
        baseOrder,
        effectiveRedPlayableIds,
        shouldInjectRedPriority(gameSettings),
      ));
      setCurrentIndex(0);
    }
    setInitializationState(eligibleIds.length > 0 ? "ready" : "failed");
    setIsLoading(false);
    logStudyRuntime("fresh-session-recovery", {
      mode,
      flow: studyFlowMode,
      cards: eligibleIds.length,
    });
  }, [
    effectiveRedPlayableIds,
    flashcards,
    flipProgressKey,
    gameSettings,
    isFlipMode,
    isMasteryMode,
    listId,
    masterySnapshotKey,
    mode,
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
      if (!sessionId || !listId || !authUserIdRef.current) return;

      try {
        const controller = new AbortController();
        const { error } = await withStudyRuntimeTimeout(
          supabase
            .from('study_sessions')
            .update({
              current_index: currentIndex,
              updated_at: new Date().toISOString()
            })
            .eq('id', sessionId)
            .abortSignal(controller.signal),
          STUDY_REMOTE_RESTORE_TIMEOUT_MS,
          'debounced-save-progress',
          () => controller.abort(),
        );
        if (error) throw error;
      } catch (error) {
        console.warn('[StudyEngine] Salvamento remoto pendente:', error);
      }
    }, 500);
  }, [sessionId, currentIndex, listId]);

  // Flush buffered progress to database
  const flushProgressBuffer = useCallback(async () => {
    if (progressBufferRef.current.size === 0) return;
    if (!listId) return;

    const userId = authUserIdRef.current;
    if (!userId) return;

    const entries = Array.from(progressBufferRef.current.entries());
    // Release the buffer for new answers while this batch is in flight. The
    // entries are requeued below unless the remote write confirms success.
    progressBufferRef.current.clear();

    try {
      lastFlushRef.current = Date.now();

      // Fetch existing progress for all cards in batch
      const flashcardIds = entries.map(([id]) => id);
      const readController = new AbortController();
      const { data: existingProgress, error: readError } = await withStudyRuntimeTimeout(
        supabase
          .from('flashcard_progress')
          .select('id, flashcard_id, correct_count, incorrect_count')
          .eq('user_id', userId)
          .in('flashcard_id', flashcardIds)
          .abortSignal(readController.signal),
        STUDY_REMOTE_RESTORE_TIMEOUT_MS,
        'progress-flush-read',
        () => readController.abort(),
      );
      if (readError) throw readError;

      const existingMap = new Map(
        (existingProgress || []).map(p => [p.flashcard_id, p])
      );

      // Build a single upsert array — no sequential loops
      const upsertRecords: any[] = [];

      for (const [flashcardId, { correct }] of entries) {
        const existing = existingMap.get(flashcardId);
        if (existing) {
          upsertRecords.push({
            id: existing.id,
            user_id: userId,
            flashcard_id: flashcardId,
            list_id: listId,
            correct_count: correct ? existing.correct_count + 1 : existing.correct_count,
            incorrect_count: !correct ? existing.incorrect_count + 1 : existing.incorrect_count,
            last_reviewed: new Date().toISOString(),
          });
        } else {
          upsertRecords.push({
            user_id: userId,
            flashcard_id: flashcardId,
            list_id: listId,
            correct_count: correct ? 1 : 0,
            incorrect_count: !correct ? 1 : 0,
            last_reviewed: new Date().toISOString(),
          });
        }
      }

      if (upsertRecords.length > 0) {
        try {
          const writeController = new AbortController();
          const { error } = await withStudyRuntimeTimeout(
            supabase
              .from('flashcard_progress')
              .upsert(upsertRecords, { onConflict: 'id' })
              .abortSignal(writeController.signal),
            STUDY_REMOTE_RESTORE_TIMEOUT_MS,
            'progress-flush-write',
            () => writeController.abort(),
          );
          if (error) throw error;
        } catch (err) {
          for (const [cardId, entry] of entries) {
            const current = progressBufferRef.current.get(cardId);
            if (!current || current.timestamp < entry.timestamp) {
              progressBufferRef.current.set(cardId, entry);
            }
          }
          console.warn('[StudyEngine] Progresso remoto pendente após falha:', err);
        }
      }

      // (inserts already included in upsert above)
    } catch (error) {
      // A failed/timeout batch remains pending. Newer entries for the same
      // card win, so a late failure can never overwrite a newer local answer.
      for (const [cardId, entry] of entries) {
        const current = progressBufferRef.current.get(cardId);
        if (!current || current.timestamp < entry.timestamp) {
          progressBufferRef.current.set(cardId, entry);
        }
      }
      console.warn('[StudyEngine] Progresso remoto pendente após falha:', error);
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
    if (progressBufferRef.current.size >= FLUSH_CARD_THRESHOLD) {
      flushProgressBuffer();
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
    if (isAuthenticated && sessionId && FEATURE_FLAGS.economy_enabled) {
      const write = recordStudyAnswer(sessionId, flashcardId, correct, skipped);
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
    progressBufferRef.current.set(flashcardId, { correct, timestamp: Date.now() });
    scheduleFlush();

    // Update turma activity (debounced internally)
    updateTurmaActivity({
      listId,
      mode,
      totalCards: cardsOrder.length,
      currentIndex
    });
  }, [listId, isAuthenticated, sessionId, isMasteryMode, masterySession, trackListStudied, scheduleFlush, updateTurmaActivity, trackAnswer, mode, cardsOrder.length, currentIndex, gameSettings.redFocus]);

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
      if (progressBufferRef.current.size > 0) {
        toast.error('O progresso ainda não foi sincronizado. Tente concluir novamente quando a conexão voltar.');
        return false;
      }
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
        const { error: completionError } = await withStudyRuntimeTimeout(
          supabase
            .from('study_sessions')
            .update({ completed: true, updated_at: new Date().toISOString() })
            .eq('id', sessionId)
            .abortSignal(completionController.signal),
          STUDY_REMOTE_RESTORE_TIMEOUT_MS,
          'complete-study-session',
          () => completionController.abort(),
        );
        if (completionError) throw completionError;

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
      if (isFlipMode && listId) localStorage.removeItem(flipProgressKey);
      setSessionId(null);
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
  }, [isAuthenticated, flushProgressBuffer, sessionId, listId, isFlipMode, mode, flipProgressKey, studySnapshotKey, masterySnapshotKey]);

  const discardSession = useCallback(async () => {
    clearStudySnapshot(studySnapshotKey);
    clearMasterySnapshot(masterySnapshotKey);
    clearStudyLayerSnapshot(studySnapshotKey);
    if (listId && isFlipMode) localStorage.removeItem(flipProgressKey);
    const currentSessionId = sessionId;
    setSessionId(null);
    if (!currentSessionId || !isAuthenticated) return;
    try {
      const controller = new AbortController();
      const { error } = await withStudyRuntimeTimeout(
        supabase
          .from('study_sessions')
          .update({ completed: true, updated_at: new Date().toISOString() })
          .eq('id', currentSessionId)
          .abortSignal(controller.signal),
        STUDY_REMOTE_RESTORE_TIMEOUT_MS,
        'discard-study-session',
        () => controller.abort(),
      );
      if (error) throw error;
    } catch (error) {
      console.error('[StudyEngine] Falha ao descartar sessão restaurada:', error);
    }
  }, [studySnapshotKey, masterySnapshotKey, listId, isFlipMode, flipProgressKey, sessionId, isAuthenticated]);

  // Reset session (start fresh)
  const resetSession = useCallback(() => {
    startFreshSession();
  }, [startFreshSession]);

  // Restart session with new settings
  const restartSession = useCallback(async (newSettings?: Partial<GameSettings>) => {
    if (isRestarting) return;
    setIsRestarting(true);
    const settings = { ...gameSettings, ...newSettings };
    setGameSettings(settings);

    if (flashcards.length === 0) {
      toast.error('Nenhum card encontrado com os filtros selecionados');
      setIsRestarting(false);
      return;
    }

    let cardIds = flashcards.map(f => f.id);
    if (!settings.redFocus && settings.mode === 'random') cardIds = cardIds.sort(() => Math.random() - 0.5);
    cardIds = injectRedListRepetitions(
      cardIds,
      effectiveRedPlayableIds,
      shouldInjectRedPriority(settings),
    );

    const previousSessionId = sessionId;
    clearStudySnapshot(studySnapshotKey);
    clearMasterySnapshot(masterySnapshotKey);
    clearStudyLayerSnapshot(studySnapshotKey);
    if (listId && isFlipMode) localStorage.removeItem(flipProgressKey);

    setSessionId(null);
    setCardsOrder(cardIds);
    setCurrentIndex(0);
    setResults([]);
    setRoundResults([]);
    setMissedCards([]);
    setUnseenCards([]);
    setRoundNumber(1);
    setIsFinished(false);

    try {
      const userId = authUserIdRef.current;
      if (isAuthenticated && userId && listId) {
        if (previousSessionId) {
          const previousController = new AbortController();
          const { error: previousError } = await withStudyRuntimeTimeout(
            supabase
              .from('study_sessions')
              .update({ completed: true, updated_at: new Date().toISOString() })
              .eq('id', previousSessionId)
              .abortSignal(previousController.signal),
            STUDY_REMOTE_RESTORE_TIMEOUT_MS,
            'restart-close-previous-session',
            () => previousController.abort(),
          );
          if (previousError) throw previousError;
        }
        const createController = new AbortController();
        const { data: newSession, error } = await withStudyRuntimeTimeout(
          supabase
            .from('study_sessions')
            .insert({
              user_id: userId,
              list_id: listId,
              mode,
              current_index: 0,
              cards_order: cardIds,
              completed: false,
            })
            .select()
            .abortSignal(createController.signal)
            .single(),
          STUDY_REMOTE_RESTORE_TIMEOUT_MS,
          'restart-create-session',
          () => createController.abort(),
        );
        if (error) throw error;
        setSessionId(newSession.id);
      }
      toast.success('Jogo reiniciado!');
    } catch (error) {
      console.error('[StudyEngine] Falha ao criar nova sessão após reinício:', error);
      toast.warning('O jogo reiniciou neste aparelho, mas a sincronização online falhou.');
    } finally {
      setIsRestarting(false);
    }
  }, [isRestarting, gameSettings, flashcards, effectiveRedPlayableIds, listId, isFlipMode, flipProgressKey, sessionId, studySnapshotKey, masterySnapshotKey, isAuthenticated, mode]);

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
    });
  }, [studySnapshotKey, sessionId, currentIndex, cardsOrder, results, isLoading, isFinished]);

  // Persist mastery session state so rounds survive a refresh. The regular
  // study snapshot only captures the current round; the mastery snapshot adds
  // queue/retry/mastered bookkeeping owned by studySessionFlow.ts.
  useEffect(() => {
    if (!isMasteryMode) return;
    if (isLoading || !masterySession) return;
    writeMasterySnapshot(masterySnapshotKey, masterySession);
  }, [isMasteryMode, masterySession, masterySnapshotKey, isLoading]);

  // Force-save current index immediately (no debounce). Used when switching
  // study scope so the previous trail's index isn't lost while waiting for
  // the debounced save to fire.
  const saveProgressNow = useCallback(async () => {
    if (cardsOrder.length > 0 && !isFinished) {
      writeStudySnapshot(studySnapshotKey, {
        version: 2,
        sessionId,
        currentIndex,
        cardsOrder,
        results,
        timestamp: Date.now(),
      });
    }
    if (isMasteryMode && masterySession) {
      writeMasterySnapshot(masterySnapshotKey, masterySession);
    }
    if (!sessionId || !listId || !authUserIdRef.current) return;
    try {
      const controller = new AbortController();
      const { error } = await withStudyRuntimeTimeout(
        supabase
          .from('study_sessions')
          .update({
            current_index: currentIndex,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId)
          .abortSignal(controller.signal),
        STUDY_REMOTE_RESTORE_TIMEOUT_MS,
        'save-progress',
        () => controller.abort(),
      );
      if (error) throw error;
    } catch (error) {
      console.warn('[StudyEngine] saveProgressNow remoto pendente:', error);
    }
  }, [sessionId, currentIndex, listId, cardsOrder, results, isFinished, studySnapshotKey, isMasteryMode, masterySession, masterySnapshotKey]);

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
    const pendingProgress = progressBufferRef.current;
    return () => {
      // Clear scheduled flush
      if (flushProgressTimeoutRef.current) {
        clearTimeout(flushProgressTimeoutRef.current);
      }
      if (saveProgressTimeoutRef.current) {
        clearTimeout(saveProgressTimeoutRef.current);
      }
      // Flush any remaining buffered progress
      if (pendingProgress.size > 0) {
        flushProgressBuffer();
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
