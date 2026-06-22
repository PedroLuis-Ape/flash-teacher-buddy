import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lightbulb, SkipForward, Volume2 } from "lucide-react";
import { isAcceptableAnswer, getHint } from "@/lib/textMatch";
import { useTTS } from "@/features/study/hooks/useTTS";
import { resolveStudySides, toBCP47, getLangLabel } from "@/features/study/lib/resolveStudySides";
import { InteractiveText } from "./InteractiveText";
import type { MergedHint } from "@/features/study/lib/glossaryMerge";
import { getRedListCardClass } from "./RedListIndicator";
import { isAlmostCorrect } from "@/lib/levenshtein";
import { getSpeechRate } from "./SpeechRateControl";
import { StudyToolsMenu } from "./StudyToolsMenu";
import { StudyFeedbackPanel } from "./StudyFeedbackPanel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { playCorrect, playWrong } from "@/lib/sfx";
import { useShortcutMap } from "@/hooks/useKeyboardShortcuts";
import { normalizeKey } from "@/features/study/lib/keyboardShortcuts";

interface WriteStudyViewProps {
  front: string;
  back: string;
  hint?: string | null;
  flashcardId?: string;
  acceptedAnswersEn?: string[];
  acceptedAnswersPt?: string[];
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

export const WriteStudyView = ({
  front,
  back,
  hint,
  flashcardId,
  acceptedAnswersEn = [],
  acceptedAnswersPt = [],
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
  onCorrect,
  onIncorrect,
  onSkip,
}: WriteStudyViewProps) => {
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "almost" | "incorrect" | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [currentHint, setCurrentHint] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [shake, setShake] = useState(false);

  const sideA = { text: front, lang: langA, label: getLangLabel(langA), acceptedAnswers: acceptedAnswersEn };
  const sideB = { text: back, lang: langB, label: getLangLabel(langB), acceptedAnswers: acceptedAnswersPt };
  const { promptSide, answerSide, isAFirst } = resolveStudySides(sideA, sideB, direction, flashcardId || front);

  const promptWordHints = wordHintsA;
  const promptMergedHints = isAFirst ? mergedHintsA : mergedHintsB;
  const prompt = promptSide.text;
  const correctAnswer = answerSide.text;
  const promptLabel = promptSide.label;
  const answerLabel = answerSide.label;
  const promptLang = toBCP47(promptSide.lang);

  const inputRef = useRef<HTMLInputElement>(null);
  const { speak } = useTTS();
  const shortcuts = useShortcutMap();

  const acceptedAnswers = [correctAnswer, ...(answerSide.acceptedAnswers || [])];
  const alternativeAnswers = acceptedAnswers.slice(1).filter((item, index, values) => values.indexOf(item) === index);

  useEffect(() => {
    setAnswer("");
    setFeedback(null);
    setHintLevel(0);
    setCurrentHint("");
    setRevealed(false);
    setShake(false);
    window.setTimeout(() => inputRef.current?.focus(), 100);
  }, [front, back]);

  const handleSubmit = () => {
    const userOriginalAnswer = answer.trim();

    if (!userOriginalAnswer) {
      setShake(true);
      window.setTimeout(() => setShake(false), 500);
      return;
    }

    const result = isAcceptableAnswer(userOriginalAnswer, acceptedAnswers);

    if (result.isCorrect) {
      setFeedback("correct");
      playCorrect();
      return;
    }

    const almostCorrect = acceptedAnswers.some((accepted) => isAlmostCorrect(userOriginalAnswer, accepted));

    if (almostCorrect) {
      setFeedback("almost");
      playCorrect();
      toast.warning(`Correto! (Atenção ao erro de digitação: "${correctAnswer}")`, {
        duration: 3000,
      });
      return;
    }

    setFeedback("incorrect");
    playWrong();
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

  const handleKeyPress = (event: React.KeyboardEvent) => {
    const key = normalizeKey(event.key);
    const confirmKey = normalizeKey(shortcuts.confirm);
    const skipKey = normalizeKey(shortcuts.skip);

    if (key === confirmKey) {
      event.preventDefault();
      if (!feedback) handleSubmit();
      else if (feedback === "correct" || feedback === "almost") onCorrect();
      else onIncorrect();
      return;
    }

    if (key === skipKey && !feedback) {
      event.preventDefault();
      onSkip();
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 sm:gap-6">
      <Card className={cn("relative bg-gradient-to-br from-card to-muted/20 p-4 sm:p-8", getRedListCardClass(isRedListed))}>
        <div className="absolute right-3 top-3 flex items-center gap-1 sm:right-4 sm:top-4 sm:gap-2">
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
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => {
                const rate = getSpeechRate();
                speak(prompt, { langOverride: promptLang, rate });
              }}
            >
              <Volume2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm">Traduza para {answerLabel}:</p>
        </div>
      </Card>

      {currentHint && (
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertDescription className="font-mono text-lg">{currentHint}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4" onKeyDown={handleKeyPress} tabIndex={-1}>
        <Input
          ref={inputRef}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Digite sua resposta..."
          disabled={feedback !== null}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck="false"
          className={cn(
            "h-14 text-lg transition-all duration-300",
            shake && "animate-[shake_0.5s_ease-in-out]",
            feedback === "correct" && "border-2 border-emerald-500 bg-emerald-500/8",
            feedback === "almost" && "border-2 border-amber-500 bg-amber-500/8",
            feedback === "incorrect" && "border-2 border-destructive bg-destructive/6",
          )}
          style={{ fontSize: "1.125rem" }}
        />

        {feedback === "correct" && (
          <StudyFeedbackPanel
            status="correct"
            title="Muito bem!"
            message="Sua resposta está correta."
            correctAnswer={correctAnswer}
            acceptedAnswers={alternativeAnswers}
            actionLabel="Próximo card"
            onAction={onCorrect}
          />
        )}

        {feedback === "almost" && (
          <StudyFeedbackPanel
            status="almost"
            message="Faltou ou sobrou apenas um caractere. O resultado contará como acerto."
            userAnswer={answer.trim()}
            correctAnswer={correctAnswer}
            acceptedAnswers={alternativeAnswers}
            actionLabel="Próximo card"
            onAction={onCorrect}
          />
        )}

        {feedback === "incorrect" && (
          <StudyFeedbackPanel
            status="incorrect"
            userAnswer={answer.trim()}
            correctAnswer={correctAnswer}
            actionLabel="Continuar"
            onAction={onIncorrect}
          />
        )}
      </div>

      {feedback === null && (
        <div className="sticky bottom-4 z-10 rounded-lg bg-background/95 p-2 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="h-11 shrink-0 px-3 text-muted-foreground"
              title="Pular"
            >
              <SkipForward className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Pular</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleHint}
              disabled={revealed}
              className="h-11 shrink-0 px-3 text-muted-foreground"
              title="Dica"
            >
              <Lightbulb className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Dica</span>
            </Button>
            <Button onClick={handleSubmit} size="lg" className="min-h-[48px] flex-1 text-base font-semibold shadow-md">
              Corrigir
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
