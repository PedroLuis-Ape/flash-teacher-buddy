import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRight, Volume2 } from "lucide-react";
import { useTTS } from "@/features/study/hooks/useTTS";
import { resolveStudySides, toBCP47, getLangLabel } from "@/features/study/lib/resolveStudySides";
import { InteractiveText } from "./InteractiveText";
import type { MergedHint } from "@/features/study/lib/glossaryMerge";
import { getRedListCardClass } from "./RedListIndicator";
import pitecoSad from "@/assets/piteco-sad.png";
import pitecoHappy from "@/assets/piteco-happy.png";
import { getSpeechRate } from "./SpeechRateControl";
import { StudyToolsMenu } from "./StudyToolsMenu";
import { cn } from "@/lib/utils";
import { playCorrect, playWrong } from "@/lib/sfx";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { pickSmartDistractors } from "@/features/study/lib/smartDistractors";
import { useShortcutMap } from "@/hooks/useKeyboardShortcuts";
import { normalizeKey, isTypingTarget } from "@/features/study/lib/keyboardShortcuts";

const AUTO_ADVANCE_DELAY_MS = 3500;

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
  const [secondsRemaining, setSecondsRemaining] = useState(
    Math.ceil(AUTO_ADVANCE_DELAY_MS / 1000),
  );
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingAdvanceRef = useRef<(() => void) | null>(null);
  const { speak } = useTTS();
  const shortcuts = useShortcutMap();
  
  // --- Centralized Side Resolution ---
  const sideA = { text: currentCard.term, lang: langA, label: getLangLabel(langA) };
  const sideB = { text: currentCard.translation, lang: langB, label: getLangLabel(langB) };

  const { promptSide, answerSide, isAFirst } = resolveStudySides(sideA, sideB, direction, currentCard.id || currentCard.term);

  // word_hints contain bindings for both sides; segmentText auto-filters by text match
  const promptWordHints = currentCard.word_hints;
  const promptMergedHints = isAFirst ? mergedHintsA : mergedHintsB;

  const prompt = promptSide.text;
  const correctAnswer = answerSide.text;
  const promptLabel = promptSide.label;
  const answerLabel = answerSide.label;

  const promptLang = toBCP47(promptSide.lang);

  const clearAutoAdvance = useCallback(() => {
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    pendingAdvanceRef.current = null;
  }, []);

  const runPendingAdvance = useCallback(() => {
    const pendingAdvance = pendingAdvanceRef.current;
    clearAutoAdvance();
    pendingAdvance?.();
  }, [clearAutoAdvance]);

  const scheduleAutoAdvance = useCallback((advance: () => void) => {
    clearAutoAdvance();
    pendingAdvanceRef.current = advance;

    const startedAt = Date.now();
    setSecondsRemaining(Math.ceil(AUTO_ADVANCE_DELAY_MS / 1000));

    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, AUTO_ADVANCE_DELAY_MS - elapsed);
      setSecondsRemaining(Math.ceil(remaining / 1000));
    }, 250);

    autoAdvanceTimeoutRef.current = setTimeout(
      runPendingAdvance,
      AUTO_ADVANCE_DELAY_MS,
    );
  }, [clearAutoAdvance, runPendingAdvance]);

  useEffect(() => {
    // Gerar 3 alternativas incorretas
    // isAFirst means sideA (term) is the prompt, so answer comes from sideB (translation)
    const wrongOptions = allCards
      .filter(card =>
        isAFirst
          ? card.translation !== currentCard.translation
          : card.term !== currentCard.term
      )
      .map(card => isAFirst ? card.translation : card.term);

    // V2: similarity-based selection (Levenshtein) — fallback to random when off
    let shuffledWrong: string[];
    if (FEATURE_FLAGS.intelligent_study_engine) {
      shuffledWrong = pickSmartDistractors(correctAnswer, wrongOptions, 3);
      // Top up with random picks if scoring returned fewer than 3
      if (shuffledWrong.length < 3) {
        const used = new Set(shuffledWrong);
        const fillers = wrongOptions.filter(o => !used.has(o)).sort(() => Math.random() - 0.5);
        shuffledWrong = [...shuffledWrong, ...fillers].slice(0, 3);
      }
    } else {
      shuffledWrong = wrongOptions.sort(() => Math.random() - 0.5).slice(0, 3);
    }

    // Adicionar a resposta correta
    const allOptions = [...shuffledWrong, correctAnswer];

    // Embaralhar todas as opções
    const shuffled = allOptions.sort(() => Math.random() - 0.5);
    
    clearAutoAdvance();
    setOptions(shuffled);
    setCorrectIndex(shuffled.indexOf(correctAnswer));
    setSelectedOption(null);
    setShowFeedback(false);
    setSecondsRemaining(Math.ceil(AUTO_ADVANCE_DELAY_MS / 1000));
  }, [currentCard, allCards, isAFirst, correctAnswer, clearAutoAdvance]);

  useEffect(() => {
    return () => clearAutoAdvance();
  }, [clearAutoAdvance]);

  const handleOptionClick = useCallback((index: number) => {
    if (showFeedback) return;

    setSelectedOption(index);
    setShowFeedback(true);

    if (index === correctIndex) {
      playCorrect();
      scheduleAutoAdvance(onCorrect);
    } else {
      playWrong();
      scheduleAutoAdvance(onIncorrect);
    }
  }, [showFeedback, correctIndex, scheduleAutoAdvance, onCorrect, onIncorrect]);

  // Keyboard shortcuts for multiple choice: 1-4 or A-D selects the option.
  // While feedback is visible, the configured next-card key skips the wait.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const k = normalizeKey(e.key);

      if (showFeedback) {
        const nextKey = normalizeKey(shortcuts.nextCard);
        if (k === nextKey) {
          e.preventDefault();
          runPendingAdvance();
        }
        return;
      }

      let index: number | null = null;
      if (k === "1" || k === "A") index = 0;
      else if (k === "2" || k === "B") index = 1;
      else if (k === "3" || k === "C") index = 2;
      else if (k === "4" || k === "D") index = 3;
      if (index !== null && index < options.length) {
        e.preventDefault();
        handleOptionClick(index);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showFeedback, options.length, shortcuts, handleOptionClick, runPendingAdvance]);

  const getOptionClassName = (index: number) => {
    if (!showFeedback) {
      return "hover:bg-accent/50 cursor-pointer transition-colors";
    }

    if (index === correctIndex) {
      return "bg-green-100 dark:bg-green-950 border-green-500 border-2";
    }

    if (index === selectedOption && index !== correctIndex) {
      return "bg-red-100 dark:bg-red-950 border-red-500 border-2";
    }

    return "opacity-50";
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full max-w-2xl mx-auto">
      <Card className={cn("p-4 sm:p-8 bg-gradient-to-br from-card to-muted/20 relative", getRedListCardClass(isRedListed))}>
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1 sm:gap-2">
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
          <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">{promptLabel}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-8">
            <p className="text-xl sm:text-3xl font-semibold break-words max-w-full px-2">
              <InteractiveText text={prompt} wordHints={promptWordHints} mergedHints={promptMergedHints} speakOnHintClick speakLang={promptLang} />
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0 h-8 w-8 p-0"
                onClick={() => {
                  const rate = getSpeechRate();
                  speak(prompt, { langOverride: promptLang, rate });
                }}
              >
                <Volume2 className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground break-words px-2">Escolha a tradução em {answerLabel}:</p>
        </div>
      </Card>

      <div className="grid gap-2 sm:gap-3">
        {options.map((option, index) => (
          <Card
            key={index}
            className={`p-3 sm:p-6 cursor-pointer transition-all ${getOptionClassName(index)}`}
            onClick={() => handleOptionClick(index)}
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-sm sm:text-base">
                {String.fromCharCode(65 + index)}
              </div>
              <p className="text-base sm:text-lg font-medium">{option}</p>
            </div>
          </Card>
        ))}
      </div>

      {showFeedback && selectedOption === correctIndex && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950 animate-fade-in">
          <AlertDescription className="text-green-700 dark:text-green-300">
            <div className="flex items-start gap-4">
              <img 
                src={pitecoHappy} 
                alt="Piteco feliz" 
                className="w-16 h-16 object-contain flex-shrink-0"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-lg font-semibold mb-2">
                  <span className="text-2xl">✓</span>
                  Correto!
                </div>
                <span className="font-semibold">{correctAnswer}</span> é a tradução certa!
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {showFeedback && selectedOption !== correctIndex && (
        <Alert className="border-red-500 bg-red-50 dark:bg-red-950 animate-fade-in">
          <AlertDescription className="text-red-700 dark:text-red-300">
            <div className="flex items-start gap-4">
              <img 
                src={pitecoSad} 
                alt="Piteco triste" 
                className="w-16 h-16 object-contain flex-shrink-0"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-lg font-semibold mb-2">
                  <span className="text-2xl">✗</span>
                  Incorreto
                </div>
                A resposta correta é: <span className="font-semibold">{correctAnswer}</span>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {showFeedback && (
        <div className="flex flex-col items-center gap-2 animate-fade-in">
          <Button onClick={runPendingAdvance} size="lg" className="min-w-[190px]">
            Próximo agora
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Próximo card automaticamente em {secondsRemaining}s
          </p>
        </div>
      )}
    </div>
  );
};
