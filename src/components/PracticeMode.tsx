import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { StudyFeedbackPanel } from "@/features/study/components/StudyFeedbackPanel";

interface Flashcard {
  id: string;
  term: string;
  translation: string;
}

interface PracticeModeProps {
  flashcards: Flashcard[];
  mode: "write_pt_en" | "write_en_pt";
  onExit: () => void;
}

export const PracticeMode = ({ flashcards, mode, onExit }: PracticeModeProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const currentCard = flashcards[currentIndex];
  const progress = ((currentIndex + 1) / flashcards.length) * 100;
  const question = mode === "write_pt_en" ? currentCard.term : currentCard.translation;
  const correctAnswer = mode === "write_pt_en" ? currentCard.translation : currentCard.term;

  useEffect(() => {
    if (!showResult) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      handleNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showResult, currentIndex, score]);

  const handleSubmit = () => {
    const userAnswer = answer.trim().toLowerCase();
    const correct = userAnswer === correctAnswer.toLowerCase();

    setIsCorrect(correct);
    setShowResult(true);

    if (correct) {
      setScore((previous) => previous + 1);
      toast.success("Correto! 🎉");
    }
  };

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex((previous) => previous + 1);
      setAnswer("");
      setShowResult(false);
      return;
    }

    const finalScore = score + (isCorrect ? 0 : 0);
    const percentage = Math.round((finalScore / flashcards.length) * 100);
    toast.success(`Prática finalizada! Pontuação: ${finalScore}/${flashcards.length} (${percentage}%)`);
    onExit();
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" onClick={onExit}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">
            Pontuação: {score}/{currentIndex + (showResult ? 1 : 0)}
          </p>
        </div>
      </div>

      <Progress value={progress} className="mb-6" />

      <Card className="bg-gradient-to-br from-card to-muted/10 p-5 shadow-[var(--shadow-card)] sm:p-8">
        <div className="mb-6 text-center">
          <p className="mb-2 text-sm text-muted-foreground">
            {mode === "write_pt_en" ? "Traduza para inglês" : "Traduza para português"}
          </p>
          <h2 className="text-2xl font-bold sm:text-3xl">{question}</h2>
        </div>

        {!showResult ? (
          <div className="space-y-4">
            <Input
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Digite a tradução..."
              onKeyDown={(event) => event.key === "Enter" && answer.trim() && handleSubmit()}
              autoFocus
              className="text-center text-lg"
            />
            <Button onClick={handleSubmit} className="w-full" size="lg" disabled={!answer.trim()}>
              Verificar
            </Button>
          </div>
        ) : (
          <StudyFeedbackPanel
            status={isCorrect ? "correct" : "incorrect"}
            title={isCorrect ? "Muito bem!" : undefined}
            message={isCorrect ? "Sua tradução está correta." : "Compare sua resposta com a tradução esperada."}
            userAnswer={isCorrect ? null : answer}
            correctAnswer={correctAnswer}
            actionLabel={currentIndex < flashcards.length - 1 ? "Próximo card" : "Finalizar"}
            onAction={handleNext}
          />
        )}
      </Card>

      <p className="mt-4 text-center text-muted-foreground">
        Pergunta {currentIndex + 1} de {flashcards.length}
      </p>
    </div>
  );
};
