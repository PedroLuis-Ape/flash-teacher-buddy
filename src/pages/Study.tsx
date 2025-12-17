import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import { FlipStudyView } from "@/components/FlipStudyView";
import { WriteStudyView } from "@/components/WriteStudyView";
import { MultipleChoiceStudyView } from "@/components/MultipleChoiceStudyView";
import { UnscrambleStudyView } from "@/components/UnscrambleStudyView";
import { PronunciationStudyView } from "@/components/PronunciationStudyView";
import { StudyVideoButton } from "@/components/StudyVideoButton";
import { GameSettingsModal, GameSettings } from "@/components/GameSettingsModal";
import { useStudyEngine } from "@/hooks/useStudyEngine";
import { useFavorites, useToggleFavorite } from "@/hooks/useFavorites";
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Normalizar mode, dir/direction e order
  const rawMode = (searchParams.get("mode") || "flip").toLowerCase();
  const validModes = new Set(["flip","write","multiple","multiple-choice","unscramble","mixed","pronunciation"]);
  const mode = validModes.has(rawMode) ? rawMode : "flip";
  const normalizedMode = mode === "multiple" ? "multiple-choice" : mode;

  const rawDir = (searchParams.get("dir") || searchParams.get("direction") || "any").toLowerCase();
  const validDirs = new Set(["pt-en","en-pt","any"]);
  const initialDir = validDirs.has(rawDir) ? (rawDir as "pt-en"|"en-pt"|"any") : "any";

  const rawOrder = (searchParams.get("order") || "random").toLowerCase();
  const order = rawOrder === "asc" ? "asc" : "random";
  
  const favoritesOnly = searchParams.get("favorites") === "true";
  
  // Goal context - para "Voltar para Metas"
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
  const [flipDirection, setFlipDirection] = useState<"pt-en" | "en-pt" | "any">(initialDir);
  
  // Fetch favorites for filtering
  const { data: favorites = [] } = useFavorites(userId, 'flashcard');
  const toggleFavorite = useToggleFavorite();

  const isListRoute = window.location.pathname.includes("/list/");
  const listId = isListRoute ? resolvedId : undefined;

  // Memoize flashcards to prevent unstable references triggering re-init
  const stableFlashcards = useMemo(() => flashcards, [JSON.stringify(flashcards.map(f => f.id))]);

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
    // Spaced repetition features
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
    // Manual session completion
    completeSession,
  } = useStudyEngine(listId, stableFlashcards, normalizedMode as "flip" | "write" | "multiple-choice" | "unscramble", false, favorites);
  
  // Direção estável por card - use flipDirection for flip mode
  const decideDirection = (idx: number): "pt-en" | "en-pt" => {
    const dir = normalizedMode === "flip" ? flipDirection : initialDir;
    if (dir !== "any") return dir;
    // For "any", alternate deterministically based on card index
    return idx % 2 === 0 ? "pt-en" : "en-pt";
  };
  
  const resolvedDirection = decideDirection(currentIndex);
  
  // Mixed mode determinístico (não inclui pronunciation no ciclo automático)
  const modesCycle = ["flip","write","multiple-choice","unscramble"] as const;
  const mixedModeFor = (idx: number) => modesCycle[idx % modesCycle.length];
  
  const effectiveMode = normalizedMode === "mixed" ? mixedModeFor(currentIndex) : normalizedMode;
  const isPronunciationMode = effectiveMode === "pronunciation";

  useEffect(() => {
    loadFlashcards();
    // Note: favorites removed from deps to prevent reload on toggle
  }, [resolvedId, favoritesOnly]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowExitDialog(true);
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const loadFlashcards = async () => {
    if (!resolvedId) return;

    setLoading(true);
    
    // Check if this is a list or collection
    const isListRoute = window.location.pathname.includes("/list/");
    const isPublicRoute = window.location.pathname.startsWith("/portal/collection/");
    
    const { data: { session } } = await supabase.auth.getSession();
    setUserId(session?.user?.id);
    
    // Se for lista sem sessão, usar RPC público
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
    
    const { data, error } = await supabase
      .from("flashcards")
      .select("*")
      .eq(queryColumn, resolvedId);

    if (error) {
      toast.error("Erro ao carregar flashcards");
      navigate(isListRoute ? `/list/${resolvedId}` : (isPublicRoute ? `/portal/collection/${resolvedId}` : "/"));
      return;
    }

    if (!data || data.length === 0) {
      toast.error(isListRoute ? "Esta lista não tem flashcards ainda" : "Esta coleção não tem flashcards ainda");
      navigate(isListRoute ? `/list/${resolvedId}` : (isPublicRoute ? `/portal/collection/${resolvedId}` : `/collection/${resolvedId}`));
      return;
    }

    // Filter by favorites if enabled
    let filteredData = data;
    if (favoritesOnly && favorites.length > 0) {
      filteredData = data.filter(card => favorites.includes(card.id));
      if (filteredData.length === 0) {
        toast.error("Nenhum flashcard favorito encontrado nesta lista");
        navigate(isListRoute ? `/list/${resolvedId}` : `/collection/${resolvedId}`);
        return;
      }
    }

    const orderedData = order === "random" ? shuffleArray([...filteredData]) : filteredData;
    setFlashcards(orderedData);

    // Load list info and video if this is a list route
    if (isListRoute) {
      const { data: listData } = await supabase
        .from("lists")
        .select("title, folder_id, study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled")
        .eq("id", resolvedId)
        .maybeSingle();
      
      if (listData) {
        setListTitle(listData.title);
        
        // Set list settings from DB (with fallbacks for old data)
        const studyType = (listData.study_type === "general" ? "general" : "language") as "language" | "general";
        const langA = listData.lang_a || "en";
        const langB = listData.lang_b || "pt";
        const defaultLabelA = studyType === "general" ? "Frente" : (langA === "en" ? "English" : langA === "pt" ? "Português" : langA.toUpperCase());
        const defaultLabelB = studyType === "general" ? "Verso" : (langB === "pt" ? "Português" : langB === "en" ? "English" : langB.toUpperCase());
        
        setListSettings({
          studyType,
          langA,
          langB,
          labelsA: listData.labels_a || defaultLabelA,
          labelsB: listData.labels_b || defaultLabelB,
          ttsEnabled: listData.tts_enabled ?? (studyType === "language"),
        });
        
        // Load first video from the folder
        const { data: videoData } = await supabase
          .from("videos")
          .select("video_id, title")
          .eq("folder_id", listData.folder_id)
          .eq("is_published", true)
          .order("order_index", { ascending: true })
          .limit(1)
          .maybeSingle();
        
        if (videoData) {
          setVideoInfo({
            videoId: videoData.video_id,
            title: videoData.title
          });
        }
      }
    }

    setLoading(false);
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
    if (currentIndex < flashcards.length) {
      recordResult(flashcards[currentIndex].id, correct, skipped);
    }
    goToNext();
  };

  const handleReviewErrors = () => {
    const errorIds = results.filter((r) => !r.correct && !r.skipped).map((r) => r.flashcardId);
    const errorCards = flashcards.filter((card) => errorIds.includes(card.id));
    
    if (errorCards.length > 0) {
      setFlashcards(shuffleArray(errorCards));
      window.location.reload();
    }
  };

  const handleExit = () => {
    const fallback = getFallbackRoute(window.location.pathname);
    safeGoBack(navigate, fallback);
  };

  const handleDirectionChange = (value: string) => {
    setFlipDirection(value as "pt-en" | "en-pt" | "any");
  };

  const handleSettingsChange = (newSettings: GameSettings) => {
    setGameSettings(newSettings);
  };

  const handleRestartWithSettings = () => {
    restartSession(gameSettings);
  };

  const handleToggleFavorite = () => {
    const card = flashcards[currentIndex];
    if (!card?.id || !userId) return;
    toggleFavorite.mutate({ 
      resourceId: card.id, 
      resourceType: 'flashcard',
      isFavorite: favorites.includes(card.id)
    });
  };

  if (loading || studyLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];

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
              {/* CONCLUIR SESSÃO - Botão principal para registrar meta */}
              <Button 
                variant="default" 
                size="lg" 
                onClick={completeSession}
                className="w-full sm:w-auto min-w-[220px] text-lg font-bold shadow-lg bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="mr-2 h-6 w-6" />
                CONCLUIR SESSÃO
              </Button>

              {/* Se houver próxima rodada, botão de avançar */}
              {showNextRound && (
                <Button variant="secondary" size="lg" onClick={startNextRound}>
                  <RefreshCcw className="mr-2 h-5 w-5" />
                  Próxima Rodada
                </Button>
              )}
              
              {/* Reiniciar */}
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
              
              {/* Botão de rever erros */}
              {isFlipMode && errorCount > 0 && (
                <Button variant="outline" size="lg" onClick={handleReviewErrors}>
                  <RefreshCcw className="mr-2 h-5 w-5" />
                  Rever errados
                </Button>
              )}
              
              {/* Botão "Voltar para Metas" */}
              {fromGoalId && (
                <Button 
                  variant="outline" 
                  size="lg" 
                  onClick={() => navigate('/goals')}
                >
                  ← Voltar para Metas
                </Button>
              )}
              
              {/* Botão voltar à lista */}
              <Button 
                variant="ghost" 
                size="lg" 
                onClick={handleExit}
              >
                Voltar à Lista
              </Button>
            </div>

            {/* Mobile: Secondary buttons only (main button is sticky) */}
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

        {/* Mobile: Sticky bottom button for completing session */}
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
    <div className="min-h-screen bg-background py-8 px-4 lg:px-8">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => setShowExitDialog(true)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
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
              
              {/* Direction selector for flip mode */}
              {effectiveMode === "flip" && (
                <Select value={flipDirection} onValueChange={handleDirectionChange}>
                  <SelectTrigger className="w-[110px] sm:w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-pt">{listSettings.labelsA} → {listSettings.labelsB}</SelectItem>
                    <SelectItem value="pt-en">{listSettings.labelsB} → {listSettings.labelsA}</SelectItem>
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
              front={currentCard.term}
              back={currentCard.translation}
              hint={currentCard.hint}
              flashcardId={currentCard.id}
              direction={resolvedDirection}
              fastMode={gameSettings.fastMode}
              ttsEnabled={listSettings.ttsEnabled}
              labelA={listSettings.labelsA}
              labelB={listSettings.labelsB}
              langA={listSettings.langA}
              langB={listSettings.langB}
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
              front={currentCard.term}
              back={currentCard.translation}
              hint={currentCard.hint}
              flashcardId={currentCard.id}
              acceptedAnswersEn={currentCard.accepted_answers_en || []}
              acceptedAnswersPt={currentCard.accepted_answers_pt || []}
              direction={resolvedDirection}
              onCorrect={() => handleNext(true)}
              onIncorrect={() => handleNext(false)}
              onSkip={() => handleNext(false, true)}
            />
          )}
          {effectiveMode === "multiple-choice" && currentCard && (
            <MultipleChoiceStudyView
              currentCard={currentCard}
              allCards={flashcards}
              direction={resolvedDirection}
              onCorrect={() => handleNext(true)}
              onIncorrect={() => handleNext(false)}
            />
          )}
          {effectiveMode === "unscramble" && currentCard && (
            <UnscrambleStudyView
              front={currentCard.term}
              back={currentCard.translation}
              hint={currentCard.hint}
              flashcardId={currentCard.id}
              direction={resolvedDirection}
              onCorrect={() => handleNext(true)}
              onIncorrect={() => handleNext(false)}
              onSkip={() => handleNext(false, true)}
            />
          )}
          {effectiveMode === "pronunciation" && currentCard && (
            <PronunciationStudyView
              front={currentCard.term}
              back={currentCard.translation}
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
    </div>
  );
};

export default Study;
