import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lightbulb, Eye, SkipForward, Volume2 } from "lucide-react";
import { isAcceptableAnswer, getHint } from "@/lib/textMatch";
import { getDiffTokens } from "@/lib/diffHighlighter";
import { speak, getVoiceForLang } from "@/lib/edgeTTS";
import { pickLang } from "@/lib/speech";

interface WriteStudyViewProps {
  front: string;
  back: string;
  acceptedAnswersEn?: string[];
  acceptedAnswersPt?: string[];
  direction: "pt-en" | "en-pt" | "any";
  onCorrect: () => void;
  onIncorrect: () => void;
  onSkip: () => void;
}

export const WriteStudyView = ({
  front,
  back,
  acceptedAnswersEn = [],
  acceptedAnswersPt = [],
  direction,
  onCorrect,
  onIncorrect,
  onSkip,
}: WriteStudyViewProps) => {
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [currentHint, setCurrentHint] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isPtToEn = direction === "pt-en" || (direction === "any" && Math.random() > 0.5);
  const prompt = isPtToEn ? front : back;
  const correctAnswer = isPtToEn ? back : front;
  const promptLabel = isPtToEn ? "Português" : "English";
  const answerLabel = isPtToEn ? "English" : "Português";
  const acceptedAnswers = [
    correctAnswer,
    ...(isPtToEn ? acceptedAnswersEn : acceptedAnswersPt),
  ];

  useEffect(() => {
    setAnswer("");
    setFeedback(null);
    setHintLevel(0);
    setCurrentHint("");
    setRevealed(false);
    inputRef.current?.focus();
  }, [front, back]);

  const handleSubmit = () => {
    if (!answer.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    const result = isAcceptableAnswer(answer, acceptedAnswers);

    if (result.isCorrect) {
      setFeedback("correct");
      // Auto-advance removed - user will click "Próximo"
    } else {
      setFeedback("incorrect");
    }
  };

  const handleHint = () => {
    if (hintLevel < 2) {
      const newLevel = hintLevel + 1;
      setHintLevel(newLevel);
      setCurrentHint(getHint(correctAnswer, newLevel));
    } else {
      setRevealed(true);
      setCurrentHint(correctAnswer);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !feedback) {
      handleSubmit();
    }
  };

  const diffTokens = feedback === "incorrect" ? getDiffTokens(answer, correctAnswer) : [];

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      <Card className="p-8 bg-gradient-to-br from-card to-muted/20">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">{promptLabel}</p>
          <div className="flex items-center justify-center gap-3 mb-8">
            <p className="text-3xl font-semibold">{prompt}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const lang = pickLang(direction, prompt);
                const voice = getVoiceForLang(lang);
                await speak(prompt, voice);
              }}
            >
              <Volume2 className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Traduza para {answerLabel}:</p>
        </div>
      </Card>

      {currentHint && (
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertDescription className="font-mono text-lg">
            {currentHint}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <Input
          ref={inputRef}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Digite sua resposta..."
          disabled={feedback !== null}
          className={`text-lg h-14 ${
            shake ? "animate-[shake_0.5s_ease-in-out]" : ""
          } ${
            feedback === "correct"
              ? "border-green-500 bg-green-50 dark:bg-green-950"
              : feedback === "incorrect"
              ? "border-red-500 bg-red-50 dark:bg-red-950"
              : ""
          }`}
        />

        {feedback === "correct" && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950 animate-fade-in">
            <AlertDescription className="text-green-700 dark:text-green-300">
              <div className="flex items-center gap-2 text-lg font-semibold mb-2">
                <span className="text-2xl">✓</span>
                Correto!
              </div>
              <span className="font-semibold">{correctAnswer}</span>
              {acceptedAnswers.length > 1 && (
                <>
                  <br />
                  <span className="text-sm">
                    Outras respostas: {acceptedAnswers.slice(1).join(", ")}
                  </span>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {feedback === "incorrect" && (
          <Alert className="border-red-500 bg-red-50 dark:bg-red-950 animate-fade-in">
            <AlertDescription className="text-red-700 dark:text-red-300">
              <div className="flex items-center gap-2 text-lg font-semibold mb-2">
                <span className="text-2xl">✗</span>
                Incorreto
              </div>
              Compare sua resposta com o gabarito:
              <br />
              <div className="mt-2 font-mono text-base">
                <div>
                  Você digitou:{" "}
                  {diffTokens.map((token, idx) => (
                    <span
                      key={idx}
                      className={
                        token.type === "insert"
                          ? "bg-red-200 dark:bg-red-900 line-through"
                          : ""
                      }
                    >
                      {token.text}
                    </span>
                  ))}
                </div>
                <div className="mt-1">
                  Correto: <span className="font-semibold">{correctAnswer}</span>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {feedback === null && (
        <div className="flex gap-3 flex-wrap">
          <Button variant="outline" onClick={onSkip}>
            <SkipForward className="mr-2 h-4 w-4" />
            Pular
          </Button>
          <Button variant="secondary" onClick={handleHint} disabled={revealed}>
            <Lightbulb className="mr-2 h-4 w-4" />
            Dica {hintLevel > 0 && `(${hintLevel}/3)`}
          </Button>
          {revealed && (
            <Button variant="ghost" disabled>
              <Eye className="mr-2 h-4 w-4" />
              Revelado
            </Button>
          )}
          <Button onClick={handleSubmit} className="ml-auto">
            Corrigir
          </Button>
        </div>
      )}

      {feedback === "correct" && (
        <div className="flex justify-end">
          <Button onClick={onCorrect} size="lg" className="bg-green-600 hover:bg-green-700">
            Próximo
          </Button>
        </div>
      )}

      {feedback === "incorrect" && (
        <div className="flex justify-end">
          <Button onClick={onIncorrect} variant="destructive" size="lg">
            Continuar
          </Button>
        </div>
      )}
    </div>
  );
};
