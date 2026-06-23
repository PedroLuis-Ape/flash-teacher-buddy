import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react";
import { useTTS } from "@/features/study/hooks/useTTS";
import { resolveStudySides, toBCP47, getLangLabel } from "@/features/study/lib/resolveStudySides";
import { InteractiveText } from "./InteractiveText";
import type { MergedHint } from "@/features/study/lib/glossaryMerge";
import { getRedListCardClass } from "./RedListIndicator";
import { getSpeechRate } from "./SpeechRateControl";
import { StudyToolsMenu } from "./StudyToolsMenu";
import { StudyFeedbackPanel } from "./StudyFeedbackPanel";
import { cn } from "@/lib/utils";
import { playCorrect, playWrong } from "@/lib/sfx";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { pickSmartDistractors } from "@/features/study/lib/smartDistractors";
import { useShortcutMap } from "@/hooks/useKeyboardShortcuts";
import { normalizeKey, isTypingTarget } from "@/features/study/lib/keyboardShortcuts";

interface MultipleChoiceStudyViewProps {
  currentCard: {
    id?: string;
    term: string;
    translation: string;
    hint?: string | null;
    word_hints?: unknown;
  };
  allCards: {
    term: string;
    translation: string;
  }[];
  direction: string;
  langA?: string;
  langB?: string;
  mergedHintsA?: MergedHint[];
  mergedHintsB?: MergedHint[];
  isFavorite?: boolean;
  isRedListed?: boolean;
  onToggleFavorite?: () => void;
  onToggleRedList?: () => void;
  isSpecial?: boolean;
  onToggleSpecial?: () => void;
  onCorrect: () => void;
  onIncorrect: () => void;
}

