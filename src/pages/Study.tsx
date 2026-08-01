import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useKeyboardShortcuts as useStudyShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { publicSupabase } from "@/integrations/supabase/publicClient";
import { getLangLabel, resolveEffectiveListSettings } from "@/features/study/lib/resolveStudySides";
import { normalizeDirection, type Direction } from "@/features/study/lib/gameCore";
import { hashToBool } from "@/features/study/lib/gameCore";
import { normalizeStudyMode, type StudyMode } from "@/features/study/lib/studyMode";
import { getOfflineList } from "@/lib/offlineStore";
import { prepareLayeredStudyDeck } from "@/lib/studyDeck";
import {
  createStudyDeckRequestId,
  loadStudyDeck,
} from "@/features/study/lib/studyDeckLoader";
import {
  fetchStudyDeckPage,
  probeStudyDeckAvailability,
} from "@/features/study/lib/studyDeckSupabaseGateway";
import { resolveStudyResourceContext } from "@/features/study/lib/studyResourceContext";
import {
  buildStudyDeckRequestContextKey,
  isStudyDeckRequestCurrent,
} from "@/features/study/lib/studyDeckRequestIdentity";
import {
  isStudyDeckLoading,
  studyDeckRecoveryReason,
  studyDeckTechnicalId,
  type StudyDeckLoadState,
} from "@/features/study/lib/studyDeckLoadState";
import { useListGlossary } from "@/hooks/useListGlossary";
import { mergeGlossaryAndManual, parseExtendedWordHints, type MergedHint } from "@/features/study/lib/glossaryMerge";
import { useStudyPreferences } from "@/hooks/useStudyPreferences";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FlipStudyView } from "@/features/study/components/FlipStudyView";
import { WriteStudyView } from "@/features/study/components/WriteStudyView";
import { MultipleChoiceStudyView } from "@/features/study/components/MultipleChoiceStudyView";
import { UnscrambleStudyView } from "@/features/study/components/UnscrambleStudyView";
import { PronunciationStudyView } from "@/features/study/components/PronunciationStudyView";
import { DetailedExplanationPanel } from "@/features/study/components/DetailedExplanationPanel";
import { StudyVideoButton } from "@/features/study/components/StudyVideoButton";
import { GameSettingsModal, GameSettings } from "@/features/study/components/GameSettingsModal";
import { useStudyEngine } from "@/features/study/hooks/useStudyEngine";
import { StudyCompletionModal } from "@/features/study/components/StudyCompletionModal";
import { StudyProgressHud } from "@/features/study/components/StudyProgressHud";
import { StudySessionRecovery } from "@/features/study/components/StudySessionRecovery";
import { StudyDeckEmptyState } from "@/features/study/components/StudyDeckEmptyState";
import { StudyScopeEmptyState } from "@/features/study/components/StudyScopeEmptyState";
import { SkipCardConfirmDialog } from "@/features/study/components/SkipCardConfirmDialog";
import { resolveStudyProgressMetrics } from "@/features/study/lib/studyProgressMetrics";
import {
  resolveStudyAnswerIdentity,
  resolveStudySessionReadiness,
  STUDY_RECOVERY_WATCHDOG_MS,
  STUDY_REMOTE_RESTORE_TIMEOUT_MS,
  STUDY_REQUIRED_LOAD_TIMEOUT_MS,
  withStudyRuntimeTimeout,
  logStudyRuntime,
} from "@/features/study/lib/studySessionRuntime";
import { EditFlashcardDialog } from "@/components/EditFlashcardDialog";
import { useFavorites, useToggleFavorite } from "@/hooks/useFavorites";
import { useRedList, useToggleRedList } from "@/hooks/useRedList";
import { useSpecialFlashcards, useToggleSpecialFlashcard } from "@/hooks/useSpecialFlashcards";
import { useSetFavoriteGroup } from "@/hooks/useSetFavoriteGroup";
import { useSetRedListGroup } from "@/hooks/useSetRedListGroup";
import { useSetSpecialLayer } from "@/hooks/useSetSpecialLayer";
import { resolveCardStatusIdentity } from "@/features/cards/lib/cardStatusIdentity";
import { useGroupStatusGate } from "@/features/cards/hooks/useGroupStatusGate";
import { useSetFlashcardGroupStatus } from "@/features/cards/hooks/useFlashcardGroupStatus";
import {
  filterCardsForStudyScope,
  resolvePersonalStudySubset,
} from "@/features/study/lib/studyScopePolicy";
import { useAuth } from "@/contexts/AuthContext";
import { resolveStudyAccess } from "@/lib/resolveStudyAccess";
import { isWriteAnswerLocked, subscribeWriteAnswerLock } from "@/features/study/lib/writeAnswerLock";
import { ArrowLeft, RefreshCcw, RotateCcw, CheckCircle, Flame, Layers, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buildStudyReturnRoute } from "@/features/study/lib/studyCompletionNavigation";
import { pageMount } from "@/lib/perfLog";
import {
  readStudyLayerSnapshot,
  writeStudyLayerSnapshot,
} from "@/features/study/lib/studyLayerSnapshot";
import type { StudySessionSettingsSnapshot } from "@/features/study/lib/studySessionContext";

interface Flashcard {
  id: string;
  term: string;
  translation: string;
  hint?: string | null;
  accepted_answers_en?: string[];
  accepted_answers_pt?: string[];
  image_url_a?: string | null;
  image_url_b?: string | null;
  word_hints?: unknown;
  parent_card_id?: string | null;
  status_group_uid?: string | null;
  layer_index?: number | null;
  example_text?: string | null;
  example_translation?: string | null;
  context_tag?: string | null;
  short_explanation?: string | null;
  detailed_explanation?: string | null;
  usage_notes?: string | null;
  common_mistakes?: string | null;
  /** When set, this card is the entry-point of a layered group; siblings hold all layers (including this one) sorted by layer_index. */
  __layers?: Flashcard[];
  /** Visual-only metadata for layered cards (each layer is its own deck entry). */
  __groupTitle?: string | null;
  __statusGroupUid?: string | null;
  __layerIndex?: number;
  __layerCount?: number;
  /** Pre-parsed word hints computed at load time to avoid Main Thread stalls */
  preParsedHints?: ReturnType<typeof parseExtendedWordHints>;
}

interface VideoInfo {
  videoId: string;
  title: string | null;
}

interface ListSettings {
  studyType: "language" | "general";
  langA: string;
  langB: string;
  labelsA: string;
  labelsB: string;
  ttsEnabled: boolean;
}

const getDefaultListSettings = (): ListSettings => ({
  studyType: "language",
  langA: "en",
  langB: "pt",
  labelsA: "English",
  labelsB: "Português",
  ttsEnabled: true,
});

