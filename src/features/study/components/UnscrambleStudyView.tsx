import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Volume2, RotateCcw, Check, Star } from "lucide-react";
import { useTTS } from "@/features/study/hooks/useTTS";
import { resolveStudySides, toBCP47 } from "@/features/study/lib/resolveStudySides";
import { InteractiveText } from "./InteractiveText";
import type { MergedHint } from "@/features/study/lib/glossaryMerge";
import { SpeechRateControl, getSpeechRate } from "./SpeechRateControl";
import { HintButton } from "./HintButton";
import { cn } from "@/lib/utils";
import { playCorrect, playWrong } from "@/lib/sfx";

interface UnscrambleStudyViewProps {
  front: string;
  back: string;
  hint?: string | null;
  flashcardId?: string;
  wordHintsA?: unknown;
  mergedHintsA?: MergedHint[];
  mergedHintsB?: MergedHint[];
  direction: string;
  langA?: string;
  langB?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
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

export const UnscrambleStudyView = ({ front, back, hint, flashcardId, wordHintsA, mergedHintsA, mergedHintsB, direction, langA = "en", langB = "pt", isFavorite = false, onToggleFavorite, onCorrect, onIncorrect, onSkip }: UnscrambleStudyViewProps) => {
  const [selectedWords, setSelectedWords] = useState<WordItem[]>([]);
  const [availableWords, setAvailableWords] = useState<WordItem[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const { speak } = useTTS();
  
  // --- Centralized Side Resolution ---
  const sideA = { text: front, lang: langA, label: "" };
  const sideB = { text: back, lang: langB, label: "" };

  const { promptSide, answerSide, isAFirst } = resolveStudySides(sideA, sideB, direction, flashcardId || front);

  // word_hints contain bindings for both sides; segmentText auto-filters by text match
  const promptWordHints = wordHintsA;
  const promptMergedHints = isAFirst ? mergedHintsA : mergedHintsB;

  const question = promptSide.text;
  const correctSentence = answerSide.text;

  const questionLang = toBCP47(promptSide.lang);

  useEffect(() => {
    // Remove palavras que contêm parênteses (são apenas notas/explicações)
    const cleanSentence = correctSentence.split(/\s+/)
      .filter(word => !word.includes("(") && !word.includes(")"))
      .join(" ");
    
    const words = cleanSentence.split(/\s+/);
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
    // Remove palavras que contêm parênteses (são apenas notas/explicações)
    const cleanSentence = correctSentence.split(/\s+/)
      .filter(word => !word.includes("(") && !word.includes(")"))
      .join(" ");
    
    const words = cleanSentence.split(/\s+/);
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
    // Remove palavras com parênteses da frase correta antes de comparar
    const cleanCorrectSentence = correctSentence.split(/\s+/)
      .filter(word => !word.includes("(") && !word.includes(")"))
      .join(" ");
    
    const userAnswer = selectedWords.map(item => item.word).join(" ").toLowerCase().trim();
    const correct = userAnswer === cleanCorrectSentence.toLowerCase().trim();
    setIsCorrect(correct);
    setSubmitted(true);
    
    // Play sound effect
    if (correct) {
      playCorrect();
    } else {
      playWrong();
    }
  };

  const handleNext = () => {
    if (isCorrect) {
      onCorrect();
    } else {
      onIncorrect();
    }
  };

  const handlePlayAudio = () => {
    const rate = getSpeechRate();
    speak(question, { langOverride: questionLang, rate });
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:gap-6 w-full max-w-2xl mx-auto px-2 sm:p-4">
      <Card className="w-full p-4 sm:p-6 bg-card relative">
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1 sm:gap-2">
          {onToggleFavorite && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleFavorite}
              className={cn(
                "h-8 w-8 sm:h-9 sm:w-9 transition-colors",
                isFavorite ? "text-yellow-500 hover:text-yellow-600" : "text-muted-foreground hover:text-yellow-500"
              )}
              title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            >
              <Star className={cn("h-4 w-4 sm:h-5 sm:w-5", isFavorite && "fill-current")} />
            </Button>
          )}
          <HintButton hint={hint} />
        </div>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="text-base sm:text-lg font-semibold">Organize as palavras:</h3>
          <div className="flex items-center gap-1">
            <SpeechRateControl />
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePlayAudio}
              className="shrink-0 h-8 w-8"
            >
              <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>
        <p className="text-xl sm:text-2xl font-bold text-center mb-4 sm:mb-6 break-words px-2">
          <InteractiveText text={question} wordHints={promptWordHints} mergedHints={promptMergedHints} speakOnHintClick speakLang={questionLang} />
        </p>
      </Card>

      {/* Selected words area */}
      <Card className="w-full min-h-[80px] sm:min-h-[120px] p-3 sm:p-6 bg-primary/5">
        <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center">
          {selectedWords.length === 0 ? (
            <p className="text-sm sm:text-base text-muted-foreground text-center">Clique nas palavras abaixo para montar a frase</p>
          ) : (
            selectedWords.map((item) => (
              <Button
                key={item.id}
                variant="default"
                onClick={() => handleWordClick(item, false)}
                disabled={submitted}
                className="text-sm sm:text-lg px-3 py-1.5 sm:px-4 sm:py-2 h-auto"
              >
                {item.word}
              </Button>
            ))
          )}
        </div>
      </Card>

      {/* Available words */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center w-full">
        {availableWords.map((item) => (
          <Button
            key={item.id}
            variant="outline"
            onClick={() => handleWordClick(item, true)}
            disabled={submitted}
            className="text-sm sm:text-lg px-3 py-1.5 sm:px-4 sm:py-2 h-auto"
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
              Resposta correta: <span className="font-semibold">
                {correctSentence.split(/\s+/).filter(word => !word.includes("(") && !word.includes(")")).join(" ")}
              </span>
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
