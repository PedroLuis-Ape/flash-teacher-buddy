import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Volume2, RotateCcw, Check } from "lucide-react";
import { useTTS } from "@/features/study/hooks/useTTS";
import { resolveStudySides, toBCP47 } from "@/features/study/lib/resolveStudySides";
import { InteractiveText } from "./InteractiveText";
import type { MergedHint } from "@/features/study/lib/glossaryMerge";
import { getRedListCardClass } from "./RedListIndicator";
import { getSpeechRate } from "./SpeechRateControl";
import { StudyToolsMenu } from "./StudyToolsMenu";
import { cn } from "@/lib/utils";
import { playCorrect, playWrong } from "@/lib/sfx";
import { useShortcutMap } from "@/hooks/useKeyboardShortcuts";
import { normalizeKey, isTypingTarget } from "@/features/study/lib/keyboardShortcuts";

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
  isRedListed?: boolean;
  onToggleFavorite?: () => void;
  onToggleRedList?: () => void;
  isSpecial?: boolean;
  onToggleSpecial?: () => void;
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

export const UnscrambleStudyView = ({ front, back, hint, flashcardId, wordHintsA, mergedHintsA, mergedHintsB, direction, langA = "en", langB = "pt", isFavorite = false, isRedListed = false, onToggleFavorite, onToggleRedList, isSpecial = false, onToggleSpecial, onCorrect, onIncorrect, onSkip }: UnscrambleStudyViewProps) => {
  const [selectedWords, setSelectedWords] = useState<WordItem[]>([]);
  const [availableWords, setAvailableWords] = useState<WordItem[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const { speak } = useTTS();
  const shortcuts = useShortcutMap();
  
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

  // Keyboard shortcuts for unscramble: confirm = submit/check, skip = skip card.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const k = normalizeKey(e.key);
      const confirmKey = normalizeKey(shortcuts.confirm);
      const skipKey = normalizeKey(shortcuts.skip);

      if (k === confirmKey && !submitted && selectedWords.length > 0) {
        e.preventDefault();
        handleSubmit();
        return;
      }
      if (k === skipKey && !submitted) {
        e.preventDefault();
        onSkip();
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, submitted, selectedWords.length, onSkip]);

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
      <Card className={cn("w-full p-4 sm:p-6 bg-card", getRedListCardClass(isRedListed))}>
        {/*
          Linha de controles do card: título à esquerda, ações em linha à direita.
          Os botões (favorito, dica, lista vermelha, velocidade, áudio) ficam todos
          no mesmo eixo horizontal para evitar sobreposição com o título/pergunta.
        */}
        <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4 flex-wrap">
          <h3 className="text-base sm:text-lg font-semibold">Organize as palavras:</h3>
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePlayAudio}
              className="shrink-0 h-8 w-8"
              title="Ouvir frase"
            >
              <Volume2 className="w-4 h-4" />
            </Button>
            <StudyToolsMenu
              hint={hint}
              isFavorite={isFavorite}
              onToggleFavorite={onToggleFavorite}
              isRedListed={isRedListed}
              onToggleRedList={onToggleRedList}
              isSpecial={isSpecial}
              onToggleSpecial={onToggleSpecial}
            />
          </div>
        </div>
        <p className="text-xl sm:text-2xl font-bold text-center mb-4 sm:mb-6 break-words px-2">
          <InteractiveText text={question} wordHints={promptWordHints} mergedHints={promptMergedHints} speakOnHintClick speakLang={questionLang} />
        </p>
      </Card>

      {/* Selected words area — answer zone */}
      <Card className="w-full min-h-[60px] sm:min-h-[80px] p-3 sm:p-4 bg-primary/5 border-2 border-dashed border-primary/20">
        <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center">
          {selectedWords.length === 0 ? (
            <p className="text-xs sm:text-sm text-muted-foreground text-center w-full">Toque nas palavras abaixo para montar a frase</p>
          ) : (
            selectedWords.map((item) => (
              <button
                key={item.id}
                onClick={() => handleWordClick(item, false)}
                disabled={submitted}
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5",
                  "text-xs sm:text-sm font-medium transition-colors",
                  "bg-primary text-primary-foreground shadow-sm",
                  !submitted && "hover:bg-primary/80 active:scale-95 cursor-pointer",
                  submitted && "opacity-70 cursor-default"
                )}
              >
                {item.word}
              </button>
            ))
          )}
        </div>
      </Card>

      {/* Available words — word bank */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center w-full">
        {availableWords.map((item) => (
          <button
            key={item.id}
            onClick={() => handleWordClick(item, true)}
            disabled={submitted}
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5",
              "text-xs sm:text-sm font-medium transition-colors",
              "bg-muted text-muted-foreground border border-border shadow-sm",
              !submitted && "hover:bg-accent hover:text-accent-foreground active:scale-95 cursor-pointer",
              submitted && "opacity-50 cursor-default"
            )}
          >
            {item.word}
          </button>
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
