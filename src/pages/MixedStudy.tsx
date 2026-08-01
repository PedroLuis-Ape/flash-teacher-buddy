import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Heart, RefreshCcw, Sparkles, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { prepareLayeredStudyDeck } from "@/lib/studyDeck";
import {
  createStudyDeckRequestId,
  loadStudyDeck,
} from "@/features/study/lib/studyDeckLoader";
import { hashToBool, normalizeDirection, type Direction } from "@/features/study/lib/gameCore";
import { scoreCard, type CardProgressLike } from "@/features/study/lib/intelligenceScoring";
import { useAdaptiveMixedSession } from "@/features/study/hooks/useAdaptiveMixedSession";
import { StudySessionRecovery } from "@/features/study/components/StudySessionRecovery";
import { StudyDeckEmptyState } from "@/features/study/components/StudyDeckEmptyState";
import { SkipCardConfirmDialog } from "@/features/study/components/SkipCardConfirmDialog";
import {
  STUDY_RECOVERY_WATCHDOG_MS,
  STUDY_REMOTE_RESTORE_TIMEOUT_MS,
  STUDY_REQUIRED_LOAD_TIMEOUT_MS,
  withStudyRuntimeTimeout,
} from "@/features/study/lib/studySessionRuntime";
import { useAuth } from "@/contexts/AuthContext";
import { resolveStudyAccess } from "@/lib/resolveStudyAccess";
import { useFavorites } from "@/hooks/useFavorites";
import {
  filterCardsForStudyScope,
  resolvePersonalStudySubset,
} from "@/features/study/lib/studyScopePolicy";
import { GameSettingsModal, type GameSettings } from "@/features/study/components/GameSettingsModal";
import { useStudyPreferences } from "@/hooks/useStudyPreferences";
import {
  buildLegacyStudySessionScopeKey,
  buildStudySessionScopeKey,
  buildStudySessionSettingsSnapshot,
} from "@/features/study/lib/studySessionContext";
import { buildStudySnapshotKey } from "@/features/study/lib/studySessionSnapshot";
import { recordStudyProgressAttempt } from "@/features/study/lib/studyProgressRepository";
import type { MixedFlowMode } from "@/features/study/lib/adaptiveMixedSession";
import { WriteStudyView } from "@/features/study/components/WriteStudyView";
import { MultipleChoiceStudyView } from "@/features/study/components/MultipleChoiceStudyView";
import { UnscrambleStudyView } from "@/features/study/components/UnscrambleStudyView";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface MixedFlashcard {
  id: string;
  term: string;
  translation: string;
  hint?: string | null;
  accepted_answers_en?: string[];
  accepted_answers_pt?: string[];
  word_hints?: unknown;
  parent_card_id?: string | null;
  status_group_uid?: string | null;
  created_at?: string;
}

const DEFAULT_LABELS = {
  langA: "en",
  langB: "pt",
  labelA: "English",
  labelB: "Português",
};

function getActivityLabel(mode: string | null): string {
  if (mode === "write") return "Escrever";
  if (mode === "multiple-choice") return "Múltipla Escolha";
  if (mode === "unscramble") return "Organizar Frase";
  return "Prática Mista";
}

