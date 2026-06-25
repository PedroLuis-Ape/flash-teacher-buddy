import { useEffect, useState } from "react";
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
import { StudyFeedbackPanel } from "./StudyFeedbackPanel";
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
  onRestartRound?: () => void;
  onRestartJourney?: () => void;
  onCorrect: () => void;
  onIncorrect: () => void;
  onSkip: () => void;
}

interface WordItem {
  word: string;
  id: string;
}

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
};

const cleanSentence = (sentence: string) => sentence
  .split(/\s+/)
  .filter((word) => !word.includes("(") && !word.includes(")"))
  .join(" ");

const createWordItems = (sentence: string): WordItem[] => cleanSentence(sentence)
  .split(/\s+/)
  .map((word, index) => ({ word, id: `${word}-${index}-${Math.random()}` }));

export const UnscrambleStudyView = ({
  front,
  back,
  hint,
  flashcardId,
  wordHintsA,
  mergedHintsA,
  mergedHintsB,
  direction,
  langA = "en",
  langB = "pt",
  isFavorite = false,
  isRedListed = false,
  onToggleFavorite,
  onToggleRedList,
  isSpecial = false,
  onToggleSpecial,
  onRestartRound,
  onRestartJourney,
  onCorrect,
  onIncorrect,
  onSkip,
}: UnscrambleStudyViewProps) => {
  const [selectedWords, setSelectedWords] = useState<WordItem[]>([]);
  const [availableWords, setAvailableWords] = useState<WordItem[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const { speak } = useTTS();
  const shortcuts = useShortcutMap();

  const sideA = { text: front, lang: langA, label: "" };
  const sideB = { text: back, lang: langB, label: "" };
  const { promptSide, answerSide, isAFirst } = resolveStudySides(sideA, sideB, direction, flashcardId || front);
  const promptWordHints = wordHintsA;
  const promptMergedHints = isAFirst ? mergedHintsA : mergedHintsB;
  const question = promptSide.text;
  const correctSentence = answerSide.text;
  const normalizedCorrectSentence = cleanSentence(correctSentence);
  const questionLang = toBCP47(promptSide.lang);
  const userSentence = selectedWords.map((item) => item.word).join(" ");
  const sentenceWordCount = normalizedCorrectSentence.split(/\s+/).filter(Boolean).length;
  const questionLength = question.trim().length;
  const questionSizeClass = questionLength <= 32
    ? "text-[clamp(1.5rem,7vw,2rem)]"
    : questionLength <= 76
      ? "text-[clamp(1.28rem,5.8vw,1.75rem)]"
      : "text-[clamp(1.08rem,4.7vw,1.45rem)]";
  const chipSizeClass = sentenceWordCount > 10
    ? "px-2.5 py-1.5 text-[0.8125rem]"
    : "px-3.5 py-2 text-sm";

  const resetExercise = () => {
    setAvailableWords(shuffleArray(createWordItems(correctSentence)));
    setSelectedWords([]);
    setSubmitted(false);
    setIsCorrect(false);
  };

  useEffect(() => {
    resetExercise();
  }, [front, back, correctSentence]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const key = normalizeKey(event.key);
      const confirmKey = normalizeKey(shortcuts.confirm);
      const skipKey = normalizeKey(shortcuts.skip);
      const nextKey = normalizeKey(shortcuts.nextCard);

      if (submitted && key === nextKey) {
        event.preventDefault();
        if (isCorrect) onCorrect();
        else onIncorrect();
        return;
      }
      if (key === confirmKey && !submitted && selectedWords.length > 0) {
        event.preventDefault();
        handleSubmit();
        return;
      }
      if (key === skipKey && !submitted) {
        event.preventDefault();
        onSkip();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, submitted, selectedWords.length, isCorrect, onCorrect, onIncorrect, onSkip]);

  const handleWordClick = (item: WordItem, fromAvailable: boolean) => {
    if (submitted) return;
    if (fromAvailable) {
      setAvailableWords((previous) => previous.filter((word) => word.id !== item.id));
      setSelectedWords((previous) => [...previous, item]);
    } else {
      setSelectedWords((previous) => previous.filter((word) => word.id !== item.id));
      setAvailableWords((previous) => [...previous, item]);
    }
  };

  const handleSubmit = () => {
    const correct = userSentence.toLowerCase().trim() === normalizedCorrectSentence.toLowerCase().trim();
    setIsCorrect(correct);
    setSubmitted(true);
    if (correct) playCorrect();
    else playWrong();
  };

  const handleNext = () => {
    if (isCorrect) onCorrect();
    else onIncorrect();
  };

  const handlePlayAudio = () => {
    const rate = getSpeechRate();
    speak(question, { langOverride: questionLang, rate });
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-1 sm:gap-6 sm:p-4">
      <Card className={cn("relative flex min-h-[150px] w-full flex-col justify-center bg-card p-5 sm:min-h-0 sm:p-6", getRedListCardClass(isRedListed))}>
        <div className="absolute right-2 top-2 z-10" onClick={(event) => event.stopPropagation()}>
          <StudyToolsMenu
            hint={hint}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            isRedListed={isRedListed}
            onToggleRedList={onToggleRedList}
            isSpecial={isSpecial}
            onToggleSpecial={onToggleSpecial}
            onRestartRound={onRestartRound}
            onRestartJourney={onRestartJourney}
          />
        </div>
        <p className="mb-4 pr-20 text-[11px] uppercase tracking-wide text-muted-foreground sm:mb-3 sm:text-xs">Organize as palavras</p>
        <div className="flex items-start justify-center gap-2">
          <p className={cn("flex-1 break-words px-1 text-center font-bold leading-tight [text-wrap:balance] sm:text-2xl", questionSizeClass)}>
            <InteractiveText text={question} wordHints={promptWordHints} mergedHints={promptMergedHints} speakOnHintClick speakLang={questionLang} />
          </p>
          <Button variant="ghost" size="icon" onClick={handlePlayAudio} className="mt-0.5 h-10 w-10 shrink-0 text-primary hover:text-primary/80" title="Ouvir frase">
            <Volume2 className="h-5 w-5" />
          </Button>
        </div>
      </Card>

      <Card className="flex min-h-[96px] w-full items-center justify-center border-2 border-dashed border-primary/20 bg-primary/5 p-4 sm:min-h-[88px] sm:p-4">
        <div className="flex w-full flex-wrap items-center justify-center gap-2">
          {selectedWords.length === 0 ? (
            <p className="w-full px-4 text-center text-sm leading-relaxed text-muted-foreground">Toque nas palavras abaixo para montar a frase</p>
          ) : selectedWords.map((item) => (
            <button
              key={item.id}
              onClick={() => handleWordClick(item, false)}
              disabled={submitted}
              className={cn(
                "inline-flex min-h-9 max-w-full items-center justify-center whitespace-normal break-words rounded-full bg-primary text-center font-medium leading-tight text-primary-foreground shadow-sm transition-colors sm:px-3 sm:py-1.5 sm:text-sm",
                chipSizeClass,
                !submitted && "cursor-pointer hover:bg-primary/80 active:scale-95",
                submitted && "cursor-default opacity-70",
              )}
            >
              {item.word}
            </button>
          ))}
        </div>
      </Card>

      <div className="flex min-h-[56px] w-full flex-wrap items-center justify-center gap-2 px-1">
        {availableWords.map((item) => (
          <button
            key={item.id}
            onClick={() => handleWordClick(item, true)}
            disabled={submitted}
            className={cn(
              "inline-flex min-h-9 max-w-full items-center justify-center whitespace-normal break-words rounded-full border border-border bg-muted text-center font-medium leading-tight text-foreground shadow-sm transition-colors sm:px-3 sm:py-1.5 sm:text-sm",
              chipSizeClass,
              !submitted && "cursor-pointer hover:bg-accent hover:text-accent-foreground active:scale-95",
              submitted && "cursor-default opacity-50",
            )}
          >
            {item.word}
          </button>
        ))}
      </div>

      {!submitted && (
        <div className="flex w-full gap-3">
          <Button variant="outline" onClick={resetExercise} className="min-h-12 flex-1 text-sm">
            <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar
          </Button>
          <Button onClick={handleSubmit} disabled={selectedWords.length === 0} className="min-h-12 flex-1 text-sm font-semibold">
            <Check className="mr-2 h-4 w-4" /> Verificar
          </Button>
        </div>
      )}

      {submitted && (
        <StudyFeedbackPanel
          status={isCorrect ? "correct" : "incorrect"}
          title={isCorrect ? "Muito bem!" : undefined}
          message={isCorrect ? "Você colocou todas as palavras na ordem correta." : "Confira a ordem da frase antes de continuar."}
          userAnswer={isCorrect ? null : userSentence}
          correctAnswer={normalizedCorrectSentence}
          actionLabel={isCorrect ? "Próximo card" : "Continuar"}
          onAction={handleNext}
        />
      )}
    </div>
  );
};
