import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getLangLabel, resolveEffectiveListSettings } from "@/features/study/lib/resolveStudySides";
import { normalizeDirection, type Direction } from "@/features/study/lib/gameCore";
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
import { useFavorites, useToggleFavorite } from "@/hooks/useFavorites";
import { useRedList, useToggleRedList } from "@/hooks/useRedList";
import { ArrowLeft, Trophy, RefreshCcw, RotateCcw, Star, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { safeGoBack, getFallbackRoute } from "@/lib/safeNavigation";

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

  // ── Persistent study preferences ──
  // userId is set later after auth; prefs load with anon key initially
  const [authUserId, setAuthUserId] = useState<string | undefined>();
  const { prefs, updatePrefs } = useStudyPreferences(authUserId);
  // URL overrides are now applied at load time inside useStudyPreferences

  // Single canonical mode token for the entire engine + view chain.
  // normalizeStudyMode() handles aliases ("multiple" → "multiple-choice") and
  // unknown values (falls back to "flip"). No more inline Set + cast.
  const normalizedMode: StudyMode = normalizeStudyMode(prefs.mode);

  const initialDir: Direction = prefs.direction;
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
  
  // Direction state for flip mode selector
  const [flipDirection, setFlipDirection] = useState<Direction>(initialDir);
  
  // Completion modal
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  // Persistent completion key
  const completionKey = useMemo(() => {
    if (!resolvedId) return null;
    return `study-completed:${resolvedId}:${normalizedMode}:${initialDir}:${urlFavoritesOnly}`;
  }, [resolvedId, normalizedMode, initialDir, urlFavoritesOnly]);
  const isListRoute = window.location.pathname.includes("/list/");
  
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
  const effectiveFlashcards = useMemo(() => {
    if (!urlFavoritesOnly) return flashcards;
    if (favorites.length === 0) return flashcards; // fallback: estuda todos
    return flashcards.filter(c => favorites.includes(c.id));
  }, [flashcards, urlFavoritesOnly, favorites]);

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
  } = useStudyEngine(listId, stableFlashcards, normalizedMode as "flip" | "write" | "multiple-choice" | "unscramble" | "mixed" | "pronunciation", false, favorites, initialGameSettings, redListIds);

  // Derive favoritesOnly from the unified gameSettings (single source of truth for UI display)
  const favoritesOnly = gameSettings.subset === 'favorites';
  // Derive order from unified gameSettings
  const order = gameSettings.mode === 'sequential' ? 'asc' : 'random';

  // ── Sync flipDirection with prefs.direction (handles late-arriving auth/prefs) ──
  useEffect(() => {
    setFlipDirection(prefs.direction);
  }, [prefs.direction]);

  // ── Sync engine gameSettings with prefs APENAS durante a fase inicial ──
  // Depois que o jogo carregou, mudanças vêm via handleSettingsChange (caminho controlado)
  useEffect(() => {
    if (!loading) return;
    setGameSettings({
      mode: prefs.order === "sequential" ? "sequential" : "random",
      subset: prefs.favoritesOnly ? "favorites" : "all",
      fastMode: prefs.fastMode,
    });
  }, [prefs.order, prefs.favoritesOnly, prefs.fastMode, loading, setGameSettings]);

  // Direção estável por card
  const decideDirection = (idx: number): Direction => {
    // flipDirection is the SSOT for ALL modes, not just flip
    const dir = flipDirection;
    if (dir !== "any") {
      return dir;
    }
    return idx % 2 === 0 ? "b-a" : "a-b";
  };
  
  const resolvedDirection = decideDirection(currentIndex);
  
  // Mixed mode determinístico
  const modesCycle = ["flip","write","multiple-choice","unscramble"] as const;
  const mixedModeFor = (idx: number) => modesCycle[idx % modesCycle.length];
  
  const effectiveMode = normalizedMode === "mixed" ? mixedModeFor(currentIndex) : normalizedMode;
  const isPronunciationMode = effectiveMode === "pronunciation";

  useEffect(() => {
    loadFlashcards();
  }, [resolvedId, urlFavoritesOnly, initialOrder, initialDir]);

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
    
    const isListRoute = window.location.pathname.includes("/list/");
    const isPublicRoute = window.location.pathname.startsWith("/portal/collection/");

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

    const rawData = order === "random" ? shuffleArray([...cardsResult.data]) : cardsResult.data;
    
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
    // Use engine's cardsOrder as source of truth for which card is current
    const engineCardId = cardsOrder[currentIndex];
    if (engineCardId) {
      recordResult(engineCardId, correct, skipped);
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
    setGameSettings(newSettings);
    // Persist changes back to study preferences
    updatePrefs({
      order: newSettings.mode === 'sequential' ? 'sequential' : 'random',
      favoritesOnly: newSettings.subset === 'favorites',
      fastMode: newSettings.fastMode ?? false,
    });
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
  const engineCurrentCard = engineCurrentCardId
    ? (effectiveFlashcards.find(f => f.id === engineCurrentCardId) || flashcards.find(f => f.id === engineCurrentCardId))
    : undefined;

  const handleToggleFavorite = () => {
    if (!engineCurrentCard?.id || !userId) return;
    toggleFavorite.mutate({ 
      resourceId: engineCurrentCard.id, 
      resourceType: 'flashcard',
      isFavorite: favorites.includes(engineCurrentCard.id)
    });
  };

  const handleToggleRedList = () => {
    if (!engineCurrentCard?.id || !userId) return;
    // Only allow red-listing if it's a favorite
    if (!favorites.includes(engineCurrentCard.id)) {
      toast.error('Primeiro marque o card como favorito ⭐');
      return;
    }
    toggleRedList.mutate({
      flashcardId: engineCurrentCard.id,
      isRedListed: redListIds.includes(engineCurrentCard.id),
    });
  };

  // currentCard is now derived from the engine's cardsOrder (engineCurrentCard above)
  const currentCard = engineCurrentCard;

  // ── PERF: Read pre-parsed hints from cards (O(1) lookup, no parsing at render time) ──
  const getParsedHints = useCallback((card: Flashcard) => {
    return card.preParsedHints || [];
  }, []);

  // Merge glossary + per-card manual hints for the current card
  const currentCardId = currentCard?.id;
  const currentTerm = currentCard?.term;
  const currentTranslation = currentCard?.translation;

  const currentMergedHintsA = useMemo(() => {
    if (!currentCard || !currentTerm) return undefined;
    const manual = getParsedHints(currentCard);
    if (activeGlossary.length === 0 && manual.length === 0) return undefined;
    const langCtx = { langA: listSettings.langA, langB: listSettings.langB };
    return mergeGlossaryAndManual(currentTerm, "A", activeGlossary, manual, langCtx);
  }, [currentCardId, currentTerm, activeGlossary, getParsedHints, currentCard, listSettings.langA, listSettings.langB]);

  const currentMergedHintsB = useMemo(() => {
    if (!currentCard || !currentTranslation) return undefined;
    const manual = getParsedHints(currentCard);
    if (activeGlossary.length === 0 && manual.length === 0) return undefined;
    const langCtx = { langA: listSettings.langA, langB: listSettings.langB };
    return mergeGlossaryAndManual(currentTranslation, "B", activeGlossary, manual, langCtx);
  }, [currentCardId, currentTranslation, activeGlossary, getParsedHints, currentCard, listSettings.langA, listSettings.langB]);

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

  // Safety fallback — with recovery options
  if (!currentCard) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <Star className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground text-center text-lg font-medium">
          Não foi possível iniciar este modo com o filtro atual.
        </p>
        <p className="text-sm text-muted-foreground text-center">
          {favoritesOnly
            ? "Desative o filtro de favoritos ou marque mais cards nesta lista."
            : "Tente reiniciar a sessão de estudo."}
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
    <div className="min-h-screen bg-background py-4 sm:py-8 px-3 sm:px-4 lg:px-8">
      <div className="container mx-auto max-w-6xl">
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

        <div className="mb-6">
          {effectiveMode === "flip" && currentCard && (
            <FlipStudyView
              key={`${currentCard.id}-${currentIndex}`}
              front={currentCard.term}
              back={currentCard.translation}
              hint={currentCard.hint}
              flashcardId={currentCard.id}
              imageUrlA={FEATURE_FLAGS.study_images_enabled ? currentCard.image_url_a : null}
              imageUrlB={FEATURE_FLAGS.study_images_enabled ? currentCard.image_url_b : null}
              wordHintsA={FEATURE_FLAGS.word_hints_enabled ? currentCard.word_hints : null}
              wordHintsB={FEATURE_FLAGS.word_hints_enabled ? currentCard.word_hints : null}
              mergedHintsA={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsA : undefined}
              mergedHintsB={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsB : undefined}
              direction={resolvedDirection}
              fastMode={gameSettings.fastMode}
              ttsEnabled={listSettings.ttsEnabled}
              labelA={listSettings.labelsA}
              labelB={listSettings.labelsB}
              langA={listSettings.langA}
              langB={listSettings.langB}
              isFavorite={!!currentCard.id && favorites.includes(currentCard.id)}
              isRedListed={!!currentCard.id && redListIds.includes(currentCard.id)}
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
          {effectiveMode === "write" && currentCard && (
            <WriteStudyView
              key={`${currentCard.id}-${currentIndex}`}
              front={currentCard.term}
              back={currentCard.translation}
              hint={currentCard.hint}
              flashcardId={currentCard.id}
              acceptedAnswersEn={currentCard.accepted_answers_en || []}
              acceptedAnswersPt={currentCard.accepted_answers_pt || []}
              wordHintsA={FEATURE_FLAGS.word_hints_enabled ? currentCard.word_hints : null}
              mergedHintsA={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsA : undefined}
              mergedHintsB={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsB : undefined}
              direction={resolvedDirection}
              langA={listSettings.langA}
              langB={listSettings.langB}
              isFavorite={!!currentCard.id && favorites.includes(currentCard.id)}
              isRedListed={!!currentCard.id && redListIds.includes(currentCard.id)}
              onToggleFavorite={handleToggleFavorite}
              onToggleRedList={handleToggleRedList}
              onCorrect={() => handleNext(true)}
              onIncorrect={() => handleNext(false)}
              onSkip={() => handleNext(false, true)}
            />
          )}
          {effectiveMode === "multiple-choice" && currentCard && (
            <MultipleChoiceStudyView
              key={`${currentCard.id}-${currentIndex}`}
              currentCard={currentCard}
              allCards={effectiveFlashcards}
              direction={resolvedDirection}
              langA={listSettings.langA}
              langB={listSettings.langB}
              mergedHintsA={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsA : undefined}
              mergedHintsB={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsB : undefined}
              isFavorite={!!currentCard.id && favorites.includes(currentCard.id)}
              isRedListed={!!currentCard.id && redListIds.includes(currentCard.id)}
              onToggleFavorite={handleToggleFavorite}
              onToggleRedList={handleToggleRedList}
              onCorrect={() => handleNext(true)}
              onIncorrect={() => handleNext(false)}
            />
          )}
          {effectiveMode === "unscramble" && currentCard && (
            <UnscrambleStudyView
              key={`${currentCard.id}-${currentIndex}`}
              front={currentCard.term}
              back={currentCard.translation}
              hint={currentCard.hint}
              flashcardId={currentCard.id}
              wordHintsA={currentCard.word_hints}
              mergedHintsA={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsA : undefined}
              mergedHintsB={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsB : undefined}
              direction={resolvedDirection}
              langA={listSettings.langA}
              langB={listSettings.langB}
              isFavorite={!!currentCard.id && favorites.includes(currentCard.id)}
              isRedListed={!!currentCard.id && redListIds.includes(currentCard.id)}
              onToggleFavorite={handleToggleFavorite}
              onToggleRedList={handleToggleRedList}
              onCorrect={() => handleNext(true)}
              onIncorrect={() => handleNext(false)}
              onSkip={() => handleNext(false, true)}
            />
          )}
          {effectiveMode === "pronunciation" && currentCard && (
            <PronunciationStudyView
              key={`${currentCard.id}-${currentIndex}`}
              front={currentCard.term}
              back={currentCard.translation}
              wordHintsA={currentCard.word_hints}
              mergedHintsA={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsA : undefined}
              mergedHintsB={FEATURE_FLAGS.word_hints_enabled ? currentMergedHintsB : undefined}
              langA={listSettings?.langA || "en"}
              langB={listSettings?.langB || "pt"}
              labelA={listSettings?.labelsA || undefined}
              labelB={listSettings?.labelsB || undefined}
              isFavorite={!!currentCard.id && favorites.includes(currentCard.id)}
              isRedListed={!!currentCard.id && redListIds.includes(currentCard.id)}
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
    </div>
  );
};

export default Study;