export default function MixedStudy() {
  const { id, collectionId } = useParams();
  const resolvedId = (id as string) || (collectionId as string) || "";
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { status: authStatus, userId, session } = useAuth();
  const isCollectionRoute = location.pathname.includes("/collection/");
  const isListRoute = !isCollectionRoute;
  const listId = isListRoute ? resolvedId : undefined;

  const [cards, setCards] = useState<MixedFlashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmedEmpty, setConfirmedEmpty] = useState(false);
  const [loadFailure, setLoadFailure] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [labels, setLabels] = useState(DEFAULT_LABELS);
  const [weightByCardId, setWeightByCardId] = useState<Record<string, number>>({});
  const [remoteState, setRemoteState] = useState<unknown>(null);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [studySessionId, setStudySessionId] = useState<string | null>(null);
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const skipCardKeyRef = useRef<string | null>(null);
  const answeredCardKeyRef = useRef<string | null>(null);
  const studySessionIdRef = useRef<string | null>(null);
  const sessionCreationRef = useRef<Promise<string | null> | null>(null);
  const progressWritesRef = useRef<Set<Promise<unknown>>>(new Set());
  useEffect(() => {
    studySessionIdRef.current = studySessionId;
  }, [studySessionId]);

  const directionParam = searchParams.get("dir") || searchParams.get("direction");
  const explicitFavorites = searchParams.get("favorites");
  const { effectivePreset, updateForCurrentScope } = useStudyPreferences(userId, {
    listId: isListRoute ? resolvedId : undefined,
    gameMode: "mixed",
    persistScope: isListRoute ? "list" : "global",
    canPersistList: isListRoute,
  });
  const canUsePersonalFavorites = authStatus === "authenticated" && Boolean(userId);
  const baseDirection: Direction = directionParam
    ? normalizeDirection(directionParam)
    : effectivePreset.direction;
  const requestedFavoritesOnly = explicitFavorites === "true"
    ? true
    : explicitFavorites === "false"
      ? false
      : effectivePreset.scope === "favorites";
  const favoritesOnly = resolvePersonalStudySubset(
    requestedFavoritesOnly ? "favorites" : "all",
    canUsePersonalFavorites,
  ).subset === "favorites";
  const [selectedFlowMode, setSelectedFlowMode] = useState<MixedFlowMode>(effectivePreset.studyFlowMode);
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    mode: effectivePreset.order,
    subset: favoritesOnly ? "favorites" : "all",
    fastMode: effectivePreset.fastMode,
    redFocus: false,
  });
  const lastPresetFlowModeRef = useRef(effectivePreset.studyFlowMode);
  useEffect(() => {
    if (effectivePreset.studyFlowMode === lastPresetFlowModeRef.current) return;
    lastPresetFlowModeRef.current = effectivePreset.studyFlowMode;
    setSelectedFlowMode(effectivePreset.studyFlowMode);
  }, [effectivePreset.studyFlowMode]);
  useEffect(() => {
    if (directionParam || explicitFavorites !== null) return;
    setGameSettings((current) => ({
      ...current,
      mode: effectivePreset.order,
      subset: resolvePersonalStudySubset(
        effectivePreset.scope,
        canUsePersonalFavorites,
      ).subset,
      fastMode: effectivePreset.fastMode,
    }));
  }, [canUsePersonalFavorites, directionParam, effectivePreset.fastMode, effectivePreset.order, effectivePreset.scope, explicitFavorites]);
  useEffect(() => {
    const handleFlowChange = (event: Event) => {
      const next = (event as CustomEvent<MixedFlowMode>).detail;
      if (next === "mastery_rounds" || next === "continuous") setSelectedFlowMode(next);
    };
    window.addEventListener("ape:studyFlowModeChanged", handleFlowChange);
    return () => window.removeEventListener("ape:studyFlowModeChanged", handleFlowChange);
  }, []);
  const favoritesScope = useMemo(
    () => (isListRoute ? { listId: resolvedId } : { collectionId: resolvedId }),
    [isListRoute, resolvedId],
  );
  const favoritesQuery = useFavorites(userId, "flashcard", favoritesScope);
  const favoriteIds = useMemo(() => favoritesQuery.data ?? [], [favoritesQuery.data]);
  const favoritesConfirmedZero = favoritesOnly
    && Boolean(userId)
    && favoritesQuery.isSuccess
    && favoritesQuery.fetchStatus !== "fetching"
    && !favoritesQuery.isPlaceholderData
    && favoriteIds.length === 0;
  const favoritesReady = !favoritesOnly
    || !userId
    || (favoritesQuery.isSuccess && favoritesQuery.fetchStatus !== "fetching" && !favoritesQuery.isPlaceholderData);
  const scopeKey = buildStudySessionScopeKey({
    mode: "mixed",
    subset: favoritesOnly ? "favorites" : "all",
    order: gameSettings.mode,
    redFocus: gameSettings.redFocus,
    fastMode: gameSettings.fastMode,
    direction: baseDirection,
    studyFlowMode: selectedFlowMode,
  });
  const legacyScopeKey = buildLegacyStudySessionScopeKey({
    mode: "mixed",
    subset: favoritesOnly ? "favorites" : "all",
    order: gameSettings.mode,
    redFocus: gameSettings.redFocus,
    fastMode: gameSettings.fastMode,
    direction: baseDirection,
    studyFlowMode: selectedFlowMode,
  });

  useEffect(() => {
    if (!resolvedId) return;
    const isPortalRoute = location.pathname.startsWith("/portal/");
    const access = resolveStudyAccess({ authStatus, isPortalRoute, userId });
    setCards([]);
    setConfirmedEmpty(false);
    setLoadFailure(null);
    if (access === "denied") {
      setLoading(false);
      setLoadFailure("auth-required");
      return;
    }
    if (access === "wait") {
      setLoading(true);
      const timeoutId = setTimeout(() => {
        setLoading(false);
        setLoadFailure("auth-timeout");
      }, STUDY_RECOVERY_WATCHDOG_MS);
      return () => clearTimeout(timeoutId);
    }
    if (!favoritesReady) {
      setLoading(true);
      setRemoteLoaded(false);
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();
    const load = async () => {
      setLoading(true);
      setLoadFailure(null);
      setRemoteLoaded(false);
      try {
        const isPublicList = isListRoute && isPortalRoute;
        const queryColumn = isListRoute ? "list_id" : "collection_id";
        const deckResult = await withStudyRuntimeTimeout(
          loadStudyDeck<MixedFlashcard>({
            requestId: createStudyDeckRequestId(),
            resourceKind: isListRoute ? "list" : "collection",
            resourceId: resolvedId,
            isPublicList,
            hasConfirmedSession: Boolean(session),
            signal: abortController.signal,
            fetchPage: (from, to) => isPublicList
              ? (supabase as any)
                  .rpc("get_portal_flashcards", { _list_id: resolvedId })
                  .abortSignal(abortController.signal)
                  .range(from, to)
              : (supabase as any)
                  .from("flashcards")
                  .select("*")
                  .eq(queryColumn, resolvedId)
                  .is("deleted_at", null)
                  .order("created_at", { ascending: true })
                  .order("id", { ascending: true })
                  .abortSignal(abortController.signal)
                  .range(from, to),
            prepare: (rawCards) => prepareLayeredStudyDeck(rawCards),
          }),
          STUDY_REQUIRED_LOAD_TIMEOUT_MS,
          isPublicList ? "mixed-portal-cards" : "mixed-cards",
          () => abortController.abort(),
        );
        if (deckResult.status === "empty") {
          if (!cancelled) {
            setCards([]);
            setConfirmedEmpty(true);
            setRemoteLoaded(true);
            setLoading(false);
          }
          return;
        }

        const prepared = deckResult.playableCards as MixedFlashcard[];
        const scopedCards = filterCardsForStudyScope({
          cards: prepared,
          favoriteIds,
          redListIds: [],
          settings: { subset: favoritesOnly ? "favorites" : "all" },
        });
        const safeScopedCards = favoritesConfirmedZero && prepared.length > 0 ? prepared : scopedCards;
        if (safeScopedCards.length === 0) {
          if (!cancelled) {
            setCards([]);
            setConfirmedEmpty(true);
            setRemoteLoaded(true);
            setLoading(false);
          }
          return;
        }
        if (!cancelled) setCards(safeScopedCards);
        if (!cancelled) setConfirmedEmpty(false);

        if (userId && listId) {
          const [progressResult, sessionResult] = await withStudyRuntimeTimeout(
            Promise.all([
              (supabase as any)
                .from("flashcard_progress")
                .select("flashcard_id, correct_count, incorrect_count, last_reviewed")
                .eq("user_id", userId)
                // Progress is globally keyed by (user_id, flashcard_id) in
                // the existing schema. Filtering by list_id here could hide
                // valid history after the same card is used in another list.
                .abortSignal(abortController.signal),
              (supabase as any)
                .from("study_sessions")
                .select("id, cards_order, session_scope_key, settings_snapshot, session_snapshot, updated_at")
                .eq("user_id", userId)
                .eq("list_id", listId)
                .eq("mode", "mixed-adaptive")
                .eq("completed", false)
                .order("updated_at", { ascending: false })
                .limit(10)
                .abortSignal(abortController.signal),
            ]),
            STUDY_REMOTE_RESTORE_TIMEOUT_MS,
            "mixed-session-restore",
            () => abortController.abort(),
          ).catch(() => [{ data: [] }, { data: null }] as const);
          if (cancelled) return;

          const weights: Record<string, number> = {};
          (progressResult.data ?? []).forEach((progress: CardProgressLike) => {
            weights[progress.flashcard_id] = 1 + Math.max(0, scoreCard({
              id: progress.flashcard_id,
              progress,
            })) * 10;
          });
          setWeightByCardId(weights);
          // This query intentionally returns a bounded array: older accounts
          // can have more than one open row for the same scope. `maybeSingle()`
          // would turn that valid legacy state into an error and the old code
          // then indexed an object as if it were an array, silently dropping
          // the remote snapshot. Always choose the newest row explicitly.
          const matchingSessions = Array.isArray(sessionResult.data)
            ? sessionResult.data
            : sessionResult.data
              ? [sessionResult.data]
              : [];
          const matchingSession = matchingSessions
            .filter((candidate) => candidate.session_scope_key === scopeKey || candidate.session_scope_key?.startsWith("study-session-v1:"))
            .sort((left, right) => {
              const leftIsCurrent = left.session_scope_key === scopeKey;
              const rightIsCurrent = right.session_scope_key === scopeKey;
              if (leftIsCurrent !== rightIsCurrent) return leftIsCurrent ? -1 : 1;
              return Date.parse(String(right.updated_at ?? "")) - Date.parse(String(left.updated_at ?? ""));
            })[0] ?? null;
          studySessionIdRef.current = matchingSession?.id ?? null;
          setStudySessionId(studySessionIdRef.current);
          setRemoteState(matchingSession?.session_snapshot ?? matchingSession?.cards_order ?? null);
        }

        if (!cancelled) {
          setRemoteLoaded(true);
          setLoading(false);
        }

        if (isListRoute) {
          const { data: listRow } = await withStudyRuntimeTimeout(
            (supabase as any)
              .from("lists")
              .select("folder_id, lang_a, lang_b, labels_a, labels_b")
              .eq("id", resolvedId)
              .abortSignal(abortController.signal)
              .maybeSingle(),
            STUDY_REMOTE_RESTORE_TIMEOUT_MS,
            "mixed-list-metadata",
            () => abortController.abort(),
          ).catch(() => ({ data: null }));
          let folderRow: any = null;
          if (listRow?.folder_id) {
            const folderResult = await withStudyRuntimeTimeout(
              (supabase as any)
                .from("folders")
                .select("lang_a, lang_b, labels_a, labels_b")
                .eq("id", listRow.folder_id)
                .abortSignal(abortController.signal)
                .maybeSingle(),
              STUDY_REMOTE_RESTORE_TIMEOUT_MS,
              "mixed-folder-metadata",
              () => abortController.abort(),
            ).catch(() => ({ data: null }));
            folderRow = folderResult.data;
          }
          if (!cancelled && (listRow || folderRow)) {
            setLabels({
              langA: listRow?.lang_a || folderRow?.lang_a || "en",
              langB: listRow?.lang_b || folderRow?.lang_b || "pt",
              labelA: listRow?.labels_a || folderRow?.labels_a || "Lado A",
              labelB: listRow?.labels_b || folderRow?.labels_b || "Lado B",
            });
          }
        }

      } catch (error) {
        if (!cancelled) {
          setLoadFailure(error instanceof Error ? error.name : "mixed-load-failed");
          toast.error("Não foi possível preparar a Prática Mista.");
        }
      } finally {
        if (!cancelled) {
          setRemoteLoaded(true);
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [authStatus, baseDirection, canUsePersonalFavorites, favoriteIds, favoritesConfirmedZero, favoritesOnly, favoritesReady, isListRoute, listId, location.pathname, resolvedId, scopeKey, session, userId, loadAttempt]);

  const persistRemoteState = useCallback(async (state: any) => {
    if (!userId || !listId) return;
    const payload = {
      user_id: userId,
      list_id: listId,
      mode: "mixed-adaptive",
      schema_version: 1,
      session_scope_key: scopeKey,
      settings_snapshot: buildStudySessionSettingsSnapshot({
        mode: "mixed",
        subset: favoritesOnly ? "favorites" : "all",
        order: gameSettings.mode,
        redFocus: gameSettings.redFocus,
        fastMode: gameSettings.fastMode,
        direction: baseDirection,
        studyFlowMode: selectedFlowMode,
      }),
      current_index: state.currentIndex,
      // Keep the legacy column a valid playable order. The rich adaptive
      // state belongs in session_snapshot and is the source of truth.
      cards_order: state.allCardIds,
      session_snapshot: state,
      completed: state.status === "journey-complete",
      updated_at: new Date().toISOString(),
    };

    const existingSessionId = studySessionIdRef.current;
    if (existingSessionId) {
      const controller = new AbortController();
      const { data: updated, error } = await withStudyRuntimeTimeout(
        (supabase as any)
          .from("study_sessions")
          .update(payload)
          .eq("id", existingSessionId)
          .eq("user_id", userId)
          .eq("list_id", listId)
          .eq("mode", "mixed-adaptive")
          .select("id")
          .maybeSingle()
          .abortSignal(controller.signal),
        STUDY_REMOTE_RESTORE_TIMEOUT_MS,
        "mixed-session-persist",
        () => controller.abort(),
      );
      if (error) throw error;
      if (updated?.id) return;
      // A stale session id can survive a reload or a second tab. Do not
      // report success for a zero-row update and never create a duplicate in
      // the same write. A later state change can create a session only after
      // this stale id has been cleared.
      studySessionIdRef.current = null;
      setStudySessionId(null);
      throw new Error("A sessão do Misto não foi confirmada pelo banco");
    }

    if (!sessionCreationRef.current) {
      const controller = new AbortController();
      sessionCreationRef.current = withStudyRuntimeTimeout(
        (supabase as any)
          .from("study_sessions")
          .insert(payload)
          .select("id")
          .abortSignal(controller.signal)
          .single(),
        STUDY_REMOTE_RESTORE_TIMEOUT_MS,
        "mixed-session-create",
        () => controller.abort(),
      ).then(({ data }) => data?.id ?? null)
        .catch(() => null)
        .finally(() => {
          sessionCreationRef.current = null;
        });
    }

    const createdSessionId = await sessionCreationRef.current;
    if (createdSessionId) {
      studySessionIdRef.current = createdSessionId;
      setStudySessionId(createdSessionId);
    }
  }, [baseDirection, favoritesOnly, gameSettings.fastMode, gameSettings.mode, gameSettings.redFocus, listId, scopeKey, selectedFlowMode, userId]);

  const cardIds = useMemo(() => cards.map((card) => card.id), [cards]);
  const mixed = useAdaptiveMixedSession({
    cardIds,
    // Never reuse a mixed session between users/lists. The old key contained
    // only settings and could make a second list inherit the first list's
    // local journey on the same browser.
    storageKey: buildStudySnapshotKey({
      userScope: userId,
      listId: isListRoute ? resolvedId : undefined,
      mode: "mixed",
      sessionScopeKey: scopeKey,
      cardsSignature: cardIds.join("|"),
    }),
    legacyStorageKey: buildStudySnapshotKey({
      userScope: userId,
      listId: isListRoute ? resolvedId : undefined,
      mode: "mixed",
      sessionScopeKey: legacyScopeKey,
      cardsSignature: cardIds.join("|"),
    }),
    flowMode: selectedFlowMode,
    remoteState,
    remoteLoaded,
    weightByCardId,
    onPersist: persistRemoteState,
  });
  const handleSettingsChange = useCallback((next: GameSettings) => {
    const requestedSubset = next.subset;
    const resolvedSubset = resolvePersonalStudySubset(
      requestedSubset,
      canUsePersonalFavorites,
    ).subset;
    if (requestedSubset === "favorites" && resolvedSubset === "all") {
      toast.info("Favoritos exigem uma conta autenticada. Mostrando todos os cards.");
    }
    const resolvedSettings = { ...next, subset: resolvedSubset };
    setGameSettings(resolvedSettings);
    updateForCurrentScope({
      order: resolvedSettings.mode,
      ...(requestedSubset === "favorites" && resolvedSubset === "all"
        ? {}
        : { scope: resolvedSettings.subset }),
      fastMode: resolvedSettings.fastMode ?? false,
    });
    const nextFavorites = resolvedSettings.subset === "favorites";
    if (nextFavorites !== favoritesOnly) {
      const params = new URLSearchParams(searchParams);
      params.set("favorites", String(nextFavorites));
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }
  }, [canUsePersonalFavorites, favoritesOnly, location.pathname, navigate, searchParams, updateForCurrentScope]);
  const currentAnswerKey = `${mixed.state?.roundNumber ?? 0}:${mixed.state?.currentIndex ?? 0}:${mixed.currentCardId ?? "none"}`;
  useEffect(() => {
    answeredCardKeyRef.current = null;
  }, [currentAnswerKey]);
  const [showRuntimeRecovery, setShowRuntimeRecovery] = useState(false);
  useEffect(() => {
    if (mixed.state || loading || cards.length === 0 || !remoteLoaded) {
      if (mixed.state && showRuntimeRecovery) setShowRuntimeRecovery(false);
      return;
    }
    const timeoutId = setTimeout(
      () => setShowRuntimeRecovery(true),
      STUDY_RECOVERY_WATCHDOG_MS,
    );
    return () => clearTimeout(timeoutId);
  }, [cards.length, loading, mixed.state, remoteLoaded, showRuntimeRecovery]);

  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const currentCard = mixed.currentCardId ? cardById.get(mixed.currentCardId) : undefined;
  const resolvedDirection: Direction = baseDirection === "any"
    ? (mixed.currentCardId && hashToBool(mixed.currentCardId) ? "a-b" : "b-a")
    : baseDirection;

  const recordAttempt = useCallback(async (cardId: string, correct: boolean, skipped: boolean) => {
    if (!userId || !listId || skipped) return;
    const write = recordStudyProgressAttempt({
      userId,
      flashcardId: cardId,
      listId,
      correct,
    });
    progressWritesRef.current.add(write);
    try {
      await write;
    } finally {
      progressWritesRef.current.delete(write);
    }
  }, [listId, userId]);

  const handleAnswer = useCallback((correct: boolean, skipped = false) => {
    if (!mixed.currentCardId) return;
    if (answeredCardKeyRef.current === currentAnswerKey) return;
    answeredCardKeyRef.current = currentAnswerKey;
    void recordAttempt(mixed.currentCardId, correct, skipped).catch((error) => {
      console.warn("[MixedStudy] Progresso do card pendente:", error);
    });
    mixed.answer(correct, skipped);
  }, [currentAnswerKey, mixed, recordAttempt]);

  const requestSkip = useCallback(() => {
    if (!mixed.currentCardId || showSkipDialog) return;
    skipCardKeyRef.current = currentAnswerKey;
    setShowSkipDialog(true);
  }, [currentAnswerKey, mixed.currentCardId, showSkipDialog]);

  const classifySkip = useCallback((classification: "known" | "unknown") => {
    if (!showSkipDialog || skipCardKeyRef.current !== currentAnswerKey) {
      skipCardKeyRef.current = null;
      setShowSkipDialog(false);
      toast.info("O card mudou; nenhum pulo foi registrado.");
      return;
    }
    skipCardKeyRef.current = null;
    setShowSkipDialog(false);
    handleAnswer(classification === "known", classification === "unknown");
  }, [currentAnswerKey, handleAnswer, showSkipDialog]);

  const exit = async () => {
    const pendingProgressWrites = Array.from(progressWritesRef.current);
    if (pendingProgressWrites.length > 0) {
      await withStudyRuntimeTimeout(
        Promise.allSettled(pendingProgressWrites),
        STUDY_REMOTE_RESTORE_TIMEOUT_MS,
        "mixed-progress-before-exit",
      ).catch((error) => {
        console.warn("[MixedStudy] Saída com progresso remoto pendente:", error);
      });
    }
    await mixed.persistNow().catch((error) => {
      // The local snapshot is already durable; navigation must remain
      // available when the optional remote confirmation is unavailable.
      console.warn("[MixedStudy] Saída com sincronização remota pendente:", error);
    });
    if (window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }

    const contextParams = new URLSearchParams();
    for (const key of ["guest", "turma", "atribuicao"]) {
      const value = searchParams.get(key);
      if (value) contextParams.set(key, value);
    }
    const query = contextParams.toString();

    if (location.pathname.startsWith("/portal/list/")) {
      navigate(`/portal/list/${resolvedId}/games${query ? `?${query}` : ""}`);
    } else if (location.pathname.startsWith("/portal/collection/")) {
      navigate(`/portal/collection/${resolvedId}`);
    } else {
      navigate(isListRoute ? `/list/${resolvedId}/games` : `/collection/${resolvedId}/games`);
    }
  };

  const restartRoundManually = () => {
    if (window.confirm("Reiniciar somente esta rodada? O percurso completo será preservado.")) {
      mixed.restartRound();
    }
  };

  const restartJourneyManually = () => {
    if (window.confirm("Reiniciar todo o percurso da Prática Mista desde o começo?")) {
      mixed.restartJourney();
    }
  };

  if (loadFailure || showRuntimeRecovery) {
    return (
      <StudySessionRecovery
        onRetry={() => {
          setLoadFailure(null);
          setConfirmedEmpty(false);
          setShowRuntimeRecovery(false);
          setLoadAttempt((attempt) => attempt + 1);
        }}
        onStartFresh={() => {
          const shouldReloadCards = Boolean(loadFailure) || cards.length === 0;
          setLoadFailure(null);
          setConfirmedEmpty(false);
          setShowRuntimeRecovery(false);
          if (shouldReloadCards) {
            setLoadAttempt((attempt) => attempt + 1);
          } else {
            mixed.clearPersistedJourney();
          }
        }}
        onBack={exit}
        isRetrying={loading}
        technicalId={loadFailure ? "MX-load" : "MX-session"}
      />
    );
  }

  if (confirmedEmpty) {
    return (
      <StudyDeckEmptyState
        onRetry={() => {
          setConfirmedEmpty(false);
          setLoadAttempt((attempt) => attempt + 1);
        }}
        onBack={exit}
        isRetrying={loading}
        resourceLabel={isListRoute ? "lista" : "coleção"}
      />
    );
  }

  if (loading || !mixed.state || !mixed.progress) {
    return <div className="grid min-h-[70vh] place-items-center text-muted-foreground">Preparando Prática Mista...</div>;
  }

  const { state, progress } = mixed;

  if (state.status === "round-failed") {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <Card className="mx-auto max-w-xl space-y-6 p-6 text-center sm:p-10">
          <div className="flex justify-center gap-2" aria-label="Sem corações restantes">
            {Array.from({ length: state.maxHearts }).map((_, index) => (
              <Heart key={index} className="h-10 w-10 text-muted-foreground/35" />
            ))}
          </div>
          <div>
            <h1 className="text-2xl font-bold">Vamos tentar esta rodada novamente</h1>
            <p className="mt-2 text-muted-foreground">
              Você não voltou ao começo da lista. Os mesmos {state.currentRoundCardIds.length} cards serão reorganizados.
            </p>
          </div>
          <Button size="lg" className="w-full" onClick={mixed.restartRound}>
            <RefreshCcw className="mr-2 h-5 w-5" /> Recuperar corações e continuar
          </Button>
          <Button variant="ghost" onClick={exit}>Sair e continuar depois</Button>
        </Card>
      </div>
    );
  }

  if (state.status === "round-complete") {
    const roundErrors = state.currentRoundErrors.length;
    const roundCorrect = Math.max(0, state.currentRoundAnswered.length - roundErrors);
    const recovered = state.currentRoundAnswered.filter((cardId) =>
      state.currentRoundOrigins[cardId] === "pending" && !state.currentRoundErrors.includes(cardId)).length;
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <Card className="mx-auto max-w-xl space-y-6 p-6 text-center sm:p-10">
          <Sparkles className="mx-auto h-14 w-14 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Rodada {state.roundNumber} concluída</h1>
            <p className="mt-2 text-muted-foreground">
              {state.currentRoundErrors.length === 0
                ? "Você dominou todos os cards desta rodada."
                : `${state.currentRoundErrors.length} card(s) voltarão na próxima rodada com novos exercícios.`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl border p-3"><strong className="block text-xl">{state.currentRoundAnswered.length}</strong>praticados</div>
            <div className="rounded-xl border p-3"><strong className="block text-xl text-green-600">{roundCorrect}</strong>acertos</div>
            <div className="rounded-xl border p-3"><strong className="block text-xl text-destructive">{roundErrors}</strong>erros</div>
            <div className="rounded-xl border p-3"><strong className="block text-xl text-primary">{recovered}</strong>recuperados</div>
            <div className="rounded-xl border p-3"><strong className="block text-xl">{progress.pendingCards}</strong>para revisar</div>
            <div className="rounded-xl border p-3"><strong className="block text-xl">{progress.unseenCards}</strong>novos</div>
          </div>
          <Button size="lg" className="w-full" onClick={mixed.nextRound}>Começar próxima rodada</Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={restartRoundManually}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refazer rodada
            </Button>
            <Button variant="ghost" onClick={restartJourneyManually}>Reiniciar percurso</Button>
          </div>
          <Button variant="ghost" onClick={exit}>Sair e continuar depois</Button>
        </Card>
      </div>
    );
  }

  if (state.status === "journey-complete") {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <Card className="mx-auto max-w-xl space-y-6 p-6 text-center sm:p-10">
          <Trophy className="mx-auto h-16 w-16 text-amber-500" />
          <div>
            <h1 className="text-3xl font-bold">Percurso concluído!</h1>
            <p className="mt-2 text-muted-foreground">Você dominou os {progress.totalCards} cards desta lista.</p>
          </div>
          <Button size="lg" className="w-full" onClick={mixed.restartJourney}>Jogar novamente</Button>
          <Button variant="outline" className="w-full" onClick={exit}>Voltar</Button>
        </Card>
      </div>
    );
  }

  if (!currentCard) {
    return <div className="grid min-h-[70vh] place-items-center text-muted-foreground">Card indisponível.</div>;
  }

  const sharedProps = {
    front: currentCard.term,
    back: currentCard.translation,
    hint: currentCard.hint,
    flashcardId: currentCard.id,
    wordHintsA: currentCard.word_hints,
    direction: resolvedDirection,
    langA: labels.langA,
    langB: labels.langB,
    onCorrect: () => handleAnswer(true),
    onIncorrect: () => handleAnswer(false),
    onSkip: requestSkip,
    onRestartRound: restartRoundManually,
    onRestartJourney: restartJourneyManually,
  };

  return (
    <div className="min-h-screen bg-background px-2 py-2 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-5xl space-y-2 sm:space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={exit}>
            <ArrowLeft className="mr-1 h-4 w-4" />Sair
          </Button>
          <div className="flex items-center gap-2">
            <GameSettingsModal
              settings={gameSettings}
              onSettingsChange={handleSettingsChange}
              onRestart={restartJourneyManually}
              showFastMode={false}
            />
            {selectedFlowMode === "mastery_rounds" && (
              <div className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary sm:px-3 sm:text-xs">
                ⭐ Gamificado
              </div>
            )}
          </div>
        </div>

        <Card className="space-y-2 p-2.5 sm:space-y-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                {selectedFlowMode === "continuous" ? "Modo extenso" : `Rodada ${state.roundNumber} · Tentativa ${state.attemptNumber}`}
              </p>
              <p className="text-xs text-muted-foreground">{getActivityLabel(mixed.activityMode)} · Card {progress.roundPosition} de {progress.roundTotal}</p>
            </div>
            {selectedFlowMode === "mastery_rounds" && (
              <div className="flex gap-1" aria-label={`${state.hearts} de ${state.maxHearts} corações`}>
                {Array.from({ length: state.maxHearts }).map((_, index) => (
                  <Heart
                    key={index}
                    className={index < state.hearts ? "h-6 w-6 fill-red-500 text-red-500 sm:h-7 sm:w-7" : "h-6 w-6 text-muted-foreground/30 sm:h-7 sm:w-7"}
                  />
                ))}
              </div>
            )}
          </div>
          <Progress value={progress.overallPercent} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress.masteredCards} de {progress.totalCards} dominados</span>
            <span>{selectedFlowMode === "continuous" ? "Sem interrupções até o fim" : `${progress.pendingCards} revisões pendentes`}</span>
          </div>

        </Card>

        <div key={`${state.roundNumber}:${state.attemptNumber}:${currentCard.id}:${mixed.activityMode}`}>
          {mixed.activityMode === "multiple-choice" && (
            <MultipleChoiceStudyView
              currentCard={currentCard}
              allCards={cards}
              direction={resolvedDirection}
              langA={labels.langA}
              langB={labels.langB}
              onCorrect={() => handleAnswer(true)}
              onIncorrect={() => handleAnswer(false)}
              onSkip={requestSkip}
              onRestartRound={restartRoundManually}
              onRestartJourney={restartJourneyManually}
            />
          )}
          {mixed.activityMode === "unscramble" && <UnscrambleStudyView {...sharedProps} />}
          {(mixed.activityMode === "write" || !mixed.activityMode) && (
            <WriteStudyView
              {...sharedProps}
              onSkip={() => handleAnswer(false, true)}
              acceptedAnswersEn={currentCard.accepted_answers_en}
              acceptedAnswersPt={currentCard.accepted_answers_pt}
            />
          )}
        </div>
      </div>
      <SkipCardConfirmDialog
        open={showSkipDialog}
        flowMode={selectedFlowMode}
        onCancel={() => {
          skipCardKeyRef.current = null;
          setShowSkipDialog(false);
        }}
        onKnown={() => classifySkip("known")}
        onUnknown={() => classifySkip("unknown")}
      />
    </div>
  );
}
