import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Volume2, RotateCcw, Check } from "lucide-react";
import { pickLang } from "@/lib/speech";
import { useTTS } from "@/hooks/useTTS";
import { SpeechRateControl } from "./SpeechRateControl";

interface UnscrambleStudyViewProps {
  front: string;
  back: string;
  direction: "pt-en" | "en-pt" | "any";
  onCorrect: () => void;
  onIncorrect: () => void;
  onSkip: () => void;
}

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

interface WordItem {
  word: string;
  id: string;
}

export const UnscrambleStudyView = ({ front, back, direction, onCorrect, onIncorrect, onSkip }: UnscrambleStudyViewProps) => {
  const [selectedWords, setSelectedWords] = useState<WordItem[]>([]);
  const [availableWords, setAvailableWords] = useState<WordItem[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const { speak } = useTTS();

  const question = direction === "pt-en" ? front : back;
  const correctSentence = direction === "pt-en" ? back : front;

  useEffect(() => {
    const words = correctSentence.split(/\s+/);
    const wordItems: WordItem[] = words.map((word, index) => ({
      word,
      id: `${word}-${index}-${Math.random()}`
    }));
    setAvailableWords(shuffleArray(wordItems));
    setSelectedWords([]);
    setSubmitted(false);
    setIsCorrect(false);
  }, [front, back, correctSentence]);

  const handleWordClick = (item: WordItem, fromAvailable: boolean) => {
    if (submitted) return;

    if (fromAvailable) {
      setAvailableWords((prev) => prev.filter((w) => w.id !== item.id));
      setSelectedWords((prev) => [...prev, item]);
    } else {
      setSelectedWords((prev) => prev.filter((w) => w.id !== item.id));
      setAvailableWords((prev) => [...prev, item]);
    }
  };

  const handleReset = () => {
    const words = correctSentence.split(/\s+/);
    const wordItems: WordItem[] = words.map((word, index) => ({
      word,
      id: `${word}-${index}-${Math.random()}`
    }));
    setAvailableWords(shuffleArray(wordItems));
    setSelectedWords([]);
    setSubmitted(false);
    setIsCorrect(false);
  };

  const handleSubmit = () => {
    const userAnswer = selectedWords.map(item => item.word).join(" ").toLowerCase().trim();
    const correct = userAnswer === correctSentence.toLowerCase().trim();
    setIsCorrect(correct);
    setSubmitted(true);
  };

  const handleNext = () => {
    if (isCorrect) {
      onCorrect();
    } else {
      onIncorrect();
    }
  };

  const handlePlayAudio = async () => {
    const lang = pickLang(direction, question);
    await speak(question, lang);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto p-4">
      <Card className="w-full p-6 bg-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Organize as palavras:</h3>
          <div className="flex items-center gap-2">
            <SpeechRateControl />
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePlayAudio}
              className="shrink-0"
            >
              <Volume2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
        <p className="text-2xl font-bold text-center mb-6">{question}</p>
      </Card>

      {/* Selected words area */}
      <Card className="w-full min-h-[120px] p-6 bg-primary/5">
        <div className="flex flex-wrap gap-2 justify-center">
          {selectedWords.length === 0 ? (
            <p className="text-muted-foreground">Clique nas palavras abaixo para montar a frase</p>
          ) : (
            selectedWords.map((item) => (
              <Button
                key={item.id}
                variant="default"
                onClick={() => handleWordClick(item, false)}
                disabled={submitted}
                className="text-lg px-4 py-2"
              >
                {item.word}
              </Button>
            ))
          )}
        </div>
      </Card>

      {/* Available words */}
      <div className="flex flex-wrap gap-2 justify-center w-full">
        {availableWords.map((item) => (
          <Button
            key={item.id}
            variant="outline"
            onClick={() => handleWordClick(item, true)}
            disabled={submitted}
            className="text-lg px-4 py-2"
          >
            {item.word}
          </Button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 w-full">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={submitted}
          className="flex-1"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reiniciar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={selectedWords.length === 0 || submitted}
          className="flex-1"
        >
          <Check className="w-4 h-4 mr-2" />
          Verificar
        </Button>
      </div>

      {/* Result feedback */}
      {submitted && (
        <Card className={`w-full p-6 ${isCorrect ? "bg-green-500/10 border-green-500" : "bg-red-500/10 border-red-500"}`}>
          <p className={`text-center text-lg font-semibold ${isCorrect ? "text-green-600" : "text-red-600"}`}>
            {isCorrect ? "✓ Correto!" : "✗ Incorreto"}
          </p>
          {!isCorrect && (
            <p className="text-center mt-2 text-muted-foreground">
              Resposta correta: <span className="font-semibold">{correctSentence}</span>
            </p>
          )}
          <div className="flex justify-center mt-4">
            <Button
              onClick={handleNext}
              size="lg"
              className={isCorrect ? "bg-green-600 hover:bg-green-700" : ""}
              variant={isCorrect ? "default" : "destructive"}
            >
              {isCorrect ? "Próximo" : "Continuar"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
