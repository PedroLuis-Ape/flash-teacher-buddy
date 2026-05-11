import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getLangLabel, resolveEffectiveListSettings } from "@/features/study/lib/resolveStudySides";
import { normalizeDirection, type Direction } from "@/features/study/lib/gameCore";
import { hashToBool } from "@/features/study/lib/gameCore";
import { normalizeStudyMode, type StudyMode } from "@/features/study/lib/studyMode";
import { getOfflineList } from "@/lib/offlineStore";
import { useListGlossary } from "@/hooks/useListGlossary";
import { mergeGlossaryAndManual, parseExtendedWordHints, type MergedHint } from "@/features/study/lib/glossaryMerge";
import { useStudyPreferences } from "@/hooks/useStudyPreferences";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
import { StudyVideoButton } from "@/features/study/components/StudyVideoButton";
import { GameSettingsModal, GameSettings } from "@/features/study/components/GameSettingsModal";
import { useStudyEngine } from "@/features/study/hooks/useStudyEngine";
import { StudyCompletionModal } from "@/features/study/components/StudyCompletionModal";
import { EditFlashcardDialog } from "@/components/EditFlashcardDialog";
import { useFavorites, useToggleFavorite } from "@/hooks/useFavorites";
import { useRedList, useToggleRedList } from "@/hooks/useRedList";
import { ArrowLeft, Trophy, RefreshCcw, RotateCcw, Star, CheckCircle, Flame, Layers, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { safeGoBack, getFallbackRoute } from "@/lib/safeNavigation";
import { pageMount } from "@/lib/perfLog";

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
  layer_index?: number | null;
  example_text?: string | null;
  example_translation?: string | null;
  context_tag?: string | null;
  short_explanation?: string | null;
  /** When set, this card is the entry-point of a layered group; siblings hold all layers (including this one) sorted by layer_index. */
  __layers?: Flashcard[];
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
  const resolvedId = (id as string) || (collectionId as string) || "";
  // Route distinction comes from useParams (declarative router-defined keys),
  // not pathname matching. Keeps things robust against future route additions.
  const isListRoute = Boolean(id);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // DEV-only mount marker (helps localize freezes when entering study).
  useEffect(() => {
    pageMount("Study", { id: resolvedId });
  }, [resolvedId]);

  // ── Persistent study preferences ──
  // userId is set later after auth; prefs load with anon key initially
  const [authUserId, setAuthUserId] = useState<string | undefined>();
  const { prefs, updatePrefs } = useStudyPreferences(authUserId);
  // URL overrides are applied at load time inside useStudyPreferences,
  // but the URL is ALSO read directly here as the canonical SSOT for the
  // session. This prevents stale prefs (e.g. anon storage from a previous
  // session) from overriding the user's just-clicked direction in GamesHub.
  const urlDirRaw = searchParams.get("dir") || searchParams.get("direction");
  const urlDirection: Direction | null = urlDirRaw && ["a-b", "b-a", "any"].includes(urlDirRaw)
    ? (urlDirRaw as Direction)
    : null;

  // Single canonical mode token for the entire engine + view chain.
  // normalizeStudyMode() handles aliases ("multiple" → "multiple-choice") and
  // unknown values (falls back to "flip"). No more inline Set + cast.
  const normalizedMode: StudyMode = normalizeStudyMode(prefs.mode);

  // SSOT for direction: URL wins over prefs. This guarantees that whatever
  // GamesHub sent in the URL is what the session uses, even if prefs are
  // stale or arrive late from auth.
  const initialDir: Direction = urlDirection ?? prefs.direction;
  const initialOrder = prefs.order;
  const urlFavoritesOnly = prefs.favoritesOnly;
  
  // Derive initial game settings from persistent prefs
  // NOTE: only used as initialSettings on first engine init; live updates flow via setGameSettings effect below
  const initialGameSettings = useMemo(() => ({
    mode: (initialOrder === "sequential" ? "sequential" : "random") as "sequential" | "random",
    subset: (urlFavoritesOnly ? "favorites" : "all") as "all" | "favorites",
    fastMode: prefs.fastMode,
  }), [initialOrder, urlFavoritesOnly, prefs.fastMode]);
  
  // Goal context
  const fromGoalId = searchParams.get("from_goal");
  const fromStepId = searchParams.get("from_step");

  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [listTitle, setListTitle] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [userId, setUserId] = useState<string | undefined>();
  const [listSettings, setListSettings] = useState<ListSettings>(getDefaultListSettings());
  // In-game card editor (uses the same EditFlashcardDialog as ListDetail)
  const [editingFlashcard, setEditingFlashcard] = useState<Flashcard | null>(null);
  // Tracks the currently visible layer id (for layered cards). Set up in an
  // effect below; consumed by handleNext / favorites toggles so they target
  // the visible layer rather than the deck entry-point.
  const displayedCardIdRef = useRef<string | null>(null);
  
  // Direction state for flip mode selector
  const [flipDirection, setFlipDirection] = useState<Direction>(initialDir);
  
  // Completion modal
  const [showCompletionModal, setShowCompletionModal] = useState(false);

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
  // isListRoute is now derived once at the top of the component (from useParams).
  
  // Fetch favorites for filtering (strictly scoped to the current list/collection)
  const favoritesScope = useMemo(() => {
    if (!resolvedId) return undefined;
    return isListRoute ? { listId: resolvedId } : { collectionId: resolvedId };
  }, [resolvedId, isListRoute]);
  const { data: favorites = [], isLoading: favoritesLoading } = useFavorites(userId, 'flashcard', favoritesScope);
  const toggleFavorite = useToggleFavorite();

  // Red list state (scoped to current list)
  const { data: redListIds = [] } = useRedList(userId, isListRoute ? resolvedId : undefined);
  const toggleRedList = useToggleRedList();

  const listId = isListRoute ? resolvedId : undefined;

  // Load list glossary for merged hints (skip fetch when feature disabled)
  const { activeGlossary } = useListGlossary(FEATURE_FLAGS.glossary_enabled ? listId : undefined);

  // Derive effective flashcards filtered by favorites when enabled.
  // FALLBACK SEGURO: se favoritesOnly estiver ativo mas a lista não tem nenhum favorito,
  // automaticamente retornamos todos os cards. Isso impede que a sessão fique vazia/bloqueada
  // por um estado herdado de outra lista. Um aviso leve é exibido via efeito mais abaixo.
  const favoritesFilterFellBack = urlFavoritesOnly && !favoritesLoading && favorites.length === 0 && flashcards.length > 0;
  // redFocus is session-scoped (NOT persisted in prefs). It lives on the
  // engine's gameSettings; we use a small local state mirror so we can derive
  // `effectiveFlashcards` without a circular dependency on the engine's output.
  // handleSettingsChange below keeps both in sync (mirror is updated first,
  // then restartSession is called).
  const [redFocusActiveForDeck, setRedFocusActiveForDeck] = useState<boolean>(false);
  const effectiveFlashcards = useMemo(() => {
    if (!urlFavoritesOnly) return flashcards;
    if (favorites.length === 0) return flashcards; // fallback: estuda todos
    const favSet = new Set(favorites);
    // Layered cards: a deck entry should match if ANY of its inner layers
    // is favorited (or the parent/principal id, when known). Otherwise the
    // group would disappear from the Favorites mode just because the user
    // starred layer 2 instead of layer 1.
    const cardMatchesFav = (c: Flashcard) => {
      if (favSet.has(c.id)) return true;
      const layers = (c as any).__layers as Flashcard[] | undefined;
      if (layers && layers.some(L => favSet.has(L.id))) return true;
      if (c.parent_card_id && favSet.has(c.parent_card_id)) return true;
      return false;
    };
    const favOnly = flashcards.filter(cardMatchesFav);
    if (!redFocusActiveForDeck) return favOnly;
    const redSet = new Set(redListIds);
    const cardMatchesRed = (c: Flashcard) => {
      if (redSet.has(c.id)) return true;
      const layers = (c as any).__layers as Flashcard[] | undefined;
      if (layers && layers.some(L => redSet.has(L.id))) return true;
      return false;
    };
    return favOnly.filter(cardMatchesRed);
  }, [flashcards, urlFavoritesOnly, favorites, redFocusActiveForDeck, redListIds]);

  // Memoize flashcards to prevent unstable references triggering re-init
  const prevIdsRef = useRef<string>("");
  const stableFlashcards = useMemo(() => {
    const ids = effectiveFlashcards.map(f => f.id).join(",");
    if (ids === prevIdsRef.current) return effectiveFlashcards;
    prevIdsRef.current = ids;
    return effectiveFlashcards;
  }, [effectiveFlashcards]);

  const {
    currentIndex,
    progress,
    correctCount,
    errorCount,
    skippedCount,
    results,
    isFinished,
    isLoading: studyLoading,
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
    hasMoreRounds,
    isGameComplete,
    startNextRound,
    resetSession,
    restartSession,
    gameSettings,
    setGameSettings,
    unseenCardsCount,
    missedCardsCount,
    completeSession,
    cardsOrder,
    saveProgressNow,
  } = useStudyEngine(listId, stableFlashcards, normalizedMode, false, favorites, initialGameSettings, redListIds);

  // Derive favoritesOnly from the unified gameSettings (single source of truth for UI display)
  const favoritesOnly = gameSettings.subset === 'favorites';
  const redFocusActive = !!gameSettings.redFocus && favoritesOnly;
  // Derive order from unified gameSettings
  const order = gameSettings.mode === 'sequential' ? 'asc' : 'random';

  // ── Sync flipDirection: URL wins, then prefs (handles late-arriving auth) ──
  // The URL is set by GamesHub at startGame() and is the user's most recent
  // explicit choice. Only fall back to prefs.direction if the URL is missing.
  useEffect(() => {
    setFlipDirection(urlDirection ?? prefs.direction);
  }, [urlDirection, prefs.direction]);

  // ── Sync engine gameSettings with prefs APENAS UMA VEZ no mount ──
  // Após esse sync inicial, mudanças vêm via handleSettingsChange (caminho controlado).
  // Usar uma ref impede que mudanças posteriores em prefs reescrevam settings já em uso.
  const initialSyncDoneRef = useRef(false);
  useEffect(() => {
    if (initialSyncDoneRef.current) return;
    if (loading) return; // espera flashcards carregarem para ter contexto válido
    initialSyncDoneRef.current = true;
    setGameSettings({
      mode: prefs.order === "sequential" ? "sequential" : "random",
      subset: prefs.favoritesOnly ? "favorites" : "all",
      fastMode: prefs.fastMode,
    });
    if (import.meta.env.DEV) {
      console.debug("[Study] Initial gameSettings sync", {
        mode: normalizedMode,
        order: prefs.order,
        favoritesOnly: prefs.favoritesOnly,
        fastMode: prefs.fastMode,
      });
    }
  }, [loading, prefs.order, prefs.favoritesOnly, prefs.fastMode, normalizedMode, setGameSettings]);

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
    loadFlashcards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedId]);

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
    if (isFinished) {
      setShowCompletionModal(true);
      // Persist completion state
      if (completionKey) {
        try { localStorage.setItem(completionKey, Date.now().toString()); } catch {}
      }
    }
  }, [isFinished, completionKey]);

  // On mount: check if this session was already completed and show restart prompt
  useEffect(() => {
    if (!completionKey || loading || studyLoading) return;
    try {
      const saved = localStorage.getItem(completionKey);
      if (saved) {
        setShowCompletionModal(true);
      }
    } catch {}
  }, [completionKey, loading, studyLoading]);

  const loadFlashcards = async () => {
    if (!resolvedId) return;

    setLoading(true);

    // isPublicRoute derived from pathname here (no router match available without
    // declaring a route prefix), but isListRoute is the SSOT from useParams above.
    const isPublicRoute = window.location.pathname.startsWith("/portal/collection/");

    if (import.meta.env.DEV) {
      console.debug("[Study] Loading flashcards", { resolvedId, isListRoute, isPublicRoute });
    }

    try {

    // Offline fallback
    if (!navigator.onLine && isListRoute) {
      try {
        const offlineData = await getOfflineList(resolvedId);
        if (offlineData) {
          const orderedData = order === "random" ? shuffleArray([...offlineData.flashcards]) : offlineData.flashcards;
          setFlashcards(orderedData as Flashcard[]);
          setListTitle(offlineData.listMeta.title);
          setListSettings({
            studyType: (offlineData.listMeta.study_type === "general" ? "general" : "language") as "language" | "general",
            langA: offlineData.listMeta.lang_a,
            langB: offlineData.listMeta.lang_b,
            labelsA: offlineData.listMeta.labels_a,
            labelsB: offlineData.listMeta.labels_b,
            ttsEnabled: offlineData.listMeta.tts_enabled,
          });
          setLoading(false);
          toast.info("Usando dados offline");
          return;
        }
      } catch {
        // fall through
      }
      toast.error("Esta lista não está disponível offline");
      setLoading(false);
      return;
    }
    
    const { data: { session } } = await supabase.auth.getSession();
    setUserId(session?.user?.id);
    setAuthUserId(session?.user?.id);
    
    if (isListRoute && !session) {
      const { data, error } = await supabase.rpc('get_portal_flashcards', { 
        _list_id: resolvedId 
      });

      if (error) {
        console.error("Erro ao carregar flashcards:", error);
        toast.error("Erro ao carregar flashcards");
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        toast.error("Esta lista não possui flashcards");
        setLoading(false);
        return;
      }

      const shuffled = order === "random" ? shuffleArray([...data]) : data;
      setFlashcards(shuffled);
      setLoading(false);
      return;
    }
    
    const queryColumn = isListRoute ? "list_id" : "collection_id";
    
    // ── PERF: Fetch flashcards + list metadata in parallel ──
    const cardsPromise = supabase
      .from("flashcards")
      .select("*")
      .eq(queryColumn, resolvedId)
      .is("deleted_at", null);

    const listPromise = isListRoute
      ? supabase
          .from("lists")
          .select("title, folder_id, study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled")
          .eq("id", resolvedId)
          .maybeSingle()
      : Promise.resolve({ data: null });

    const [cardsResult, listResult] = await Promise.all([cardsPromise, listPromise]);

    if (cardsResult.error) {
      toast.error("Erro ao carregar flashcards");
      navigate(isListRoute ? `/list/${resolvedId}` : (isPublicRoute ? `/portal/collection/${resolvedId}` : "/"));
      return;
    }

    if (!cardsResult.data || cardsResult.data.length === 0) {
      toast.error(isListRoute ? "Esta lista não tem flashcards ainda" : "Esta coleção não tem flashcards ainda");
      navigate(isListRoute ? `/list/${resolvedId}` : (isPublicRoute ? `/portal/collection/${resolvedId}` : `/collection/${resolvedId}`));
      return;
    }

    // Layered cards: principals (aggregator rows referenced as parent_card_id
    // by other cards) are never shown in the study deck. Their layer rows are
    // real flashcards — but instead of appearing as N independent items, we
    // group them: only the FIRST layer enters the deck, with the full sorted
    // sibling list attached as `__layers`. The view then shows the active
    // layer and offers a "Próxima camada" button to cycle within the group,
    // while progress is still recorded per-layer (each layer has its own id).
    const allCards = cardsResult.data as any[];
    const principalIds = new Set<string>();
    const layersByPrincipal = new Map<string, any[]>();
    for (const c of allCards) {
      if (c.parent_card_id) {
        principalIds.add(c.parent_card_id);
        const arr = layersByPrincipal.get(c.parent_card_id) ?? [];
        arr.push(c);
        layersByPrincipal.set(c.parent_card_id, arr);
      }
    }
    for (const arr of layersByPrincipal.values()) {
      arr.sort((a, b) => (a.layer_index ?? 0) - (b.layer_index ?? 0));
    }
    const studyableCards: any[] = [];
    for (const c of allCards) {
      // Skip principal aggregator rows (they have no own meaning).
      if (principalIds.has(c.id) && !c.parent_card_id) continue;
      if (c.parent_card_id) {
        const group = layersByPrincipal.get(c.parent_card_id) ?? [];
        // Only the first layer of each group is the deck entry-point.
        if (group[0]?.id !== c.id) continue;
        studyableCards.push({ ...c, __layers: group });
      } else {
        studyableCards.push(c);
      }
    }
    const rawData = order === "random" ? shuffleArray([...studyableCards]) : studyableCards;
    
    // ── PERF: Pre-parse word_hints at load time (off the render path) ──
    const orderedData: Flashcard[] = rawData.map((card: any) => ({
      ...card,
      preParsedHints: card.word_hints ? parseExtendedWordHints(card.word_hints) : undefined,
    }));
    
    const listData = listResult.data as any;

    if (isListRoute && listData) {
      setListTitle(listData.title);

      // ── PERF: Fetch folder + video in parallel ──
      const folderPromise = listData.folder_id
        ? supabase
            .from("folders")
            .select("study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled")
            .eq("id", listData.folder_id)
            .maybeSingle()
        : Promise.resolve({ data: null });

      const videoPromise = listData.folder_id
        ? supabase
            .from("videos")
            .select("video_id, title")
            .eq("folder_id", listData.folder_id)
            .eq("is_published", true)
            .order("order_index", { ascending: true })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null });

      const [folderResult, videoResult] = await Promise.all([folderPromise, videoPromise]);

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

    // Set flashcards last (triggers engine init)
    setFlashcards(orderedData);
    } catch (err) {
      console.error("[Study] Falha ao carregar flashcards:", err);
      toast.error("Erro ao carregar dados. Verifique sua conexão.");
    } finally {
      setLoading(false);
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
    // For layered cards, progress is recorded against the visible layer's id
    // (each layer is a real flashcard row). For normal cards the engine's
    // cardsOrder id is the same as the displayed card.
    const cardId = displayedCardIdRef.current ?? cardsOrder[currentIndex];
    if (cardId) {
      recordResult(cardId, correct, skipped);
    }
    goToNext();
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
    const fallback = getFallbackRoute(window.location.pathname);
    safeGoBack(navigate, fallback);
  };

  const handleDirectionChange = (value: string) => {
    const dir = normalizeDirection(value);
    setFlipDirection(dir);
    updatePrefs({ direction: dir });
  };

  const handleSettingsChange = (newSettings: GameSettings) => {
    // RULE: redFocus only makes sense when subset === 'favorites'. Force off otherwise.
    const coerced: GameSettings = {
      ...newSettings,
      redFocus: newSettings.subset === 'favorites' ? !!newSettings.redFocus : false,
    };

    const subsetChanged = coerced.subset !== gameSettings.subset;
    const redFocusChanged = !!coerced.redFocus !== !!gameSettings.redFocus;

    // Persistência por escopo: ao trocar de all↔favorites (ou redFocus), o
    // engine vai REINICIALIZAR carregando a study_session do novo escopo
    // (não é reset). Antes de trocar, gravamos imediatamente o índice atual
    // para que o trail anterior preserve onde o usuário parou.
    if (subsetChanged || redFocusChanged) {
      void saveProgressNow();
    }

    setGameSettings(coerced);
    // Keep the deck-filter mirror in sync so effectiveFlashcards recomputes.
    setRedFocusActiveForDeck(!!coerced.redFocus && coerced.subset === 'favorites');
    // Persist changes back to study preferences (redFocus is session-scoped only)
    updatePrefs({
      order: coerced.mode === 'sequential' ? 'sequential' : 'random',
      favoritesOnly: coerced.subset === 'favorites',
      fastMode: coerced.fastMode ?? false,
    });

    // NOTA: NÃO chamar restartSession aqui. O engine detecta a mudança de
    // escopo (subset/redFocus/order) via sessionScopeKey + cardsSignature e
    // re-inicializa carregando a sessão persistida daquele escopo (ou cria
    // uma nova se for a primeira vez). Reset só acontece quando o usuário
    // pede explicitamente em "Reiniciar Jogo".
  };

  const handleRestartWithSettings = () => {
    setShowCompletionModal(false);
    // Clear persistent completion state on restart
    if (completionKey) {
      try { localStorage.removeItem(completionKey); } catch {}
    }
    restartSession(gameSettings);
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

  const handleToggleFavorite = () => {
    const targetId = displayedCardIdRef.current ?? engineCurrentCard?.id;
    if (!targetId || !userId) return;
    toggleFavorite.mutate({ 
      resourceId: targetId,
      resourceType: 'flashcard',
      isFavorite: favorites.includes(targetId)
    });
  };

  const handleToggleRedList = () => {
    const targetId = displayedCardIdRef.current ?? engineCurrentCard?.id;
    if (!targetId || !userId) return;
    // Only allow red-listing if it's a favorite
    if (!favorites.includes(targetId)) {
      toast.error('Primeiro marque o card como favorito ⭐');
      return;
    }
    toggleRedList.mutate({
      flashcardId: targetId,
      isRedListed: redListIds.includes(targetId),
    });
  };

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
      setFlashcards(prev =>
        prev.map(card =>
          card.id === flashcardId
            ? {
                ...card,
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
              }
            : card
        )
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
  useEffect(() => {
    // Default to layer 0. When the user is in Favorites mode (or Foco Vermelho),
    // try to start on the first layer that is favorited / red-listed so the
    // group opens on the layer the student actually starred.
    const card = engineCurrentCardId ? flashcardById.get(engineCurrentCardId) : undefined;
    const layers = (card as any)?.__layers as Flashcard[] | undefined;
    if (!layers || layers.length === 0) {
      setLayerIdx(0);
      return;
    }
    if (urlFavoritesOnly && favorites.length > 0) {
      const favSet = new Set(favorites);
      const redSet = new Set(redListIds);
      const wantRed = redFocusActiveForDeck;
      const idx = layers.findIndex(L =>
        wantRed ? redSet.has(L.id) : favSet.has(L.id)
      );
      setLayerIdx(idx >= 0 ? idx : 0);
      return;
    }
    setLayerIdx(0);
  }, [engineCurrentCardId, flashcardById, urlFavoritesOnly, favorites, redListIds, redFocusActiveForDeck]);
  const cardLayers = (currentCard as any)?.__layers as Flashcard[] | undefined;
  const hasLayers = Array.isArray(cardLayers) && cardLayers.length > 1;
  const safeLayerIdx = hasLayers ? Math.min(layerIdx, cardLayers!.length - 1) : 0;
  // The "displayed" card is the active layer when the deck card is layered.
  // It carries the same shape as a normal flashcard, including its own id —
  // so progress, favorites, edit, etc. naturally target the visible layer.
  const displayedCard: Flashcard | undefined = hasLayers
    ? { ...(cardLayers![safeLayerIdx] as Flashcard), preParsedHints: (cardLayers![safeLayerIdx] as any).preParsedHints }
    : currentCard;
  useEffect(() => {
    displayedCardIdRef.current = displayedCard?.id ?? null;
  }, [displayedCard?.id]);

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

  // FALLBACK: se o filtro de favoritos estava ativo mas a lista não tem favoritos,
  // não bloqueamos a sessão — estudamos todos os cards e mostramos um aviso curto.
  // Este efeito desativa o flag persistido para limpar o estado herdado.
  useEffect(() => {
    if (favoritesFilterFellBack) {
      toast.info("Nenhum favorito encontrado. Exibindo todos os cards.");
      updatePrefs({ favoritesOnly: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoritesFilterFellBack]);

  // Helper to disable favorites filter and restart with all cards
  const handleDisableFavoritesFilter = () => {
    updatePrefs({ favoritesOnly: false });
    handleSettingsChange({ ...gameSettings, subset: 'all' });
    // Restart with all cards
    restartSession({ ...gameSettings, subset: 'all' });
  };

  if (loading || studyLoading || (favoritesOnly && favoritesLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Engine still building cardsOrder (window between setFlashcards and engine init).
  // Show a discreet spinner instead of the alarming "Não foi possível iniciar" screen.
  // The real "no cards" case is handled inside loadFlashcards() with a toast + redirect.
  if (!currentCard && flashcards.length > 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Preparando sua sessão...</p>
      </div>
    );
  }

  // True empty state: no cards at all (e.g. after errors, or favorites filter
  // somehow still produced 0 — shouldn't happen given the fallback, but kept as
  // a last-resort safety net with a recovery action).
  if (!currentCard) {
    // Friendly empty state when redFocus produces zero cards
    if (redFocusActive) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
          <Flame className="h-12 w-12 text-red-500" />
          <p className="text-foreground text-center text-lg font-medium">
            Nenhum card em Foco Vermelho nesta lista.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              variant="default"
              onClick={() => handleSettingsChange({ ...gameSettings, redFocus: false })}
            >
              Estudar favoritos
            </Button>
            <Button variant="outline" onClick={handleDisableFavoritesFilter}>
              Estudar todos
            </Button>
            <Button variant="ghost" onClick={handleExit}>Voltar</Button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <Star className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground text-center text-lg font-medium">
          Esta lista não tem cards disponíveis no momento.
        </p>
        <div className="flex gap-3">
          {favoritesOnly && (
            <Button variant="default" onClick={handleDisableFavoritesFilter}>
              Estudar todos os cards
            </Button>
          )}
          <Button variant="outline" onClick={handleExit}>Voltar</Button>
        </div>
      </div>
    );
  }

  if (isFinished) {
    const isFlipMode = normalizedMode === "flip";
    const showNextRound = !isFlipMode && hasMoreRounds && !isGameComplete;

    return (
      <div className="min-h-screen bg-background py-12 px-4 pb-32 md:pb-12">
        <div className="container mx-auto max-w-2xl">
          <Card className="p-8 text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Trophy className="h-10 w-10 text-primary" />
            </div>

            <h1 className="text-3xl font-bold">
              {isGameComplete ? "Parabéns! Todos os cards dominados! 🎉" : `Rodada ${roundNumber} Concluída!`}
            </h1>

            <div className="grid grid-cols-3 gap-4 py-6">
              <div className="space-y-2">
                <div className="text-3xl font-bold text-green-600">{isFlipMode ? correctCount : roundCorrect}</div>
                <div className="text-sm text-muted-foreground">Acertos</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-destructive">{isFlipMode ? errorCount : roundErrors}</div>
                <div className="text-sm text-muted-foreground">Erros</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-warning">{skippedCount}</div>
                <div className="text-sm text-muted-foreground">Pulados</div>
              </div>
            </div>

            {!isFlipMode && !isGameComplete && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Cards restantes: {unseenCardsCount}</p>
                <p>Cards para revisar: {missedCardsCount}</p>
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
              <Button 
                variant="default" 
                size="lg" 
                onClick={completeSession}
                className="w-full sm:w-auto min-w-[220px] text-lg font-bold shadow-lg bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="mr-2 h-6 w-6" />
                CONCLUIR SESSÃO
              </Button>

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
                  onClick={handleRestartWithSettings}
                >
                  <RotateCcw className="mr-2 h-5 w-5" />
                  Jogar Novamente
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
                onClick={handleExit}
              >
                Voltar à Lista
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
                <Button variant="secondary" size="sm" onClick={handleRestartWithSettings}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Jogar Novamente
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
              <Button variant="ghost" size="sm" onClick={handleExit}>
                Voltar
              </Button>
            </div>
          </Card>
        </div>

        {/* Mobile: Sticky bottom button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t md:hidden">
          <Button 
            variant="default" 
            size="lg" 
            onClick={completeSession}
            className="w-full text-lg font-bold shadow-lg bg-green-600 hover:bg-green-700 min-h-[56px]"
          >
            <CheckCircle className="mr-2 h-6 w-6" />
            CONCLUIR SESSÃO
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-red-focus={redFocusActive ? "true" : undefined}
      className={`min-h-screen py-4 sm:py-8 px-3 sm:px-4 lg:px-8 transition-colors ${
        redFocusActive
          ? "bg-gradient-to-b from-red-950/40 via-background to-background"
          : "bg-background"
      }`}
    >
      <div className="container mx-auto max-w-6xl">
        {redFocusActive && (
          <div className="mb-3 flex items-center justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-sm font-medium text-red-500">
              <Flame className="h-4 w-4" />
              Foco Vermelho
            </div>
          </div>
        )}
        <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
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
                  currentCard
                    ? () => setEditingFlashcard(currentCard as Flashcard)
                    : undefined
                }
                canEditCurrentCard={!!currentCard}
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
              
              <div className="hidden sm:flex gap-4 text-sm">
                <span className="text-success font-medium">✓ {correctCount}</span>
                <span className="text-destructive font-medium">✗ {errorCount}</span>
                <span className="text-warning font-medium">⊘ {skippedCount}</span>
              </div>
            </div>
          </div>

          {/* Language direction indicator */}
          {listSettings.studyType === "language" && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="px-1.5 py-0.5 rounded bg-muted font-medium">A: {listSettings.labelsA}</span>
              <span>→</span>
              <span className="px-1.5 py-0.5 rounded bg-muted font-medium">B: {listSettings.labelsB}</span>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {currentIndex + 1} / {totalCards}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>

          {/* Mobile score display */}
          <div className="flex sm:hidden justify-center gap-6 text-sm py-2">
            <span className="text-success font-medium">✓ {correctCount}</span>
            <span className="text-destructive font-medium">✗ {errorCount}</span>
            <span className="text-warning font-medium">⊘ {skippedCount}</span>
          </div>
        </div>

        {hasLayers && cardLayers && (
          <div className="mb-3 flex items-center justify-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <Layers className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium">
              Camada {safeLayerIdx + 1} de {cardLayers.length}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto h-8"
              onClick={() => setLayerIdx((i) => (i + 1) % cardLayers.length)}
            >
              Próxima camada
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="mb-6">
          {effectiveMode === "flip" && displayedCard && (
            <FlipStudyView
              key={`${displayedCard.id}-${currentIndex}`}
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
              isFavorite={!!displayedCard.id && favorites.includes(displayedCard.id)}
              isRedListed={!!displayedCard.id && redListIds.includes(displayedCard.id)}
              onToggleFavorite={handleToggleFavorite}
              onToggleRedList={handleToggleRedList}
              onKnew={() => handleNext(true)}
              onDidntKnow={() => handleNext(false)}
              onNext={navigateNext}
              onPrevious={navigatePrevious}
              canGoPrevious={canGoPrevious}
              canGoNext={canGoNext}
            />
          )}
          {effectiveMode === "write" && displayedCard && (
            <WriteStudyView
              key={`${displayedCard.id}-${currentIndex}`}
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
              isFavorite={!!displayedCard.id && favorites.includes(displayedCard.id)}
              isRedListed={!!displayedCard.id && redListIds.includes(displayedCard.id)}
              onToggleFavorite={handleToggleFavorite}
              onToggleRedList={handleToggleRedList}
              onCorrect={() => handleNext(true)}
              onIncorrect={() => handleNext(false)}
              onSkip={() => handleNext(false, true)}
            />
          )}
          {effectiveMode === "multiple-choice" && displayedCard && (
            <MultipleChoiceStudyView
              key={`${displayedCard.id}-${currentIndex}`}
              currentCard={displayedCard}
              allCards={effectiveFlashcards}
              direction={resolvedDirection}
              langA={listSettings.langA}
              langB={listSettings.langB}
              mergedHintsA={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsA : undefined}
              mergedHintsB={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsB : undefined}
              isFavorite={!!displayedCard.id && favorites.includes(displayedCard.id)}
              isRedListed={!!displayedCard.id && redListIds.includes(displayedCard.id)}
              onToggleFavorite={handleToggleFavorite}
              onToggleRedList={handleToggleRedList}
              onCorrect={() => handleNext(true)}
              onIncorrect={() => handleNext(false)}
            />
          )}
          {effectiveMode === "unscramble" && displayedCard && (
            <UnscrambleStudyView
              key={`${displayedCard.id}-${currentIndex}`}
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
              isFavorite={!!displayedCard.id && favorites.includes(displayedCard.id)}
              isRedListed={!!displayedCard.id && redListIds.includes(displayedCard.id)}
              onToggleFavorite={handleToggleFavorite}
              onToggleRedList={handleToggleRedList}
              onCorrect={() => handleNext(true)}
              onIncorrect={() => handleNext(false)}
              onSkip={() => handleNext(false, true)}
            />
          )}
          {effectiveMode === "pronunciation" && displayedCard && (
            <PronunciationStudyView
              key={`${displayedCard.id}-${currentIndex}`}
              front={displayedCard.term}
              back={displayedCard.translation}
              wordHintsA={displayedCard.word_hints}
              mergedHintsA={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsA : undefined}
              mergedHintsB={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsB : undefined}
              langA={listSettings?.langA || "en"}
              langB={listSettings?.langB || "pt"}
              labelA={listSettings?.labelsA || undefined}
              labelB={listSettings?.labelsB || undefined}
              isFavorite={!!displayedCard.id && favorites.includes(displayedCard.id)}
              isRedListed={!!displayedCard.id && redListIds.includes(displayedCard.id)}
              onToggleFavorite={handleToggleFavorite}
              onToggleRedList={handleToggleRedList}
              onNext={() => handleNext(true)}
            />
          )}
        </div>

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
            <AlertDialogTitle>Sair do estudo?</AlertDialogTitle>
            <AlertDialogDescription>
              Seu progresso será salvo e você poderá voltar depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar estudando</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                setShowExitDialog(false);
                handleExit();
              }}
            >
              Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StudyCompletionModal
        open={showCompletionModal}
        correctCount={correctCount}
        errorCount={errorCount}
        skippedCount={skippedCount}
        totalCards={totalCards}
        onComplete={() => {
          setShowCompletionModal(false);
          if (completionKey) {
            try { localStorage.removeItem(completionKey); } catch {}
          }
          completeSession();
        }}
        onRestart={handleRestartWithSettings}
        onReviewErrors={errorCount > 0 ? handleReviewErrors : undefined}
        onExit={() => {
          setShowCompletionModal(false);
          handleExit();
        }}
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