export const MultipleChoiceStudyView = ({
  currentCard,
  allCards,
  direction,
  langA = "en",
  langB = "pt",
  mergedHintsA,
  mergedHintsB,
  isFavorite = false,
  isRedListed = false,
  onToggleFavorite,
  onToggleRedList,
  isSpecial = false,
  onToggleSpecial,
  onCorrect,
  onIncorrect,
}: MultipleChoiceStudyViewProps) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const { speak } = useTTS();
  const shortcuts = useShortcutMap();

  const sideA = { text: currentCard.term, lang: langA, label: getLangLabel(langA) };
  const sideB = { text: currentCard.translation, lang: langB, label: getLangLabel(langB) };
  const { promptSide, answerSide, isAFirst } = resolveStudySides(sideA, sideB, direction, currentCard.id || currentCard.term);

  const promptWordHints = currentCard.word_hints;
  const promptMergedHints = isAFirst ? mergedHintsA : mergedHintsB;
  const prompt = promptSide.text;
  const correctAnswer = answerSide.text;
  const promptLabel = promptSide.label;
  const answerLabel = answerSide.label;
  const promptLang = toBCP47(promptSide.lang);

  useEffect(() => {
    const wrongOptions = allCards
      .filter((card) => isAFirst ? card.translation !== currentCard.translation : card.term !== currentCard.term)
      .map((card) => isAFirst ? card.translation : card.term);

    let shuffledWrong: string[];
    if (FEATURE_FLAGS.intelligent_study_engine) {
      shuffledWrong = pickSmartDistractors(correctAnswer, wrongOptions, 3);
      if (shuffledWrong.length < 3) {
        const used = new Set(shuffledWrong);
        const fillers = wrongOptions.filter((option) => !used.has(option)).sort(() => Math.random() - 0.5);
        shuffledWrong = [...shuffledWrong, ...fillers].slice(0, 3);
      }
    } else {
      shuffledWrong = wrongOptions.sort(() => Math.random() - 0.5).slice(0, 3);
    }

    const shuffled = [...shuffledWrong, correctAnswer].sort(() => Math.random() - 0.5);
    setOptions(shuffled);
    setCorrectIndex(shuffled.indexOf(correctAnswer));
    setSelectedOption(null);
    setShowFeedback(false);
  }, [currentCard, allCards, isAFirst, correctAnswer]);

  const handleOptionClick = useCallback((index: number) => {
    if (showFeedback) return;
    setSelectedOption(index);
    setShowFeedback(true);
    if (index === correctIndex) playCorrect();
    else playWrong();
  }, [showFeedback, correctIndex]);

  const advanceSelected = useCallback(() => {
    if (!showFeedback || selectedOption === null) return;
    if (selectedOption === correctIndex) onCorrect();
    else onIncorrect();
  }, [showFeedback, selectedOption, correctIndex, onCorrect, onIncorrect]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const key = normalizeKey(event.key);

      if (showFeedback) {
        const nextKey = normalizeKey(shortcuts.nextCard);
        if (key === nextKey) {
          event.preventDefault();
          advanceSelected();
        }
        return;
      }

      let index: number | null = null;
      if (key === "1" || key === "A") index = 0;
      else if (key === "2" || key === "B") index = 1;
      else if (key === "3" || key === "C") index = 2;
      else if (key === "4" || key === "D") index = 3;

      if (index !== null && index < options.length) {
        event.preventDefault();
        handleOptionClick(index);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showFeedback, options.length, shortcuts, handleOptionClick, advanceSelected]);

  const getOptionClassName = (index: number) => {
    if (!showFeedback) return "hover:bg-accent/50 cursor-pointer transition-colors";
    if (index === correctIndex) return "bg-emerald-500/10 border-emerald-500 border-2";
    if (index === selectedOption && index !== correctIndex) return "bg-destructive/10 border-destructive border-2";
    return "opacity-50";
  };

  const selectedAnswer = selectedOption === null ? null : options[selectedOption];
  const isCorrect = showFeedback && selectedOption === correctIndex;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 sm:gap-6">
      <Card className={cn("relative bg-gradient-to-br from-card to-muted/20 p-4 sm:p-8", getRedListCardClass(isRedListed))}>
        <div className="absolute right-3 top-3 flex items-center gap-1 sm:right-4 sm:top-4 sm:gap-2">
          <StudyToolsMenu
            hint={currentCard.hint}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            isRedListed={isRedListed}
            onToggleRedList={onToggleRedList}
            isSpecial={isSpecial}
            onToggleSpecial={onToggleSpecial}
          />
        </div>

        <div className="text-center">
          <p className="mb-3 text-xs text-muted-foreground sm:mb-4 sm:text-sm">{promptLabel}</p>
          <div className="mb-4 flex flex-col items-center justify-center gap-2 sm:mb-8 sm:flex-row sm:gap-3">
            <p className="max-w-full break-words px-2 text-xl font-semibold sm:text-3xl">
              <InteractiveText
                text={prompt}
                wordHints={promptWordHints}
                mergedHints={promptMergedHints}
                speakOnHintClick
                speakLang={promptLang}
              />
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 shrink-0 p-0"
              onClick={() => {
                const rate = getSpeechRate();
                speak(prompt, { langOverride: promptLang, rate });
              }}
            >
              <Volume2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
          <p className="break-words px-2 text-xs text-muted-foreground sm:text-sm">Escolha a tradução em {answerLabel}:</p>
        </div>
      </Card>

      <div className="grid gap-2 sm:gap-3">
        {options.map((option, index) => (
          <Card
            key={`${option}-${index}`}
            className={`cursor-pointer p-3 transition-all sm:p-6 ${getOptionClassName(index)}`}
            onClick={() => handleOptionClick(index)}
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold sm:h-8 sm:w-8 sm:text-base">
                {String.fromCharCode(65 + index)}
              </div>
              <p className="text-base font-medium sm:text-lg">{option}</p>
            </div>
          </Card>
        ))}
      </div>

      {showFeedback && (
        <StudyFeedbackPanel
          status={isCorrect ? "correct" : "incorrect"}
          title={isCorrect ? "Muito bem!" : undefined}
          message={isCorrect ? "Você escolheu a tradução certa." : "Compare sua escolha com a resposta correta."}
          userAnswer={isCorrect ? null : selectedAnswer}
          correctAnswer={correctAnswer}
          actionLabel="Próximo card"
          onAction={advanceSelected}
        />
      )}
    </div>
  );
};
