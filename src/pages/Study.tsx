import { useState, useEffect } from "react";
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
import { FlipStudyView } from "@/components/FlipStudyView";
import { WriteStudyView } from "@/components/WriteStudyView";
import { useStudyEngine } from "@/hooks/useStudyEngine";
import { ArrowLeft, Trophy, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

interface Flashcard {
  id: string;
  front: string;
  back: string;
  accepted_answers_en?: string[];
  accepted_answers_pt?: string[];
}

const Study = () => {
  const { id, collectionId } = useParams();
  const resolvedId = (id as string) || (collectionId as string) || "";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "flip";
  const direction = (searchParams.get("direction") || searchParams.get("dir") || "any") as
    | "pt-en"
    | "en-pt"
    | "any";
  const order = searchParams.get("order") || "random";

  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [currentMode, setCurrentMode] = useState<"flip" | "write">(
    mode === "mixed" ? "flip" : (mode as "flip" | "write")
  );

  const {
    currentIndex,
    progress,
    correctCount,
    errorCount,
    skippedCount,
    results,
    isFinished,
    recordResult,
    goToNext,
    goToPrevious,
    saveSession,
  } = useStudyEngine(resolvedId, flashcards.length);

  useEffect(() => {
    loadFlashcards();
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

  const loadFlashcards = async () => {
    if (!resolvedId) return;

    setLoading(true);
    
    // Check if this is a list or collection
    const isListRoute = window.location.pathname.includes("/list/");
    const isPublicRoute = window.location.pathname.startsWith("/portal/collection/");
    
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

    const orderedData = order === "random" ? shuffleArray([...data]) : data;
    setFlashcards(orderedData);
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

    if (mode === "mixed") {
      setCurrentMode(Math.random() > 0.5 ? "flip" : "write");
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
    setShowExitDialog(false);
    const isPublic = window.location.pathname.startsWith("/portal/collection/");
    if (!isPublic) {
      saveSession(mode, direction);
    }
    setTimeout(() => {
      navigate(-1);
    }, 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];

  if (isFinished) {
    const duration = 60; // Simplified for now
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    return (
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="container mx-auto max-w-2xl">
          <Card className="p-8 text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Trophy className="h-10 w-10 text-primary" />
            </div>

            <h1 className="text-3xl font-bold">Sessão Concluída!</h1>

            <div className="grid grid-cols-3 gap-4 py-6">
              <div className="space-y-2">
                <div className="text-3xl font-bold text-green-600">{correctCount}</div>
                <div className="text-sm text-muted-foreground">Acertos</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-red-600">{errorCount}</div>
                <div className="text-sm text-muted-foreground">Erros</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-yellow-600">{skippedCount}</div>
                <div className="text-sm text-muted-foreground">Pulados</div>
              </div>
            </div>

            <div className="text-muted-foreground">
              Tempo: {minutes}m {seconds}s
            </div>

            {errorCount > 0 && (
              <Alert>
                <AlertDescription>
                  Você errou {errorCount} {errorCount === 1 ? "item" : "itens"}. Quer revisar?
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-4 justify-center pt-4">
              {errorCount > 0 && (
                <Button variant="secondary" size="lg" onClick={handleReviewErrors}>
                  <RefreshCcw className="mr-2 h-5 w-5" />
                  Rever apenas os errados
                </Button>
              )}
              <Button size="lg" onClick={() => navigate(-1)}>
                Voltar
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setShowExitDialog(true)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Sair
            </Button>

            <div className="flex gap-4 text-sm">
              <span className="text-green-600 font-medium">✓ {correctCount}</span>
              <span className="text-red-600 font-medium">✗ {errorCount}</span>
              <span className="text-yellow-600 font-medium">⊘ {skippedCount}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {currentIndex + 1} / {flashcards.length}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>
        </div>

        <div className="mb-6">
          {currentMode === "flip" ? (
            <FlipStudyView
              front={currentCard.front}
              back={currentCard.back}
              direction={direction}
              onKnew={() => handleNext(true)}
              onDidntKnow={() => handleNext(false)}
            />
          ) : (
            <WriteStudyView
              front={currentCard.front}
              back={currentCard.back}
              acceptedAnswersEn={currentCard.accepted_answers_en || []}
              acceptedAnswersPt={currentCard.accepted_answers_pt || []}
              direction={direction}
              onCorrect={() => handleNext(true)}
              onIncorrect={() => handleNext(false)}
              onSkip={() => handleNext(false, true)}
            />
          )}
        </div>

        {currentIndex > 0 && (
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
            <AlertDialogAction onClick={handleExit}>Sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Study;