const Study = () => {
  const { id, collectionId } = useParams();
  const location = useLocation();
  const resourceContext = useMemo(
    () => resolveStudyResourceContext({ pathname: location.pathname, id, collectionId }),
    [collectionId, id, location.pathname],
  );
  const resolvedId = resourceContext.resourceId;
  const isListRoute = resourceContext.resourceKind === "list";
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // DEV-only mount marker (helps localize freezes when entering study).
  useEffect(() => {
    pageMount("Study", { id: resolvedId });
  }, [resolvedId]);

  // ── Persistent study preferences ──
  // The URL identifies the game being opened. The saved preset configures that
  // mode, but can never silently replace it with another mode from stale state.
  const { status: authStatus, userId: authUserId, session: authSession } = useAuth();
  const requestedMode: StudyMode = normalizeStudyMode(searchParams.get("mode") ?? "flip");
  const isPrivateListRoute = isListRoute && !resourceContext.isPublic;
  const {
    prefs,
    updatePrefs,
    setSessionOverrides,
    effectivePreset,
    isHydrating: preferencesHydrating,
  } = useStudyPreferences(authUserId, {
    listId: isPrivateListRoute ? resolvedId : undefined,
    gameMode: requestedMode,
    persistScope: isPrivateListRoute ? "list" : "global",
    canPersistList: isPrivateListRoute,
  });
  // URL overrides are applied at load time inside useStudyPreferences,
  // but the URL is ALSO read directly here as the launch-intent SSOT. A
  // valid resumed session is applied later and intentionally wins over both
  // the URL intent and the current preset.
  const urlDirRaw = searchParams.get("dir") || searchParams.get("direction");
  const urlDirection: Direction | null = urlDirRaw && ["a-b", "b-a", "any"].includes(urlDirRaw)
    ? (urlDirRaw as Direction)
    : null;
  const restoredSessionDirectionRef = useRef<Direction | null>(null);

  // Single canonical mode token for the entire engine + view chain.
  const normalizedMode: StudyMode = requestedMode;

  // SSOT for direction before session restoration: URL wins over prefs. A
  // restored session direction is applied through the ref above and then
  // supersedes this launch-time value.
  const initialDir: Direction = restoredSessionDirectionRef.current ?? urlDirection ?? prefs.direction;
  const initialOrder = prefs.order;
  const canUsePersonalFavorites = authStatus === "authenticated" && Boolean(authUserId);
  const favoriteSubsetResolution = resolvePersonalStudySubset(
    prefs.favoritesOnly ? "favorites" : "all",
    canUsePersonalFavorites,
  );
  const urlFavoritesOnly = favoriteSubsetResolution.subset === "favorites";
  
  // Derive initial game settings from persistent prefs
  // NOTE: only used as initialSettings on first engine init; live updates flow via setGameSettings effect below
  const initialGameSettings = useMemo(() => ({
    mode: (initialOrder === "sequential" ? "sequential" : "random") as "sequential" | "random",
    subset: (urlFavoritesOnly ? "favorites" : "all") as "all" | "favorites",
    fastMode: prefs.fastMode,
  }), [initialOrder, urlFavoritesOnly, prefs.fastMode]);
  const sessionContext = useMemo(() => ({
    direction: initialDir,
    writeActivityMode: effectivePreset.writeActivityMode,
    writeRewriteSide: effectivePreset.writeRewriteSide,
    writeCorrectionMode: effectivePreset.writeCorrectionMode,
  }), [effectivePreset.writeActivityMode, effectivePreset.writeCorrectionMode, effectivePreset.writeRewriteSide, initialDir]);
  
  // Goal context
  const fromGoalId = searchParams.get("from_goal");
  const fromStepId = searchParams.get("from_step");

  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [deckLoadState, setDeckLoadState] = useState<StudyDeckLoadState>({ phase: "idle" });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const loadGenerationRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const loadContextRef = useRef("");
  const loading = isStudyDeckLoading(deckLoadState);
  const confirmedEmpty = deckLoadState.phase === "confirmed-empty";
  const loadFailure = studyDeckRecoveryReason(deckLoadState);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [listTitle, setListTitle] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  // userId mirrors authUserId from AuthContext (single source of truth).
  // Keeping the same local name minimizes diff to call sites below.
  const userId = authUserId;
  const [listSettings, setListSettings] = useState<ListSettings>(getDefaultListSettings());
  // In-game card editor (uses the same EditFlashcardDialog as ListDetail)
  const [editingFlashcard, setEditingFlashcard] = useState<Flashcard | null>(null);
  // Tracks the currently visible layer id (for layered cards). Set up in an
  // effect below; consumed by handleNext / favorites toggles so they target
  // the visible layer rather than the deck entry-point.
  const displayedCardIdRef = useRef<string | null>(null);
  const answeredCardKeyRef = useRef<string | null>(null);
  const skipCardKeyRef = useRef<string | null>(null);
  const exitInFlightRef = useRef(false);
  
  // Direction state for flip mode selector
  const [flipDirection, setFlipDirection] = useState<Direction>(initialDir);
  
  // Completion modal
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionWasRestored, setCompletionWasRestored] = useState(false);

  // Persistent completion key — uses urlFavoritesOnly (the prefs-derived value),
  // which is the SSOT before engine init. After init, gameSettings.subset is the
  // SSOT, but the key intentionally tracks the user-requested filter for stability.
  // Includes userId (or "anon") so completion state of one account does NOT leak
  // to another on the same device.
  const completionKey = useMemo(() => {
    if (!resolvedId) return null;
    const scope = authUserId || "anon";
    return `study-completed:${scope}:${resolvedId}:${normalizedMode}:${initialDir}:${urlFavoritesOnly}`;
  }, [resolvedId, normalizedMode, initialDir, urlFavoritesOnly, authUserId]);

  const returnRoute = useMemo(() => buildStudyReturnRoute({
    pathname: window.location.pathname,
    resolvedId,
    isListRoute,
    searchParams,
  }), [resolvedId, isListRoute, searchParams]);
  // isListRoute is now derived once at the top of the component (from useParams).
  
  // Fetch favorites for filtering (strictly scoped to the current list/collection)
  const favoritesScope = useMemo(() => {
    if (!resolvedId) return undefined;
    return isListRoute ? { listId: resolvedId } : { collectionId: resolvedId };
  }, [resolvedId, isListRoute]);
  const favoritesQuery = useFavorites(userId, 'flashcard', favoritesScope);
  const favorites = favoritesQuery.data ?? [];
  // `toggleFavorite` (per-id, legacy) still used outside the study flow.
  // Study itself now uses the atomic group-aware mutation below.
  const toggleFavorite = useToggleFavorite();
  const setFavoriteGroup = useSetFavoriteGroup();

  // Red list state (scoped to current list)
  const redListQuery = useRedList(userId, isListRoute ? resolvedId : undefined);
  const redListIds = redListQuery.data ?? [];
  const toggleRedList = useToggleRedList();
  const setRedListGroup = useSetRedListGroup();

  // Special cards (independent queue for IA explanation export). Scope-less:
  // the list of special flashcard ids is global per user, but we still pass
  // listId on insert for traceability.
  const { data: specialIds = [] } = useSpecialFlashcards(userId);
  const toggleSpecial = useToggleSpecialFlashcard();
  const setSpecialLayer = useSetSpecialLayer();

  const listId = isListRoute ? resolvedId : undefined;

  // Load list glossary for merged hints (skip fetch when feature disabled)
  const { activeGlossary } = useListGlossary(FEATURE_FLAGS.glossary_enabled ? listId : undefined);

  // The visible deck follows a local session scope immediately. Preferences
  // remain persistence only; they are not used as a delayed live filter.
  const [deckSubset, setDeckSubset] = useState<"all" | "favorites">(initialGameSettings.subset);
  const activeDeckSubset = canUsePersonalFavorites ? deckSubset : "all";
  const [redFocusActiveForDeck, setRedFocusActiveForDeck] = useState(false);
  const favoritesScopeReady = activeDeckSubset !== "favorites"
    || !userId
    || (favoritesQuery.isSuccess
      && favoritesQuery.fetchStatus !== "fetching"
      && !favoritesQuery.isPlaceholderData);
  const redFocusScopeReady = !redFocusActiveForDeck
    || !userId
    || (redListQuery.isSuccess
      && redListQuery.fetchStatus !== "fetching"
      && !redListQuery.isPlaceholderData);
  const selectedScopeReady = favoritesScopeReady && redFocusScopeReady;
  const restoredSessionSettingsRef = useRef<string | null>(null);

  const handleSessionSettingsRestored = useCallback((settings: StudySessionSettingsSnapshot) => {
    const identity = JSON.stringify(settings);
    if (restoredSessionSettingsRef.current === identity) return;
    restoredSessionSettingsRef.current = identity;
    restoredSessionDirectionRef.current = settings.direction;
    const subset = resolvePersonalStudySubset(settings.subset, canUsePersonalFavorites).subset;
    setDeckSubset(subset);
    setRedFocusActiveForDeck(settings.redFocus);
    setFlipDirection(settings.direction);
    setSessionOverrides({
      direction: settings.direction,
      order: settings.order,
      scope: subset,
      fastMode: settings.fastMode,
      studyFlowMode: settings.studyFlowMode,
      ...(settings.writeActivityMode ? { writeActivityMode: settings.writeActivityMode } : {}),
      ...(settings.writeRewriteSide ? { writeRewriteSide: settings.writeRewriteSide } : {}),
      ...(settings.writeCorrectionMode ? { writeCorrectionMode: settings.writeCorrectionMode } : {}),
    });
  }, [canUsePersonalFavorites, setSessionOverrides]);

  useEffect(() => {
    restoredSessionDirectionRef.current = null;
    restoredSessionSettingsRef.current = null;
  }, [authUserId, normalizedMode, resolvedId]);

  const effectiveFlashcards = useMemo(() => {
    const scoped = filterCardsForStudyScope({
      cards: flashcards,
      favoriteIds: favorites,
      redListIds,
      settings: { subset: activeDeckSubset, redFocus: redFocusActiveForDeck },
    });

    return scoped;
  }, [activeDeckSubset, flashcards, favorites, redListIds, redFocusActiveForDeck]);
  const emptyStudyScope = deckLoadState.phase === "ready"
    && selectedScopeReady
    && flashcards.length > 0
    && effectiveFlashcards.length === 0
    ? redFocusActiveForDeck
      ? "red-focus" as const
      : activeDeckSubset === "favorites"
        ? "favorites" as const
        : null
    : null;

  // Memoize flashcards to prevent unstable references triggering re-init
  const prevIdsRef = useRef<string>("");
  const stableFlashcards = useMemo(() => {
    const ids = effectiveFlashcards.map(f => f.id).join(",");
    if (ids === prevIdsRef.current) return effectiveFlashcards;
    prevIdsRef.current = ids;
    return effectiveFlashcards;
  }, [effectiveFlashcards]);

  // A session may only receive cards after the complete preset for this exact
  // account/list/mode context has been applied to the engine. This prevents a
  // default preset from winning a race against the saved account preset.
  const presetContextKey = `${authUserId ?? "anon"}:${resolvedId}:${normalizedMode}`;
  const [appliedPresetContext, setAppliedPresetContext] = useState<string | null>(null);
  const sessionPresetReady = !preferencesHydrating && appliedPresetContext === presetContextKey;
  const deckReadyForEngine = deckLoadState.phase === "ready"
    && sessionPresetReady
    && selectedScopeReady;
  const engineFlashcards = deckReadyForEngine ? stableFlashcards : [];

  const {
    currentIndex,
    correctCount,
    errorCount,
    skippedCount,
    results,
    isFinished,
    isLoading: studyLoading,
    initializationState,
    isCompleting,
    isRestarting,
    totalCards,
    recordResult,
    goToNext,
    goToPrevious,
    navigateNext,
    navigatePrevious,
    canGoPrevious,
    canGoNext,
    roundNumber,
    roundCorrect,
    roundErrors,
    roundRecovered,
    hasMoreRounds,
    isGameComplete,
    startNextRound,
    resetSession,
    retryInitialization,
    startFreshSession,
    restartSession,
    gameSettings,
    setGameSettings,
    unseenCardsCount,
    missedCardsCount,
    masteryStatus,
    masteryRoundSummary,
    masteryTotalEligible,
    masteryMasteredCount,
    completeSession,
    discardSession,
    cardsOrder,
    saveProgressNow,
    studySnapshotKey,
  } = useStudyEngine(
    listId,
    engineFlashcards,
    normalizedMode,
    false,
    favorites,
    initialGameSettings,
    redListIds,
    authUserId,
    effectivePreset.studyFlowMode,
    sessionContext,
    deckReadyForEngine,
    handleSessionSettingsRestored,
    resolvedId,
  );

  // A new queue reference represents a new answerable session/round. Resetting
  // this guard prevents a restarted session with the same first card from
  // inheriting the previous click lock.
  useEffect(() => {
    answeredCardKeyRef.current = null;
  }, [cardsOrder]);

  // Derive favoritesOnly from the unified gameSettings (single source of truth for UI display)
  const favoritesOnly = canUsePersonalFavorites && gameSettings.subset === 'favorites';
  const redFocusActive = !!gameSettings.redFocus;
  // Derive order from unified gameSettings
  const order = gameSettings.mode === 'sequential' ? 'asc' : 'random';
  const masteryProgressActive = masteryStatus !== null;
  const overallTotalCards = masteryProgressActive ? masteryTotalEligible : totalCards;
  const studyProgressMetrics = resolveStudyProgressMetrics({
    mode: masteryProgressActive ? "mastery" : "continuous",
    overallTotal: overallTotalCards,
    masteredTotal: masteryMasteredCount,
    currentIndex,
    currentRoundTotal: totalCards,
  });

  // ── Sync flipDirection only after the preset source has settled ──
  useEffect(() => {
    if (preferencesHydrating) return;
    setFlipDirection(restoredSessionDirectionRef.current ?? urlDirection ?? prefs.direction);
  }, [preferencesHydrating, urlDirection, prefs.direction]);

  // Apply one immutable starting preset for each account/list/mode context.
  // Later changes come only through the controlled settings handlers.
  useEffect(() => {
    if (preferencesHydrating || authStatus === "initializing") return;
    if (appliedPresetContext === presetContextKey) return;
    setGameSettings({
      mode: prefs.order === "sequential" ? "sequential" : "random",
      subset: resolvePersonalStudySubset(
        prefs.favoritesOnly ? "favorites" : "all",
        canUsePersonalFavorites,
      ).subset,
      fastMode: prefs.fastMode,
      redFocus: false,
    });
    setDeckSubset(resolvePersonalStudySubset(
      prefs.favoritesOnly ? "favorites" : "all",
      canUsePersonalFavorites,
    ).subset);
    setRedFocusActiveForDeck(false);
    setAppliedPresetContext(presetContextKey);
    if (import.meta.env.DEV) {
      console.debug("[Study] Restored starting preset", {
        context: presetContextKey,
        mode: normalizedMode,
        order: prefs.order,
        favoritesOnly: prefs.favoritesOnly,
        fastMode: prefs.fastMode,
        direction: prefs.direction,
        studyFlowMode: effectivePreset.studyFlowMode,
      });
    }
  }, [
    appliedPresetContext,
    authStatus,
    canUsePersonalFavorites,
    effectivePreset.studyFlowMode,
    normalizedMode,
    preferencesHydrating,
    prefs.direction,
    prefs.fastMode,
    prefs.favoritesOnly,
    prefs.order,
    presetContextKey,
    setGameSettings,
  ]);

  // Direção estável por card
  const decideDirection = (idx: number): Direction => {
    // flipDirection is the SSOT for ALL modes, not just flip
    const dir = flipDirection;
    if (dir !== "any") {
      return dir;
    }
    // For "any": use a STABLE hash on the card id, not the array index.
    // Index-based alternation makes the same card flip direction whenever the
    // session is re-shuffled — which feels random/broken to the user.
    // hashToBool(cardId) guarantees the same card always shows the same side
    // in "any" mode (single source of truth: src/features/study/lib/gameCore).
    const cardId = cardsOrder[idx];
    if (!cardId) return idx % 2 === 0 ? "b-a" : "a-b";
    return hashToBool(cardId) ? "a-b" : "b-a";
  };
  
  const resolvedDirection = decideDirection(currentIndex);
  
  // Mixed mode determinístico
  const modesCycle = ["flip","write","multiple-choice","unscramble"] as const;
  const mixedModeFor = (idx: number) => modesCycle[idx % modesCycle.length];
  
  const effectiveMode = normalizedMode === "mixed" ? mixedModeFor(currentIndex) : normalizedMode;
  const isPronunciationMode = effectiveMode === "pronunciation";

  // Reload flashcards ONLY when the underlying list/collection changes.
  // Order/direction/favorites are applied locally (in effectiveFlashcards or by
  // shuffling) — they must NOT trigger a fresh DB query, which would reset the
  // session and re-init the engine for free.
  useEffect(() => {
    const access = resolveStudyAccess({
      authStatus,
      isPortalRoute: resourceContext.isPublic,
      userId: authUserId,
    });
    setFlashcards([]);
    setListTitle(null);
    setVideoInfo(null);
    if (access === "denied") {
      setDeckLoadState({ phase: "recoverable-error", reason: "auth-required" });
      return;
    }
    if (access === "wait") {
      setDeckLoadState({ phase: "waiting-auth", reason: "auth" });
      const timeoutId = setTimeout(() => {
        setDeckLoadState({ phase: "recoverable-error", reason: "auth-timeout" });
      }, STUDY_RECOVERY_WATCHDOG_MS);
      return () => clearTimeout(timeoutId);
    }
    if (!resourceContext.isPublic && !authSession) {
      setDeckLoadState({ phase: "waiting-auth", reason: "auth" });
      const timeoutId = setTimeout(() => {
        setDeckLoadState({ phase: "recoverable-error", reason: "session-timeout" });
      }, STUDY_RECOVERY_WATCHDOG_MS);
      return () => clearTimeout(timeoutId);
    }
    void loadFlashcards();
    return () => {
      loadAbortRef.current?.abort();
      loadGenerationRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    resolvedId,
    authSession,
    authStatus,
    authUserId,
    loadAttempt,
    resourceContext.isPublic,
    resourceContext.resourceKind,
    resourceContext.source,
  ]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowExitDialog(true);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  // Auto-open completion modal when activity finishes OR on re-entry if already completed
  useEffect(() => {
    if (isFinished && isGameComplete) {
      setCompletionWasRestored(false);
      setShowCompletionModal(true);
      // Persist completion state
      if (completionKey) {
        try { localStorage.setItem(completionKey, Date.now().toString()); } catch {}
      }
      return;
    }
    setShowCompletionModal(false);
    if (completionKey && !isGameComplete) {
      try { localStorage.removeItem(completionKey); } catch {}
    }
  }, [isFinished, isGameComplete, completionKey]);

  // On mount: check if this session was already completed and show restart prompt
  useEffect(() => {
    if (!completionKey || loading || studyLoading || !sessionPresetReady) return;
    try {
      const saved = localStorage.getItem(completionKey);
      if (saved) {
        setCompletionWasRestored(true);
        setShowCompletionModal(true);
      }
    } catch {}
  }, [completionKey, loading, sessionPresetReady, studyLoading]);

  const loadFlashcards = async () => {
    if (!resolvedId) return;

    loadAbortRef.current?.abort();
    const abortController = new AbortController();
    loadAbortRef.current = abortController;
    const generation = ++loadGenerationRef.current;
    const requestContextKey = buildStudyDeckRequestContextKey({
      ...resourceContext,
      userId: authUserId,
    });
    loadContextRef.current = requestContextKey;
    const isGenerationCurrent = () => loadGenerationRef.current === generation
      && loadContextRef.current === requestContextKey;
    const isCurrent = () => isStudyDeckRequestCurrent({
      activeGeneration: loadGenerationRef.current,
      generation,
      activeContextKey: loadContextRef.current,
      contextKey: requestContextKey,
      signal: abortController.signal,
    });
    const requestId = createStudyDeckRequestId();
    setDeckLoadState({
      phase: loadAttempt > 0 ? "retrying" : "loading",
      attempt: loadAttempt,
      requestId,
    });

    if (import.meta.env.DEV) {
      console.debug("[Study] Loading flashcards", {
        requestId,
        generation,
        resourceId: resolvedId,
        resourceKind: resourceContext.resourceKind,
        source: resourceContext.source,
        public: resourceContext.isPublic,
        authStatus,
      });
    }

    try {

    // Offline fallback
    if (!navigator.onLine && isListRoute) {
      try {
        const offlineData = await withStudyRuntimeTimeout(
          getOfflineList(resolvedId, userId),
          STUDY_REMOTE_RESTORE_TIMEOUT_MS,
          "offline-list",
        );
        if (!isCurrent()) return;
        if (offlineData) {
          const grouped = prepareLayeredStudyDeck(offlineData.flashcards as any[]);
          const orderedData = initialOrder === "random" ? shuffleArray([...grouped]) : grouped;
          // An offline cache is a recovery source, not authoritative evidence
          // that the list is empty. Older/partial caches can legitimately
          // contain metadata without the deck; never show the destructive
          // empty state or create a session from that ambiguous result.
          if (orderedData.length === 0) {
            setDeckLoadState({
              phase: "empty-unconfirmed",
              reason: "offline-empty",
              requestId,
              source: resourceContext.source,
            });
            return;
          }
          setFlashcards(orderedData as Flashcard[]);
          setDeckLoadState({
            phase: "ready",
            requestId,
            source: resourceContext.source,
            rawCount: offlineData.flashcards.length,
            playableCount: orderedData.length,
          });
          setListTitle(offlineData.listMeta.title);
          setListSettings({
            studyType: (offlineData.listMeta.study_type === "general" ? "general" : "language") as "language" | "general",
            langA: offlineData.listMeta.lang_a,
            langB: offlineData.listMeta.lang_b,
            labelsA: offlineData.listMeta.labels_a,
            labelsB: offlineData.listMeta.labels_b,
            ttsEnabled: offlineData.listMeta.tts_enabled,
          });
          toast.info("Usando dados offline");
          return;
        }
      } catch {
        // fall through
      }
      setDeckLoadState({ phase: "recoverable-error", reason: "offline-unavailable", requestId });
      return;
    }
    
    // Clara Master P0 — auth is owned by AuthContext. No local re-fetch here.
    // `authSession` from useAuth() is the single source of truth.
    const session = authSession;

    // ── PERF: Fetch flashcards + list metadata in parallel ──
    const deckResult = await withStudyRuntimeTimeout(
      loadStudyDeck<Flashcard>({
        requestId,
        resourceKind: resourceContext.resourceKind,
        resourceId: resolvedId,
        source: resourceContext.source,
        hasConfirmedSession: Boolean(session),
        signal: abortController.signal,
        fetchPage: (from, to) => fetchStudyDeckPage<Flashcard>({
          ...resourceContext,
          signal: abortController.signal,
          from,
          to,
        }),
        verifyAvailability: () => probeStudyDeckAvailability({
          ...resourceContext,
          signal: abortController.signal,
        }),
        prepare: (rawCards) => prepareLayeredStudyDeck(rawCards),
      }),
      STUDY_REQUIRED_LOAD_TIMEOUT_MS,
      resourceContext.isPublic ? "portal-cards" : "study-cards",
      () => abortController.abort(),
    );

    if (!isCurrent()) return;
    if (deckResult.status === "confirmed-empty") {
      setFlashcards([]);
      setDeckLoadState({
        phase: "confirmed-empty",
        requestId: deckResult.requestId,
        source: deckResult.source,
      });
      return;
    }
    if (deckResult.status === "unconfirmed") {
      setFlashcards([]);
      setDeckLoadState({
        phase: "empty-unconfirmed",
        requestId: deckResult.requestId,
        source: deckResult.source,
        reason: deckResult.reason,
      });
      return;
    }

    const metadataClient = resourceContext.isPublic ? publicSupabase : supabase;
    const listPromise = isListRoute
      ? metadataClient
          .from("lists")
          .select("title, folder_id, study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled")
          .eq("id", resolvedId)
          .abortSignal(abortController.signal)
          .maybeSingle()
      : Promise.resolve({ data: null });

    // Layered cards: collapse each [CAMADAS] group into a SINGLE deck entry.
    // The entry-point carries `__layers` with the full ordered group; the
    // view then lets the user navigate "Camada anterior/Próxima camada"
    // INSIDE the same deck position. Principals/aggregators never play.
    const studyableCards = deckResult.playableCards;
    const rawData = initialOrder === "random" ? shuffleArray([...studyableCards]) : studyableCards;
    
    // ── PERF: Pre-parse word_hints at load time (off the render path) ──
    // Also pre-parse hints inside __layers, since the visible card may be
    // a layer and rendering reads preParsedHints from it.
    const preParse = (c: any) => ({
      ...c,
      preParsedHints: c.word_hints ? parseExtendedWordHints(c.word_hints) : undefined,
    });
    const orderedData: Flashcard[] = rawData.map((card: any) => {
      const base = preParse(card);
      if (Array.isArray(card.__layers)) {
        base.__layers = card.__layers.map(preParse);
      }
      return base;
    });

    // Cards are the only required dependency for the first playable render.
    // Metadata may continue loading within its own bounded window.
    setFlashcards(orderedData);
    setDeckLoadState({
      phase: "ready",
      requestId: deckResult.requestId,
      source: deckResult.source,
      rawCount: deckResult.rawCards.length,
      playableCount: deckResult.playableCards.length,
    });

    const listResult = await withStudyRuntimeTimeout(
      listPromise,
      STUDY_REMOTE_RESTORE_TIMEOUT_MS,
      "list-metadata",
      () => abortController.abort(),
    ).catch(() => ({ data: null }));
    if (!isCurrent()) return;
    const listData = listResult.data as any;

    if (isListRoute && listData) {
      setListTitle(listData.title);

      // ── PERF: Fetch folder + video in parallel ──
      const folderPromise = listData.folder_id
        ? metadataClient
            .from("folders")
            .select("study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled")
            .eq("id", listData.folder_id)
            .abortSignal(abortController.signal)
            .maybeSingle()
        : Promise.resolve({ data: null });

      const videoPromise = listData.folder_id
        ? metadataClient
            .from("videos")
            .select("video_id, title")
            .eq("folder_id", listData.folder_id)
            .eq("is_published", true)
            .order("order_index", { ascending: true })
            .limit(1)
            .abortSignal(abortController.signal)
            .maybeSingle()
        : Promise.resolve({ data: null });

      const [folderResult, videoResult] = await withStudyRuntimeTimeout(
        Promise.all([folderPromise, videoPromise]),
        STUDY_REMOTE_RESTORE_TIMEOUT_MS,
        "study-metadata",
        () => abortController.abort(),
      ).catch(() => [{ data: null }, { data: null }] as const);
      if (!isCurrent()) return;

      const resolved = resolveEffectiveListSettings(listData, folderResult.data);
      
      // ── PERF: Batch state updates together ──
      setListSettings({
        studyType: resolved.studyType as "language" | "general",
        langA: resolved.langA,
        langB: resolved.langB,
        labelsA: resolved.labelsA,
        labelsB: resolved.labelsB,
        ttsEnabled: resolved.ttsEnabled,
      });

      if (videoResult.data) {
        setVideoInfo({
          videoId: (videoResult.data as any).video_id,
          title: (videoResult.data as any).title,
        });
      }
    }

    } catch (err) {
      if (!isGenerationCurrent()) return;
      if (err instanceof Error && err.name === "AbortError") {
        setDeckLoadState({ phase: "cancelled", requestId });
        return;
      }
      setDeckLoadState({
        phase: "recoverable-error",
        reason: err instanceof Error ? err.name : "cards-load-failed",
        requestId,
      });
      toast.error("Não foi possível carregar os cards. Você pode tentar novamente.");
    }
  };

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const handleNext = (correct: boolean, skipped: boolean = false) => {
    const identity = resolveStudyAnswerIdentity(
      displayedCardIdRef.current,
      cardsOrder[currentIndex],
    );
    const expectedEngineCardId = cardsOrder[currentIndex];
    if (!identity || !expectedEngineCardId || identity.engineCardId !== expectedEngineCardId) {
      logStudyRuntime("answer-rejected", {
        reason: "card-identity-mismatch",
        expectedCardId: expectedEngineCardId ?? null,
        submittedCardId: identity?.engineCardId ?? null,
        index: currentIndex,
        round: roundNumber,
      });
      toast.error("A sessão precisou reconciliar o card atual. Tente novamente.");
      return;
    }

    // One answer per rendered queue position. This blocks double Enter/click
    // without preventing a legitimate repeated card at a later index/round.
    const answerKey = `${roundNumber}:${currentIndex}:${identity.engineCardId}`;
    if (answeredCardKeyRef.current === answerKey) return;
    answeredCardKeyRef.current = answerKey;

    logStudyRuntime("answer-start", {
      action: skipped ? "skip-unknown" : correct ? "answer-correct" : "answer-incorrect",
      cardId: identity.engineCardId,
      index: currentIndex,
      round: roundNumber,
    });

    void recordResult(
      identity.progressCardId,
      correct,
      skipped,
      identity.engineCardId,
    ).catch((error) => {
      answeredCardKeyRef.current = null;
      logStudyRuntime("answer-error", {
        action: skipped ? "skip-unknown" : correct ? "answer-correct" : "answer-incorrect",
        cardId: identity.engineCardId,
        index: currentIndex,
        round: roundNumber,
        error: error instanceof Error ? error.name : "unknown",
      });
      toast.error("Não foi possível registrar esta ação. Tente novamente.");
    });
    goToNext();
  };

  const currentAnswerKey = `${roundNumber}:${currentIndex}:${cardsOrder[currentIndex] ?? "none"}`;

  const requestSkip = () => {
    if (!cardsOrder[currentIndex] || showSkipDialog) return;
    skipCardKeyRef.current = currentAnswerKey;
    logStudyRuntime("skip-requested", {
      cardId: cardsOrder[currentIndex],
      index: currentIndex,
      round: roundNumber,
    });
    setShowSkipDialog(true);
  };

  const classifySkip = (classification: "known" | "unknown") => {
    if (!showSkipDialog || skipCardKeyRef.current !== currentAnswerKey) {
      setShowSkipDialog(false);
      skipCardKeyRef.current = null;
      toast.info("O card mudou; nenhum pulo foi registrado.");
      return;
    }
    setShowSkipDialog(false);
    skipCardKeyRef.current = null;
    if (classification === "known") {
      handleNext(true);
      return;
    }
    handleNext(false, true);
  };

  const handleReviewErrors = () => {
    const errorIds = results.filter((r) => !r.correct && !r.skipped).map((r) => r.flashcardId);
    // Look up error cards from the full flashcards array (not effectiveFlashcards which may be filtered)
    const errorCards = flashcards.filter((card) => errorIds.includes(card.id));
    
    if (errorCards.length > 0) {
      const shuffledErrorCards = shuffleArray(errorCards);
      setFlashcards(shuffledErrorCards);
      setShowCompletionModal(false);
      if (completionKey) {
        try { localStorage.removeItem(completionKey); } catch {}
      }
      resetSession();
    }
  };

  const handleExit = () => {
    if (exitInFlightRef.current) return;
    exitInFlightRef.current = true;
    setShowExitDialog(false);
    // Local persistence happens synchronously inside saveProgressNow. The
    // bounded remote flush must never hold navigation hostage.
    void saveProgressNow();
    navigate(returnRoute, { replace: true });
  };

  const finishAndReturn = async () => {
    if (completionWasRestored) {
      await discardSession();
    } else {
      const completed = await completeSession();
      if (!completed) return;
    }
    setShowCompletionModal(false);
    navigate(returnRoute, { replace: true });
  };

  const handleCompleteAndExit = finishAndReturn;
  const handleFinishedExit = finishAndReturn;

  const handleDirectionChange = (value: string) => {
    const dir = normalizeDirection(value);
    restoredSessionDirectionRef.current = null;
    setFlipDirection(dir);
    updatePrefs({ direction: dir });
  };

  const handleSettingsChange = (newSettings: GameSettings) => {
    const requestedSubset = newSettings.subset;
    const resolvedSubset = resolvePersonalStudySubset(
      requestedSubset,
      canUsePersonalFavorites,
    ).subset;
    if (requestedSubset === "favorites" && resolvedSubset === "all") {
      toast.info("Favoritos exigem uma conta autenticada. Mostrando todos os cards.");
    }
    const coerced: GameSettings = {
      ...newSettings,
      subset: resolvedSubset,
      mode: newSettings.redFocus ? "sequential" : newSettings.mode,
      redFocus: !!newSettings.redFocus,
    };

    const subsetChanged = coerced.subset !== gameSettings.subset;
    const redFocusChanged = !!coerced.redFocus !== !!gameSettings.redFocus;

    if (subsetChanged || redFocusChanged) {
      void saveProgressNow();
    }

    setDeckSubset(coerced.subset);
    setRedFocusActiveForDeck(!!coerced.redFocus);
    setGameSettings(coerced);
    updatePrefs({
      order: coerced.mode === "sequential" ? "sequential" : "random",
      ...(requestedSubset === "favorites" && resolvedSubset === "all"
        ? {}
        : { favoritesOnly: coerced.subset === "favorites" }),
      fastMode: coerced.fastMode ?? false,
    });
  };

  const handleRestartWithSettings = async () => {
    setCompletionWasRestored(false);
    setShowCompletionModal(false);
    if (completionKey) {
      try { localStorage.removeItem(completionKey); } catch {}
    }
    await restartSession(gameSettings);
  };

  // Use engine's cardsOrder to resolve the actual current card
  const engineCurrentCardId = cardsOrder[currentIndex];
  // PERF: O(1) lookup via memoized Map instead of repeated find() across large lists.
  const flashcardById = useMemo(
    () => new Map(flashcards.map((card) => [card.id, card])),
    [flashcards]
  );
  const effectiveFlashcardById = useMemo(
    () => new Map(effectiveFlashcards.map((card) => [card.id, card])),
    [effectiveFlashcards]
  );
  const engineCurrentCard = engineCurrentCardId
    ? (effectiveFlashcardById.get(engineCurrentCardId) || flashcardById.get(engineCurrentCardId))
    : undefined;

  // Status target resolution (currentStatusTargets) is defined further below,
  // after `displayedCard` is established. The handlers and derived flags for
  // favorite / red-list / special live there so the entire button system has
  // a single, predictable source of truth.

  // ── In-game card edit ──
  // Mirrors ListDetail's handleUpdateFlashcard but updates local `flashcards`
  // state (not React Query cache) so the current session sees changes
  // immediately WITHOUT resetting cardsOrder or currentIndex.
  const handleUpdateFlashcardInGame = async (
    flashcardId: string,
    term: string,
    translation: string,
    hint: string,
    imageUrlA?: string,
    imageUrlB?: string,
    wordHints?: unknown,
  ) => {
    try {
      const updateData: Record<string, unknown> = {
        term,
        translation,
        hint: hint || null,
        image_url_a: imageUrlA || null,
        image_url_b: imageUrlB || null,
        word_hints:
          wordHints && Array.isArray(wordHints) && wordHints.length > 0
            ? wordHints
            : null,
      };

      const { error } = await supabase
        .from("flashcards")
        .update(updateData as any)
        .eq("id", flashcardId);

      if (error) throw error;

      // In-place update: preserves session order + currentIndex.
      // Recomputes preParsedHints so the lightbulb / glossary react instantly.
      // Apply update to either the top-level deck card OR any layer inside
      // a grouped (__layers) entry. Without the deep walk, editing layer 2/3
      // of a [CAMADAS] group wouldn't refresh the visible content.
      const applyUpdate = (target: any) => ({
        ...target,
        term,
        translation,
        hint: hint || null,
        image_url_a: imageUrlA || null,
        image_url_b: imageUrlB || null,
        word_hints:
          wordHints && Array.isArray(wordHints) && (wordHints as unknown[]).length > 0
            ? wordHints
            : null,
        preParsedHints:
          wordHints && Array.isArray(wordHints) && (wordHints as unknown[]).length > 0
            ? parseExtendedWordHints(wordHints)
            : undefined,
      });
      setFlashcards(prev =>
        prev.map(card => {
          if (card.id === flashcardId) return applyUpdate(card) as Flashcard;
          const layers = (card as any).__layers as Flashcard[] | undefined;
          if (Array.isArray(layers) && layers.some(l => l.id === flashcardId)) {
            return {
              ...card,
              __layers: layers.map(l => (l.id === flashcardId ? applyUpdate(l) : l)),
            } as Flashcard;
          }
          return card;
        })
      );

      toast.success("Card atualizado!");
    } catch (err: any) {
      toast.error("Erro ao atualizar: " + (err?.message ?? "desconhecido"));
    }
  };

  // currentCard is now derived from the engine's cardsOrder (engineCurrentCard above)
  const currentCard = engineCurrentCard;

  // ── Layered cards: cycle through layers within a single deck entry ──
  // Local state only — does NOT advance the engine index. When the engine
  // moves to a new card, layerIdx resets to 0.
  const [layerIdx, setLayerIdx] = useState(0);
  // Track the last card id we synced layerIdx for. The sync effect below
  // depends on favorites/redListIds so it can pick the right starting layer
  // when the deck CARD changes, but it must NOT re-run when those arrays
  // change in isolation — otherwise the user's manual "Próxima camada"
  // navigation gets wiped on every favorite/red-list toggle re-render.
  const lastSyncedCardIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (engineCurrentCardId === lastSyncedCardIdRef.current) return;
    lastSyncedCardIdRef.current = engineCurrentCardId ?? null;

    // Default to layer 0. When the user is in Favorites mode (or Foco Vermelho),
    // try to start on the first layer that is favorited / red-listed so the
    // group opens on the layer the student actually starred.
    const card = engineCurrentCardId ? flashcardById.get(engineCurrentCardId) : undefined;
    const layers = (card as any)?.__layers as Flashcard[] | undefined;
    if (!layers || layers.length === 0) {
      setLayerIdx(0);
      return;
    }
    // CLARA MASTER — Persistência de camada. Antes de cair no default 0,
    // tentamos restaurar a última camada visitada NESTE card, para que ao
    // fechar e reabrir o app o usuário retome exatamente onde parou.
    const persisted = engineCurrentCardId && studySnapshotKey
      ? readStudyLayerSnapshot(studySnapshotKey)
      : null;
    if (
      persisted
      && persisted.cardId === engineCurrentCardId
      && persisted.layerIdx < layers.length
    ) {
      setLayerIdx(persisted.layerIdx);
      return;
    }
    setLayerIdx(0);
    return;
  }, [engineCurrentCardId, flashcardById, urlFavoritesOnly, favorites, redListIds, redFocusActiveForDeck, studySnapshotKey]);
  const cardLayers = (currentCard as any)?.__layers as Flashcard[] | undefined;
  const hasLayers = Array.isArray(cardLayers) && cardLayers.length > 1;
  const safeLayerIdx = hasLayers ? Math.min(layerIdx, cardLayers!.length - 1) : 0;

  // Persiste a camada visível a cada mudança, escopada ao snapshot atual.
  useEffect(() => {
    if (!studySnapshotKey || !engineCurrentCardId) return;
    if (!hasLayers) return;
    writeStudyLayerSnapshot(studySnapshotKey, engineCurrentCardId, safeLayerIdx);
    // The local layer snapshot is a fast fallback; the study engine also
    // mirrors the same position into the authenticated session snapshot so a
    // device/browser change does not reopen the group on layer zero.
    void saveProgressNow({ cardId: engineCurrentCardId, layerIdx: safeLayerIdx });
  }, [studySnapshotKey, engineCurrentCardId, safeLayerIdx, hasLayers, saveProgressNow]);

  // Centralized status-target resolution lives further below (after
  // `displayedCard` is defined) — see `currentStatusTargets`.

  // Stable handlers for layer navigation. These NEVER touch the engine,
  // currentIndex, progress, or session counters — they only flip the
  // visible layer inside the current group.
  const goToNextLayer = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const n = cardLayers?.length ?? 0;
    if (n <= 1) return;
    setLayerIdx((i) => (i + 1) % n);
  }, [cardLayers]);
  const goToPreviousLayer = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const n = cardLayers?.length ?? 0;
    if (n <= 1) return;
    setLayerIdx((i) => (i - 1 + n) % n);
  }, [cardLayers]);

  // The "displayed" card is the active layer when the deck card is layered.
  // It carries the same shape as a normal flashcard, including its own id —
  // so progress, favorites, edit, etc. naturally target the visible layer.
  const displayedCard: Flashcard | undefined = hasLayers
    ? { ...(cardLayers![safeLayerIdx] as Flashcard), preParsedHints: (cardLayers![safeLayerIdx] as any).preParsedHints }
    : currentCard;
  useEffect(() => {
    displayedCardIdRef.current = displayedCard?.id ?? null;
  }, [displayedCard?.id]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Centralized status-target resolution for Favorite / Red List / Special.
  // Backed by `resolveCardStatusIdentity` so every button in the study screen
  // shares the exact same identity contract:
  //   - Favorite + Red List → canonicalGroupId  (parent_card_id when layered)
  //   - Special             → visibleLayerId    (per-layer semantic)
  // `legacyIds` lets the UI recognise marks left under old per-layer ids
  // during the migration window, and lets the mutation hooks scrub them
  // in a single DELETE.
  // ─────────────────────────────────────────────────────────────────────────────
  const statusIdentity = useMemo(
    () =>
      resolveCardStatusIdentity({
        displayedCard,
        engineCard: engineCurrentCard ?? null,
        layers: cardLayers ?? null,
      }),
    [displayedCard, engineCurrentCard, cardLayers],
  );

  // The stable pipeline is opt-in. When the flag is off (the safe default),
  // this gate is a no-op and the legacy handlers below remain unchanged.
  const stableStatus = useGroupStatusGate({
    statusGroupUid: statusIdentity.stableGroupId,
    legacyIsFavorite: statusIdentity.canonicalGroupId
      ? favorites.includes(statusIdentity.canonicalGroupId)
      : false,
    legacyIsRedList: statusIdentity.canonicalGroupId
      ? redListIds.includes(statusIdentity.canonicalGroupId)
      : false,
  });
  const setStableStatus = useSetFlashcardGroupStatus();

  const isDisplayedGroupFavorite = useMemo(() => {
    if (stableStatus.mode === "new") return stableStatus.effectiveIsFavorite;
    const c = statusIdentity.canonicalGroupId;
    if (c && favorites.includes(c)) return true;
    // Legacy fallback: recognise marks saved against per-layer ids until
    // the canonicalize migration finishes propagating.
    return statusIdentity.legacyIds.some((id) => favorites.includes(id));
  }, [stableStatus, statusIdentity, favorites]);

  const isDisplayedGroupRedListed = useMemo(() => {
    if (stableStatus.mode === "new") return stableStatus.effectiveIsRedList;
    const c = statusIdentity.canonicalGroupId;
    if (c && redListIds.includes(c)) return true;
    return statusIdentity.legacyIds.some((id) => redListIds.includes(id));
  }, [stableStatus, statusIdentity, redListIds]);

  // Specials are strictly per-visible-layer — never matched against legacy.
  const isDisplayedSpecial = useMemo(
    () =>
      statusIdentity.visibleLayerId
        ? specialIds.includes(statusIdentity.visibleLayerId)
        : false,
    [statusIdentity.visibleLayerId, specialIds],
  );

  const handleToggleFavorite = () => {
    if (!userId) return;
    if (stableStatus.mode === "new" && statusIdentity.stableGroupId) {
      if (setStableStatus.isPending) return;
      const next = !stableStatus.effectiveIsFavorite;
      setStableStatus.mutate({
        statusGroupUid: statusIdentity.stableGroupId,
        isFavorite: next,
        isRedList: next ? stableStatus.effectiveIsRedList : false,
      });
      return;
    }
    const canonical = statusIdentity.canonicalGroupId;
    if (!canonical) return;
    if (setFavoriteGroup.isPending) return; // single-toast guard
    setFavoriteGroup.mutate({
      canonicalId: canonical,
      cleanupIds: statusIdentity.legacyIds,
      enable: !isDisplayedGroupFavorite,
    });
  };

  const handleToggleRedList = () => {
    if (!userId) return;
    if (stableStatus.mode === "new" && statusIdentity.stableGroupId) {
      if (!stableStatus.effectiveIsFavorite) {
        toast.error('Primeiro marque o card como favorito ⭐');
        return;
      }
      if (setStableStatus.isPending) return;
      setStableStatus.mutate({
        statusGroupUid: statusIdentity.stableGroupId,
        isFavorite: true,
        isRedList: !stableStatus.effectiveIsRedList,
      });
      return;
    }
    const canonical = statusIdentity.canonicalGroupId;
    if (!canonical) return;
    if (setRedListGroup.isPending) return;
    // Pre-check: red list requires favorite first.
    if (!isDisplayedGroupRedListed && !isDisplayedGroupFavorite) {
      toast.error('Primeiro marque o card como favorito ⭐');
      return;
    }
    setRedListGroup.mutate({
      canonicalId: canonical,
      cleanupIds: statusIdentity.legacyIds,
      enable: !isDisplayedGroupRedListed,
    });
  };

  // Specials are per-layer. Never touch the group.
  const handleToggleSpecial = () => {
    if (!userId) return;
    const layer = statusIdentity.visibleLayerId;
    if (!layer) return;
    if (setSpecialLayer.isPending) return;
    setSpecialLayer.mutate({
      visibleLayerId: layer,
      listId: listId ?? null,
      enable: !isDisplayedSpecial,
    });
  };

  // DEV-only diagnostic for layer navigation. Stripped in production builds.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    // eslint-disable-next-line no-console
    console.debug("[LayerNav]", {
      engineCurrentCardId,
      groupTitle: (currentCard as any)?.__groupTitle,
      layerIdx,
      safeLayerIdx,
      layerCount: cardLayers?.length,
      displayedCardId: displayedCard?.id,
      displayedTerm: displayedCard?.term,
    });
  }, [engineCurrentCardId, layerIdx, safeLayerIdx, cardLayers?.length, displayedCard?.id]);

  // ── DEV diagnostic: confirm the direction propagated from URL → prefs → engine
  // matches what the user picked in GamesHub. No-op in production builds.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!currentCard) return;
    const resolvedDirection = (() => {
      const dir = flipDirection;
      if (dir !== "any") return dir;
      // Mirror decideDirection's "any" branch (deterministic per-card)
      return currentIndex % 2 === 0 ? "a-b" : "b-a";
    })();
    const promptShown = resolvedDirection === "a-b" ? currentCard.term : currentCard.translation;
    const expectedAnswer = resolvedDirection === "a-b" ? currentCard.translation : currentCard.term;
    console.debug("[DirectionDebug]", {
      urlDir: urlDirection,
      prefsDirection: prefs.direction,
      flipDirection,
      resolvedDirection,
      sideA: currentCard.term,
      sideB: currentCard.translation,
      promptShown,
      expectedAnswer,
      mode: effectiveMode,
    });
  }, [currentCard, currentIndex, flipDirection, urlDirection, prefs.direction, effectiveMode]);

  // ── PERF: Read pre-parsed hints from cards (O(1) lookup, no parsing at render time) ──
  const getParsedHints = useCallback((card: Flashcard) => {
    return card.preParsedHints || [];
  }, []);

  // Merge glossary + per-card manual hints for the currently visible card
  // (which is a layer when the deck entry is layered).
  const currentCardId = displayedCard?.id;
  const currentTerm = displayedCard?.term;
  const currentTranslation = displayedCard?.translation;

  const currentMergedHintsA = useMemo(() => {
    if (!displayedCard || !currentTerm) return undefined;
    const manual = getParsedHints(displayedCard);
    if (activeGlossary.length === 0 && manual.length === 0) return undefined;
    const langCtx = { langA: listSettings.langA, langB: listSettings.langB };
    return mergeGlossaryAndManual(currentTerm, "A", activeGlossary, manual, langCtx);
  }, [currentCardId, currentTerm, activeGlossary, getParsedHints, displayedCard, listSettings.langA, listSettings.langB]);

  const currentMergedHintsB = useMemo(() => {
    if (!displayedCard || !currentTranslation) return undefined;
    const manual = getParsedHints(displayedCard);
    if (activeGlossary.length === 0 && manual.length === 0) return undefined;
    const langCtx = { langA: listSettings.langA, langB: listSettings.langB };
    return mergeGlossaryAndManual(currentTranslation, "B", activeGlossary, manual, langCtx);
  }, [currentCardId, currentTranslation, activeGlossary, getParsedHints, displayedCard, listSettings.langA, listSettings.langB]);

  // Clara Master P0 — NEVER auto-persist `favoritesOnly: false` just because
  // the favorites query came back empty. Auth races, fetching states, and
  // placeholder data would all wipe the user's preference on cold restart.
  //
  // When the filter genuinely falls back (confirmed-zero favorites for the
  // authenticated user), we surface a one-shot toast and rely on the
  // existing "Estudar todos" button (handleDisableFavoritesFilter) for the
  // explicit user action. Persistent prefs only change on explicit action.
  // Helper to disable favorites filter and restart with all cards
  const handleDisableFavoritesFilter = () => {
    updatePrefs({ favoritesOnly: false });
    handleSettingsChange({ ...gameSettings, subset: 'all' });
    // Restart with all cards
    restartSession({ ...gameSettings, subset: 'all' });
  };

  // ── Global configurable keyboard shortcuts (cross-mode) ───────────────────
  // Mode-specific actions (flip, knew, didn't know, audio in Flip, write submit
  // via Enter) remain owned by each view component. Here we centralize the
  // actions that always make sense regardless of the active mode: navigation,
  // layer cycling, and restarting the session. Disabled while a modal is open
  // so it doesn't fight with dialog focus / Escape handling.
  // Track whether the active Write view is still waiting for a first
  // submission — while true, suppress global next/prev/next-layer shortcuts
  // so they don't conflict with typing or bypass the Advance Gate.
  const [writeShortcutsLocked, setWriteShortcutsLocked] = useState<boolean>(() => isWriteAnswerLocked());
  useEffect(() => {
    setWriteShortcutsLocked(isWriteAnswerLocked());
    return subscribeWriteAnswerLock(setWriteShortcutsLocked);
  }, []);

  useStudyShortcuts(
    {
      nextCard: () => {
        if (writeShortcutsLocked) return;
        // A global next is a skip request, not an automatic wrong answer.
        if (currentCard) requestSkip();
      },
      prevCard: () => {
        if (writeShortcutsLocked) return;
        if (masteryProgressActive) return;
        goToPrevious();
      },
      nextLayer: () => {
        if (writeShortcutsLocked) return;
        if (hasLayers && cardLayers) {
          setLayerIdx((i) => (i + 1) % cardLayers.length);
        }
      },
      restart: () => {
        handleRestartWithSettings();
      },
    },
    {
      disabled: showExitDialog || showCompletionModal || showSkipDialog,
    },
  );

  const [scopeWaitExpired, setScopeWaitExpired] = useState(false);
  useEffect(() => {
    if (selectedScopeReady) {
      setScopeWaitExpired(false);
      return;
    }
    const timeoutId = setTimeout(
      () => setScopeWaitExpired(true),
      STUDY_RECOVERY_WATCHDOG_MS,
    );
    return () => clearTimeout(timeoutId);
  }, [selectedScopeReady]);

  const sessionReadiness = useMemo(() => resolveStudySessionReadiness({
    pageLoading: loading || preferencesHydrating || !sessionPresetReady,
    engineLoading: studyLoading,
    auxiliaryLoading: !selectedScopeReady && !scopeWaitExpired,
    eligibleCardIds: engineFlashcards.map((card) => card.id),
    cardsOrder,
    currentIndex,
    isFinished,
    masteryStatus,
    recoveryFailed: initializationState === "failed",
  }), [
    cardsOrder,
    currentIndex,
    engineFlashcards,
    initializationState,
    isFinished,
    loading,
    masteryStatus,
    preferencesHydrating,
    sessionPresetReady,
    scopeWaitExpired,
    selectedScopeReady,
    studyLoading,
  ]);

  const [automaticRecoveryAttempted, setAutomaticRecoveryAttempted] = useState(false);
  const [showSessionRecovery, setShowSessionRecovery] = useState(false);
  useEffect(() => {
    if (
      sessionReadiness.phase === "ready" ||
      sessionReadiness.phase === "completed" ||
      sessionReadiness.phase === "empty"
    ) {
      if (automaticRecoveryAttempted) setAutomaticRecoveryAttempted(false);
      if (showSessionRecovery) setShowSessionRecovery(false);
      return;
    }
    if (flashcards.length === 0 || loadFailure || preferencesHydrating || !sessionPresetReady) return;

    const timeoutId = setTimeout(() => {
      if (!automaticRecoveryAttempted) {
        setAutomaticRecoveryAttempted(true);
        retryInitialization();
      } else {
        setShowSessionRecovery(true);
      }
    }, STUDY_RECOVERY_WATCHDOG_MS);
    return () => clearTimeout(timeoutId);
  }, [
    automaticRecoveryAttempted,
    flashcards.length,
    loadFailure,
    preferencesHydrating,
    retryInitialization,
    sessionPresetReady,
    sessionReadiness.phase,
    showSessionRecovery,
  ]);

  const handleRecoveryRetry = () => {
    const shouldReloadCards = Boolean(loadFailure) || flashcards.length === 0;
    setShowSessionRecovery(false);
    setAutomaticRecoveryAttempted(false);
    if (shouldReloadCards) {
      setDeckLoadState({ phase: "retrying", attempt: loadAttempt + 1 });
      setLoadAttempt((attempt) => attempt + 1);
      return;
    }
    retryInitialization();
  };

  const handleRecoveryFresh = () => {
    const shouldReloadCards = Boolean(loadFailure) || flashcards.length === 0;
    setShowSessionRecovery(false);
    setAutomaticRecoveryAttempted(false);
    if (shouldReloadCards) {
      setDeckLoadState({ phase: "retrying", attempt: loadAttempt + 1 });
      setLoadAttempt((attempt) => attempt + 1);
      return;
    }
    startFreshSession();
  };

  if (scopeWaitExpired) {
    return (
      <StudySessionRecovery
        onRetry={() => {
          setScopeWaitExpired(false);
          if (activeDeckSubset === "favorites") void favoritesQuery.refetch();
          if (redFocusActiveForDeck) void redListQuery.refetch();
        }}
        onStartFresh={() => undefined}
        onBack={() => void handleExit()}
        technicalId="ST-filter-data-timeout"
        allowStartFresh={false}
      />
    );
  }

  if (
    loadFailure ||
    deckLoadState.phase === "cancelled" ||
    showSessionRecovery ||
    initializationState === "failed" ||
    sessionReadiness.phase === "failed"
  ) {
    return (
      <StudySessionRecovery
        onRetry={handleRecoveryRetry}
        onStartFresh={handleRecoveryFresh}
        onBack={() => void handleExit()}
        isRetrying={loading || studyLoading || preferencesHydrating || !sessionPresetReady}
        technicalId={loadFailure || deckLoadState.phase === "cancelled"
          ? studyDeckTechnicalId("ST", deckLoadState)
          : `ST-${sessionReadiness.reason}`}
        allowStartFresh={!loadFailure && flashcards.length > 0}
      />
    );
  }

  if (sessionReadiness.phase === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Engine still building cardsOrder (window between setFlashcards and engine init).
  // Show a discreet spinner instead of the alarming "Não foi possível iniciar" screen.
  // The real "no cards" case is handled inside loadFlashcards() with a toast + redirect.
  if (sessionReadiness.phase === "recovering") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Preparando sua sessão...</p>
      </div>
    );
  }

  // Only the independent authority probe can produce this business state.
  if (confirmedEmpty) {
    return (
      <StudyDeckEmptyState
        onRetry={() => {
          setDeckLoadState({ phase: "retrying", attempt: loadAttempt + 1 });
          setLoadAttempt((attempt) => attempt + 1);
        }}
        onBack={() => void handleExit()}
        isRetrying={loading}
        resourceLabel={isListRoute ? "lista" : "coleção"}
      />
    );
  }

  if (emptyStudyScope) {
    return (
      <StudyScopeEmptyState
        scope={emptyStudyScope}
        onStudyAll={handleDisableFavoritesFilter}
        onStudyFavorites={emptyStudyScope === "red-focus"
          ? () => handleSettingsChange({ ...gameSettings, redFocus: false, subset: "favorites" })
          : undefined}
        onBack={() => void handleExit()}
      />
    );
  }

  if (!currentCard && !isFinished) {
    return (
      <StudySessionRecovery
        onRetry={handleRecoveryRetry}
        onStartFresh={handleRecoveryFresh}
        onBack={() => void handleExit()}
        isRetrying={loading || studyLoading}
        technicalId="ST-current-card-missing"
        allowStartFresh={false}
      />
    );
  }

  if (isFinished) {
    const isFlipMode = normalizedMode === "flip";
    const showNextRound = hasMoreRounds && !isGameComplete;

    return (
      <div className="min-h-screen bg-background py-12 px-4 pb-32 md:pb-12">
        <div className="container mx-auto max-w-2xl">
          <Card className="p-8 text-center space-y-6">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-300/25 via-yellow-400/10 to-orange-500/20 shadow-[0_18px_45px_-18px_rgba(245,158,11,0.9)] ring-1 ring-amber-300/30">
              <span
                role="img"
                aria-label="Troféu"
                className="select-none text-6xl leading-none drop-shadow-[0_8px_8px_rgba(0,0,0,0.4)] [filter:saturate(1.2)_contrast(1.05)]"
              >
                🏆
              </span>
            </div>

            <h1 className="text-3xl font-bold">
              {showNextRound
                ? `Rodada ${roundNumber} concluída`
                : isGameComplete && errorCount === 0 && skippedCount === 0
                ? "Parabéns! Todos os cards dominados! 🎉"
                : "Sessão finalizada!"}
            </h1>

            {masteryProgressActive && (
              <div className="space-y-2 rounded-xl border bg-muted/30 p-3 text-left">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">Progresso geral</span>
                  <strong className="tabular-nums">
                    {masteryMasteredCount}/{overallTotalCards} dominados · {Math.round(studyProgressMetrics.overallPercent)}%
                  </strong>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{ width: `${studyProgressMetrics.overallPercent}%` }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 py-6 sm:grid-cols-4">
              <div className="space-y-2">
                <div className="text-3xl font-bold text-green-600">{masteryProgressActive ? roundCorrect : correctCount}</div>
                <div className="text-sm text-muted-foreground">Acertos</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-destructive">{masteryProgressActive ? roundErrors : errorCount}</div>
                <div className="text-sm text-muted-foreground">Erros</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-primary">{roundRecovered}</div>
                <div className="text-sm text-muted-foreground">Recuperados</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-warning">{masteryProgressActive ? (masteryRoundSummary?.skippedCards ?? 0) : skippedCount}</div>
                <div className="text-sm text-muted-foreground">Pulados</div>
              </div>
            </div>

            {!isFlipMode && !isGameComplete && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Ainda inéditos: {unseenCardsCount}</p>
                <p>Para revisar: {missedCardsCount}</p>
              </div>
            )}

            <div className="text-muted-foreground">
              Total desta rodada: {totalCards} cards
            </div>

            {showNextRound && (
              <Alert>
                <AlertDescription>
                  {missedCardsCount > 0 
                    ? `Você errou ${missedCardsCount} cards. Eles aparecerão na próxima rodada!`
                    : `Continue para estudar os ${unseenCardsCount} cards restantes.`
                  }
                </AlertDescription>
              </Alert>
            )}

            {/* Desktop buttons */}
            <div className="hidden md:flex flex-wrap gap-4 justify-center pt-4">
              {!showNextRound && (
                <Button 
                  variant="default" 
                  size="lg" 
                  type="button"
                  onClick={() => void handleCompleteAndExit()}
                  disabled={isCompleting || isRestarting}
                  className="w-full sm:w-auto min-w-[220px] text-lg font-bold shadow-lg bg-green-600 hover:bg-green-700"
                >
                  {isCompleting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <CheckCircle className="mr-2 h-6 w-6" />}
                  {isCompleting ? "CONCLUINDO..." : "CONCLUIR SESSÃO"}
                </Button>
              )}

              {showNextRound && (
                <Button variant="secondary" size="lg" onClick={startNextRound}>
                  <RefreshCcw className="mr-2 h-5 w-5" />
                  Próxima Rodada
                </Button>
              )}
              
              {!showNextRound && (
                <Button 
                  variant="secondary" 
                  size="lg" 
                  onClick={() => void handleRestartWithSettings()}
                  disabled={isCompleting || isRestarting}
                >
                  {isRestarting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <RotateCcw className="mr-2 h-5 w-5" />}
                  {isRestarting ? "Reiniciando..." : "Jogar Novamente"}
                </Button>
              )}
              
              {isFlipMode && errorCount > 0 && (
                <Button variant="outline" size="lg" onClick={handleReviewErrors}>
                  <RefreshCcw className="mr-2 h-5 w-5" />
                  Rever errados
                </Button>
              )}
              
              {fromGoalId && (
                <Button 
                  variant="outline" 
                  size="lg" 
                  onClick={() => navigate('/goals')}
                >
                  ← Voltar para Metas
                </Button>
              )}
              
              <Button 
                variant="ghost" 
                size="lg" 
                onClick={() => void (showNextRound ? handleExit() : handleFinishedExit())}
                disabled={isCompleting || isRestarting}
              >
                {showNextRound ? "Encerrar por agora" : "Voltar à Lista"}
              </Button>
            </div>

            {/* Mobile buttons */}
            <div className="flex md:hidden flex-wrap gap-3 justify-center pt-4">
              {showNextRound && (
                <Button variant="secondary" size="sm" onClick={startNextRound}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Próxima Rodada
                </Button>
              )}
              {!showNextRound && (
                <Button variant="secondary" size="sm" onClick={() => void handleRestartWithSettings()} disabled={isCompleting || isRestarting}>
                  {isRestarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                  {isRestarting ? "Reiniciando..." : "Jogar Novamente"}
                </Button>
              )}
              {isFlipMode && errorCount > 0 && (
                <Button variant="outline" size="sm" onClick={handleReviewErrors}>
                  Rever errados
                </Button>
              )}
              {fromGoalId && (
                <Button variant="outline" size="sm" onClick={() => navigate('/goals')}>
                  ← Metas
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => void (showNextRound ? handleExit() : handleFinishedExit())} disabled={isCompleting || isRestarting}>
                {showNextRound ? "Encerrar por agora" : "Voltar"}
              </Button>
            </div>
          </Card>
        </div>

        {/* Mobile: Sticky bottom button */}
        {!showNextRound && <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t md:hidden">
          <Button 
            variant="default" 
            size="lg" 
            type="button"
            onClick={() => void handleCompleteAndExit()}
            disabled={isCompleting || isRestarting}
            className="w-full text-lg font-bold shadow-lg bg-green-600 hover:bg-green-700 min-h-[56px]"
          >
            {isCompleting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <CheckCircle className="mr-2 h-6 w-6" />}
            {isCompleting ? "CONCLUINDO..." : "CONCLUIR SESSÃO"}
          </Button>
        </div>}
      </div>
    );
  }

  return (
    <div
      data-red-focus={redFocusActive ? "true" : undefined}
      className={`min-h-screen py-2 sm:py-4 px-2.5 sm:px-4 lg:px-8 transition-colors ${
        redFocusActive
          ? "bg-gradient-to-b from-red-950/40 via-background to-background"
          : "bg-background"
      }`}
    >
      <div className="container mx-auto max-w-6xl">
        {redFocusActive && (
          <div className="mb-2 flex items-center justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-sm font-medium text-red-500">
              <Flame className="h-4 w-4" />
              Foco Vermelho
            </div>
          </div>
        )}
        <div className="mb-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowExitDialog(true)}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Sair
            </Button>

            <div className="flex items-center gap-2 sm:gap-4">
              {/* Game Settings Modal */}
              <GameSettingsModal
                settings={gameSettings}
                onSettingsChange={handleSettingsChange}
                onRestart={handleRestartWithSettings}
                showFastMode={effectiveMode === "flip"}
                onEditCurrentCard={
                  displayedCard
                    ? () => setEditingFlashcard(displayedCard as Flashcard)
                    : undefined
                }
                canEditCurrentCard={!!displayedCard}
              />
              
              {/* Direction selector for flip mode — uses dynamic labels */}
              {effectiveMode === "flip" && (
                <Select value={flipDirection} onValueChange={handleDirectionChange}>
                  <SelectTrigger className="w-[110px] sm:w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a-b">{listSettings.labelsA} → {listSettings.labelsB}</SelectItem>
                    <SelectItem value="b-a">{listSettings.labelsB} → {listSettings.labelsA}</SelectItem>
                    <SelectItem value="any">Misto</SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              {/* Video button */}
              <StudyVideoButton
                videoId={videoInfo?.videoId || null}
                videoTitle={videoInfo?.title}
                listTitle={listTitle}
              />
              
            </div>
          </div>

          {/* Language direction indicator */}
          {listSettings.studyType === "language" && (
            <div className="hidden lg:flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="px-1.5 py-0.5 rounded bg-muted font-medium">A: {listSettings.labelsA}</span>
              <span>→</span>
              <span className="px-1.5 py-0.5 rounded bg-muted font-medium">B: {listSettings.labelsB}</span>
            </div>
          )}

          <StudyProgressHud
            metrics={studyProgressMetrics}
            overallTotal={overallTotalCards}
            currentRoundTotal={totalCards}
            roundNumber={roundNumber}
            isMasteryMode={masteryProgressActive}
            correctCount={masteryProgressActive ? roundCorrect : correctCount}
            errorCount={masteryProgressActive ? roundErrors : errorCount}
            skippedCount={masteryProgressActive ? (masteryRoundSummary?.skippedCards ?? 0) : skippedCount}
            pendingReview={missedCardsCount}
            unseenRemaining={unseenCardsCount}
          />
        </div>

        {hasLayers && cardLayers && (
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <Layers className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium">
              {(currentCard as any)?.__groupTitle ? (
                <>
                  Grupo:{" "}
                  <span className="text-foreground">
                    {(currentCard as any).__groupTitle}
                  </span>{" "}— Camada {safeLayerIdx + 1} de {cardLayers.length}
                </>
              ) : (
                <>Camada {safeLayerIdx + 1} de {cardLayers.length}</>
              )}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={goToPreviousLayer}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Camada anterior
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={goToNextLayer}
              >
                Próxima camada
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="mb-6">
          {effectiveMode === "flip" && displayedCard && (
            <FlipStudyView
              key={`${displayedCard.id}-${currentIndex}-${safeLayerIdx}`}
              front={displayedCard.term}
              back={displayedCard.translation}
              hint={displayedCard.hint}
              flashcardId={displayedCard.id}
              imageUrlA={FEATURE_FLAGS.study_images_enabled ? displayedCard.image_url_a : null}
              imageUrlB={FEATURE_FLAGS.study_images_enabled ? displayedCard.image_url_b : null}
              wordHintsA={FEATURE_FLAGS.word_hints_enabled ? displayedCard.word_hints : null}
              wordHintsB={FEATURE_FLAGS.word_hints_enabled ? displayedCard.word_hints : null}
              mergedHintsA={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsA : undefined}
              mergedHintsB={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsB : undefined}
              direction={resolvedDirection}
              fastMode={gameSettings.fastMode}
              ttsEnabled={listSettings.ttsEnabled}
              labelA={listSettings.labelsA}
              labelB={listSettings.labelsB}
              langA={listSettings.langA}
              langB={listSettings.langB}
              isFavorite={isDisplayedGroupFavorite}
              isRedListed={isDisplayedGroupRedListed}
              onToggleFavorite={handleToggleFavorite}
              onToggleRedList={handleToggleRedList}
              isSpecial={isDisplayedSpecial}
              onToggleSpecial={handleToggleSpecial}
              onKnew={() => handleNext(true)}
              onDidntKnow={() => handleNext(false)}
              onNext={masteryProgressActive ? undefined : navigateNext}
              onPrevious={masteryProgressActive ? undefined : navigatePrevious}
              canGoPrevious={!masteryProgressActive && canGoPrevious}
              canGoNext={!masteryProgressActive && canGoNext}
              layerCount={cardLayers?.length ?? 1}
              layersVisitedCount={safeLayerIdx + 1}
              onOpenLayers={hasLayers ? goToNextLayer : undefined}
            />
          )}
          {effectiveMode === "write" && displayedCard && (
            <WriteStudyView
              key={`${displayedCard.id}-${currentIndex}-${safeLayerIdx}`}
              front={displayedCard.term}
              back={displayedCard.translation}
              hint={displayedCard.hint}
              flashcardId={displayedCard.id}
              acceptedAnswersEn={displayedCard.accepted_answers_en || []}
              acceptedAnswersPt={displayedCard.accepted_answers_pt || []}
              wordHintsA={FEATURE_FLAGS.word_hints_enabled ? displayedCard.word_hints : null}
              mergedHintsA={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsA : undefined}
              mergedHintsB={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsB : undefined}
              direction={resolvedDirection}
              langA={listSettings.langA}
              langB={listSettings.langB}
              isFavorite={isDisplayedGroupFavorite}
              isRedListed={isDisplayedGroupRedListed}
              onToggleFavorite={handleToggleFavorite}
              onToggleRedList={handleToggleRedList}
              isSpecial={isDisplayedSpecial}
              onToggleSpecial={handleToggleSpecial}
              onCorrect={() => handleNext(true)}
              onIncorrect={() => handleNext(false)}
              onSkip={() => handleNext(false, true)}
              layerCount={cardLayers?.length ?? 1}
              layersVisitedCount={safeLayerIdx + 1}
              onOpenLayers={hasLayers ? goToNextLayer : undefined}
            />
          )}
          {effectiveMode === "multiple-choice" && displayedCard && (
            <MultipleChoiceStudyView
              key={`${displayedCard.id}-${currentIndex}-${safeLayerIdx}`}
              currentCard={displayedCard}
              allCards={effectiveFlashcards}
              direction={resolvedDirection}
              langA={listSettings.langA}
              langB={listSettings.langB}
              mergedHintsA={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsA : undefined}
              mergedHintsB={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsB : undefined}
              isFavorite={isDisplayedGroupFavorite}
              isRedListed={isDisplayedGroupRedListed}
              onToggleFavorite={handleToggleFavorite}
              onToggleRedList={handleToggleRedList}
              isSpecial={isDisplayedSpecial}
              onToggleSpecial={handleToggleSpecial}
              onCorrect={() => handleNext(true)}
              onIncorrect={() => handleNext(false)}
              onSkip={requestSkip}
            />
          )}
          {effectiveMode === "unscramble" && displayedCard && (
            <UnscrambleStudyView
              key={`${displayedCard.id}-${currentIndex}-${safeLayerIdx}`}
              front={displayedCard.term}
              back={displayedCard.translation}
              hint={displayedCard.hint}
              flashcardId={displayedCard.id}
              wordHintsA={displayedCard.word_hints}
              mergedHintsA={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsA : undefined}
              mergedHintsB={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsB : undefined}
              direction={resolvedDirection}
              langA={listSettings.langA}
              langB={listSettings.langB}
              isFavorite={isDisplayedGroupFavorite}
              isRedListed={isDisplayedGroupRedListed}
              onToggleFavorite={handleToggleFavorite}
              onToggleRedList={handleToggleRedList}
              isSpecial={isDisplayedSpecial}
              onToggleSpecial={handleToggleSpecial}
              onCorrect={() => handleNext(true)}
              onIncorrect={() => handleNext(false)}
              onSkip={requestSkip}
            />
          )}
          {effectiveMode === "pronunciation" && displayedCard && (
            <PronunciationStudyView
              key={`${displayedCard.id}-${currentIndex}-${safeLayerIdx}`}
              front={displayedCard.term}
              back={displayedCard.translation}
              wordHintsA={displayedCard.word_hints}
              mergedHintsA={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsA : undefined}
              mergedHintsB={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsB : undefined}
              langA={listSettings?.langA || "en"}
              langB={listSettings?.langB || "pt"}
              labelA={listSettings?.labelsA || undefined}
              labelB={listSettings?.labelsB || undefined}
              isFavorite={isDisplayedGroupFavorite}
              isRedListed={isDisplayedGroupRedListed}
              onToggleFavorite={handleToggleFavorite}
              onToggleRedList={handleToggleRedList}
              isSpecial={isDisplayedSpecial}
              onToggleSpecial={handleToggleSpecial}
              onCorrect={() => handleNext(true)}
              onIncorrect={() => handleNext(false)}
              onSkip={requestSkip}
            />
          )}
        </div>

        {displayedCard && (
          <DetailedExplanationPanel
            explanation={displayedCard.detailed_explanation}
            usageNotes={displayedCard.usage_notes}
            commonMistakes={displayedCard.common_mistakes}
          />
        )}

        {/* Previous card button (only for non-flip modes) */}
        {effectiveMode !== "flip" && currentIndex > 0 && (
          <div className="flex justify-center">
            <Button variant="ghost" onClick={goToPrevious}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao anterior
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salvar e sair do estudo?</AlertDialogTitle>
            <AlertDialogDescription>
              Seu progresso será salvo — incluindo o card e a camada em que
              você parou. Ao voltar, você retoma exatamente deste ponto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar estudando</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                setShowExitDialog(false);
                void handleExit();
              }}
            >
              Salvar e sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SkipCardConfirmDialog
        open={showSkipDialog}
        flowMode={effectivePreset.studyFlowMode}
        onCancel={() => {
          skipCardKeyRef.current = null;
          setShowSkipDialog(false);
        }}
        onKnown={() => classifySkip("known")}
        onUnknown={() => classifySkip("unknown")}
      />

      <StudyCompletionModal
        open={showCompletionModal}
        correctCount={correctCount}
        errorCount={errorCount}
        skippedCount={skippedCount}
        totalCards={totalCards}
        onComplete={() => void handleCompleteAndExit()}
        onRestart={() => void handleRestartWithSettings()}
        isCompleting={isCompleting}
        isRestarting={isRestarting}
        onReviewErrors={errorCount > 0 ? handleReviewErrors : undefined}
        onExit={() => void handleFinishedExit()}
        onOpenChange={setShowCompletionModal}
        fromGoalId={fromGoalId}
        onGoToGoals={fromGoalId ? () => navigate('/goals') : undefined}
      />

      {/* In-game card editor — reuses the same dialog as ListDetail.
          Saving via handleUpdateFlashcardInGame updates `flashcards` in place,
          preserving cardsOrder + currentIndex (no session restart). */}
      <EditFlashcardDialog
        flashcard={editingFlashcard}
        isOpen={!!editingFlashcard}
        onClose={() => setEditingFlashcard(null)}
        onSave={handleUpdateFlashcardInGame}
        studyType={listSettings.studyType}
        labelA={listSettings.labelsA}
        labelB={listSettings.labelsB}
      />
    </div>
  );
};

export default Study;
