import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";

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

  const handleSubmit = () => {
    const userAnswer = answer.trim().toLowerCase();
    const correct = userAnswer === correctAnswer.toLowerCase();

    setIsCorrect(correct);
    setShowResult(true);

    if (correct) {
      setScore(score + 1);
      toast.success("Correto! 🎉");
    } else {
      toast.error(`Errado! A resposta era: ${correctAnswer}`);
    }
  };

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setAnswer("");
      setShowResult(false);
    } else {
      const percentage = Math.round((score / flashcards.length) * 100);
      toast.success(`Prática finalizada! Pontuação: ${score}/${flashcards.length} (${percentage}%)`);
      onExit();
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
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

      <Card className="p-8 bg-gradient-to-br from-card to-muted/10 shadow-[var(--shadow-card)]">
        <div className="text-center mb-6">
          <p className="text-sm text-muted-foreground mb-2">
            {mode === "write_pt_en" ? "Traduza para inglês" : "Traduza para português"}
          </p>
          <h2 className="text-3xl font-bold">{question}</h2>
        </div>

        {!showResult ? (
          <div className="space-y-4">
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Digite a tradução..."
              onKeyPress={(e) => e.key === "Enter" && answer && handleSubmit()}
              autoFocus
              className="text-lg text-center"
            />
            <Button
              onClick={handleSubmit}
              className="w-full"
              size="lg"
              disabled={!answer.trim()}
            >
              Verificar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-lg ${
                isCorrect ? "bg-green-100 dark:bg-green-900/20" : "bg-red-100 dark:bg-red-900/20"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {isCorrect ? (
                  <>
                    <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      Correto!
                    </span>
                  </>
                ) : (
                  <>
                    <X className="h-5 w-5 text-red-600 dark:text-red-400" />
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      Incorreto
                    </span>
                  </>
                )}
              </div>
              {!isCorrect && (
                <p className="text-sm">
                  Sua resposta: <span className="font-mono">{answer}</span>
                  <br />
                  Resposta correta: <span className="font-mono">{correctAnswer}</span>
                </p>
              )}
            </div>
            <Button onClick={handleNext} className="w-full" size="lg">
              {currentIndex < flashcards.length - 1 ? "Próximo" : "Finalizar"}
            </Button>
          </div>
        )}
      </Card>

      <p className="text-center text-muted-foreground mt-4">
        Pergunta {currentIndex + 1} de {flashcards.length}
      </p>
    </div>
  );
};
