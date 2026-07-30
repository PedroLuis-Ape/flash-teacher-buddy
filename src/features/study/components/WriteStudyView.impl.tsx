import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lightbulb, SkipForward, Volume2 } from "lucide-react";
import { getHint } from "@/lib/textMatch";
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
import { useShortcutMap } from "@/hooks/useKeyboardShortcuts";
import { normalizeKey } from "@/features/study/lib/keyboardShortcuts";
import {
  evaluateWriteAnswer,
  summarizeDifferences,
  type WriteAnswerEvaluation,
} from "@/features/study/lib/writeAnswerEvaluation";
import {
  DEFAULT_WRITE_CORRECTION_MODE,
  readWriteCorrectionMode,
  type WriteCorrectionMode,
} from "@/features/study/lib/writeCorrectionMode";
import {
  DEFAULT_WRITE_ACTIVITY_PREFERENCE,
  WRITE_ACTIVITY_PREFERENCE_CHANGED_EVENT,
  readWriteActivityPreference,
  resolveRewriteSideForCard,
  resolveWriteActivityGameMode,
  type WriteActivityPreference,
  type WriteActivityPreferenceChangedDetail,
} from "@/features/study/lib/writeActivityMode";
import { evaluateRewriteAnswer } from "@/features/study/lib/writeRewriteEvaluation";
import { WriteAnswerDiff } from "./WriteAnswerDiff";
import { useAdvanceController } from "@/features/study/hooks/useAdvanceController";
import { SkipCardConfirmDialog } from "./SkipCardConfirmDialog";
import { LayeredCardHintButton } from "./LayeredCardHintButton";
import { setWriteAnswerLocked } from "@/features/study/lib/writeAnswerLock";

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
  onRestartRound?: () => void;
  onRestartJourney?: () => void;
  onCorrect: () => void;
  onIncorrect: () => void;
  onSkip: () => void;
  layerCount?: number;
  layersVisitedCount?: number;
  onOpenLayers?: () => void;
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
  onRestartRound,
  onRestartJourney,
  onCorrect,
  onIncorrect,
  onSkip,
  layerCount = 1,
  layersVisitedCount = 0,
  onOpenLayers,
}: WriteStudyViewProps) => {
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<WriteAnswerEvaluation | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [currentHint, setCurrentHint] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [shake, setShake] = useState(false);
  const writeActivityGameMode = resolveWriteActivityGameMode();
  const [writeActivity, setWriteActivity] = useState<WriteActivityPreference>(
    () => (typeof window === "undefined"
      ? { ...DEFAULT_WRITE_ACTIVITY_PREFERENCE }
      : readWriteActivityPreference(writeActivityGameMode)),
  );
  const [correctionMode, setCorrectionMode] = useState<WriteCorrectionMode>(
    () => (typeof window === "undefined" ? DEFAULT_WRITE_CORRECTION_MODE : readWriteCorrectionMode()),
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<WriteCorrectionMode>).detail;
      if (detail === "flexible" || detail === "hard") setCorrectionMode(detail);
    };
    window.addEventListener("ape:writeCorrectionModeChanged", handler as EventListener);
    return () => window.removeEventListener("ape:writeCorrectionModeChanged", handler as EventListener);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<WriteActivityPreferenceChangedDetail>).detail;
      if (detail?.gameMode === writeActivityGameMode) setWriteActivity(detail.preference);
    };
    window.addEventListener(WRITE_ACTIVITY_PREFERENCE_CHANGED_EVENT, handler as EventListener);
    return () => window.removeEventListener(WRITE_ACTIVITY_PREFERENCE_CHANGED_EVENT, handler as EventListener);
  }, [writeActivityGameMode]);

  // Lock global "next / skip / next-layer" shortcuts while this Write view
  // has no evaluation yet — the user must submit first. Once feedback is
  // shown (right/wrong screen), shortcuts unlock automatically.
  useEffect(() => {
    setWriteAnswerLocked(!evaluation);
    return () => setWriteAnswerLocked(false);
  }, [evaluation]);

  const sideA = { text: front, lang: langA, label: getLangLabel(langA), acceptedAnswers: acceptedAnswersEn };
  const sideB = { text: back, lang: langB, label: getLangLabel(langB), acceptedAnswers: acceptedAnswersPt };
  const translatedSides = resolveStudySides(sideA, sideB, direction, flashcardId || front);
  const isRewriteActivity = writeActivityGameMode === "write" && writeActivity.mode === "rewrite";
  const cardIdentity = flashcardId ?? `${front}|${back}`;
  const resolvedRewriteSide = resolveRewriteSideForCard(cardIdentity, writeActivity.rewriteSide);
  const rewriteTargetSide = resolvedRewriteSide === "a" ? sideA : sideB;
  const promptSide = isRewriteActivity ? rewriteTargetSide : translatedSides.promptSide;
  const answerSide = isRewriteActivity ? rewriteTargetSide : translatedSides.answerSide;
  const isAFirst = isRewriteActivity ? resolvedRewriteSide === "a" : translatedSides.isAFirst;

  const promptWordHints = isAFirst ? wordHintsA : undefined;
  const promptMergedHints = isAFirst ? mergedHintsA : mergedHintsB;
  const prompt = promptSide.text;
  const correctAnswer = answerSide.text;
  const promptLabel = promptSide.label;
  const answerLabel = answerSide.label;
  const promptLang = toBCP47(promptSide.lang);
  const effectiveCorrectionMode: WriteCorrectionMode = isRewriteActivity ? "hard" : correctionMode;
  const attemptCardId = `${cardIdentity}:${isRewriteActivity ? `rewrite-${resolvedRewriteSide}` : "translate"}`;

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const { speak } = useTTS();
  const shortcuts = useShortcutMap();

  // Central advance gate — every "next"/"skip" path goes through this
  // controller so we can (a) demand a finalized status before advancing and
  // (b) prevent duplicate onAdvance calls for the same attempt.
  const advance = useAdvanceController({
    cardId: attemptCardId,
    mode: "write",
    flowMode: "mastery_rounds",
    onAdvance: (final) => {
      if (final === "correct" || final === "accepted_with_corrections") onCorrect();
      else if (final === "incorrect") onIncorrect();
      else onSkip(); // "skipped" and "revealed"
    },
    onCancelSkip: () => window.setTimeout(() => inputRef.current?.focus(), 30),
  });

  const acceptedAnswers = isRewriteActivity
    ? [correctAnswer]
    : [correctAnswer, ...(answerSide.acceptedAnswers || [])];
  const alternativeAnswers = acceptedAnswers.slice(1).filter((item, index, values) => values.indexOf(item) === index);
  const promptLength = prompt.trim().length;
  const promptSizeClass = promptLength <= 32
    ? "text-[clamp(1.55rem,7vw,2.15rem)]"
    : promptLength <= 76
      ? "text-[clamp(1.3rem,5.8vw,1.85rem)]"
      : "text-[clamp(1.12rem,4.8vw,1.55rem)]";

  useEffect(() => {
    setAnswer("");
    setEvaluation(null);
    setHintLevel(0);
    setCurrentHint("");
    setRevealed(false);
    setShake(false);
    window.setTimeout(() => inputRef.current?.focus(), 100);
  }, [front, back, isRewriteActivity, resolvedRewriteSide]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.style.height = "auto";
    const nextHeight = Math.min(Math.max(input.scrollHeight, 80), 168);
    input.style.height = `${nextHeight}px`;
  }, [answer]);

  const handleSubmit = () => {
    const userOriginalAnswer = answer.trim();

    if (!userOriginalAnswer) {
      setShake(true);
      window.setTimeout(() => setShake(false), 500);
      return;
    }

    const result = isRewriteActivity
      ? evaluateRewriteAnswer({ userAnswer: userOriginalAnswer, correctAnswer })
      : evaluateWriteAnswer({
          userAnswer: userOriginalAnswer,
          correctAnswer,
          alternatives: alternativeAnswers,
          mode: correctionMode,
        });
    setEvaluation(result);
    if (result.accepted) playCorrect();
    else playWrong();
    advance.setStatus(
      result.status === "exact"
        ? "correct"
        : result.status === "accepted_with_corrections"
          ? "accepted_with_corrections"
          : "incorrect",
    );
  };

  const handleHint = () => {
    if (isRewriteActivity) return;
    if (hintLevel < 2) {
      const newLevel = hintLevel + 1;
      setHintLevel(newLevel);
      setCurrentHint(getHint(correctAnswer, newLevel));
    } else {
      setRevealed(true);
      setCurrentHint(correctAnswer);
      advance.setStatus("revealed");
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && event.shiftKey) return;

    const key = normalizeKey(event.key);
    const confirmKey = normalizeKey(shortcuts.confirm);
    const skipKey = normalizeKey(shortcuts.skip);

    if (key === confirmKey) {
      event.preventDefault();
      if (!evaluation) handleSubmit();
      else if (evaluation.accepted) advance.requestAdvance({ source: "keyboard" });
      else if (effectiveCorrectionMode === "hard") handleRetry();
      else advance.requestAdvance({ source: "keyboard" });
      return;
    }

    if (key === skipKey && !evaluation) {
      event.preventDefault();
      advance.requestAdvance({ source: "keyboard" });
    }
  };

  const feedbackStatus: "correct" | "almost" | "incorrect" | null = evaluation
    ? evaluation.status === "exact"
      ? "correct"
      : evaluation.status === "accepted_with_corrections"
        ? "almost"
        : "incorrect"
    : null;
  const accuracyPercent = evaluation ? Math.round(evaluation.accuracy * 100) : undefined;
  const { messages: correctionMessages, hiddenCount: hiddenCorrectionCount } = evaluation
    ? summarizeDifferences(evaluation.differences, evaluation.status === "incorrect" ? 5 : 6)
    : { messages: [] as string[], hiddenCount: 0 };
  const referenceAnswer = evaluation?.matchedAnswer ?? correctAnswer;

  const handleRetry = () => {
    setEvaluation(null);
    advance.setStatus("unanswered");
    window.setTimeout(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      const length = input.value.length;
      try { input.setSelectionRange(length, length); } catch { /* noop */ }
    }, 50);
  };

  useEffect(() => {
    if (!evaluation) return;
    const node = feedbackRef.current;
    if (!node) return;
    const timer = window.setTimeout(() => {
      try {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        node.scrollIntoView();
      }
    }, 60);
    return () => window.clearTimeout(timer);
  }, [evaluation]);

  const hasFeedback = evaluation !== null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 sm:gap-6">
      <Card className={cn(
        "relative bg-gradient-to-br from-card to-muted/20 transition-all duration-200",
        hasFeedback ? "min-h-0 p-3 sm:p-4" : "min-h-[168px] p-5 sm:min-h-0 sm:p-8",
        getRedListCardClass(isRedListed),
      )}>
        <div className="absolute right-3 top-3 flex items-center gap-1 sm:right-4 sm:top-4 sm:gap-2">
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

        <div className={cn(
          "flex flex-col items-center justify-center text-center",
          hasFeedback ? "min-h-0 pt-0 gap-1" : "min-h-[128px] pt-2 sm:min-h-0 sm:pt-0",
        )}>
          <p className={cn("pr-20 text-xs text-muted-foreground sm:pr-0 sm:text-sm", hasFeedback ? "mb-1" : "mb-3 sm:mb-4")}>{promptLabel}</p>
          <div className={cn(
            "flex w-full flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3",
            hasFeedback ? "mb-0" : "mb-4 sm:mb-8",
          )}>
            <p className={cn(
              "mx-auto max-w-[94%] break-words px-2 font-semibold leading-tight [text-wrap:balance]",
              hasFeedback ? "text-base sm:text-lg" : cn(promptSizeClass, "sm:text-3xl"),
            )}>
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
              className={cn("shrink-0 p-0", hasFeedback ? "h-8 w-8" : "h-9 w-9")}
              onClick={() => {
                const rate = getSpeechRate();
                speak(prompt, { langOverride: promptLang, rate });
              }}
              aria-label="Ouvir frase"
            >
              <Volume2 className={cn(hasFeedback ? "h-4 w-4" : "h-5 w-5")} />
            </Button>
          </div>
          {!hasFeedback && (
            <p className="text-sm text-muted-foreground sm:text-sm">
              {isRewriteActivity ? "Reescreva exatamente como aparece acima:" : `Traduza para ${answerLabel}:`}
            </p>
          )}
        </div>
      </Card>

      {currentHint && (
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertDescription className="font-mono text-lg">{currentHint}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4" tabIndex={-1}>
        {!hasFeedback && (
        <Textarea
          ref={inputRef}
          rows={2}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={isRewriteActivity ? "Reescreva o texto acima..." : "Digite sua resposta..."}
          disabled={evaluation !== null}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-label={isRewriteActivity ? "Reescreva o texto acima" : "Digite sua resposta"}
          className={cn(
            "min-h-[80px] max-h-[168px] resize-none overflow-y-auto rounded-xl px-4 py-3.5 text-[1.0625rem] leading-6 transition-all duration-300 sm:min-h-[68px] sm:rounded-md sm:px-4 sm:py-3 sm:text-lg",
            shake && "animate-[shake_0.5s_ease-in-out]",
            feedbackStatus === "correct" && "border-2 border-emerald-500 bg-emerald-500/8",
            feedbackStatus === "almost" && "border-2 border-amber-500 bg-amber-500/8",
            feedbackStatus === "incorrect" && "border-2 border-destructive bg-destructive/6",
          )}
        />
        )}

        <div ref={feedbackRef}>
        {feedbackStatus === "correct" && (
          <StudyFeedbackPanel
            status="correct"
            title={isRewriteActivity ? "Reescrita correta!" : "Muito bem!"}
            message={isRewriteActivity ? "Você escreveu exatamente o texto apresentado." : "Sua resposta está correta."}
            correctAnswer={referenceAnswer}
            acceptedAnswers={alternativeAnswers}
            actionLabel="Próximo card"
            onAction={() => advance.requestAdvance({ source: "next_button" })}
            onPlayAnswer={() => { void speak(referenceAnswer, { langOverride: answerSide.lang }); }}
            playAnswerAriaLabel={`Ouvir resposta em ${answerLabel}`}
          />
        )}

        {feedbackStatus === "almost" && evaluation && (
          <StudyFeedbackPanel
            status="almost"
            title="Quase lá! Sua resposta foi aceita."
            message={evaluation.summary}
            accuracyPercent={accuracyPercent}
            userAnswer={answer.trim()}
            correctAnswer={referenceAnswer}
            acceptedAnswers={alternativeAnswers}
            extraContent={<WriteAnswerDiff differences={evaluation.differences} />}
            correctionMessages={correctionMessages}
            hiddenCorrectionCount={hiddenCorrectionCount}
            actionLabel="Continuar"
            onAction={() => advance.requestAdvance({ source: "next_button" })}
            secondaryActionLabel="Tentar corrigir"
            onSecondaryAction={handleRetry}
            onPlayAnswer={() => { void speak(referenceAnswer, { langOverride: answerSide.lang }); }}
            playAnswerAriaLabel={`Ouvir resposta em ${answerLabel}`}
          />
        )}

        {feedbackStatus === "incorrect" && evaluation && (
          <StudyFeedbackPanel
            status="incorrect"
            title={effectiveCorrectionMode === "hard" ? "Corrija para continuar." : "Vamos corrigir."}
            message={evaluation.summary}
            accuracyPercent={accuracyPercent}
            userAnswer={answer.trim()}
            correctAnswer={referenceAnswer}
            extraContent={<WriteAnswerDiff differences={evaluation.differences} />}
            correctionMessages={correctionMessages}
            hiddenCorrectionCount={hiddenCorrectionCount}
            actionLabel={effectiveCorrectionMode === "hard" ? "Tentar corrigir" : "Continuar"}
            onAction={
              effectiveCorrectionMode === "hard"
                ? handleRetry
                : () => advance.requestAdvance({ source: "next_button" })
            }
            secondaryActionLabel={effectiveCorrectionMode === "hard" ? undefined : "Tentar corrigir"}
            onSecondaryAction={effectiveCorrectionMode === "hard" ? undefined : handleRetry}
            onPlayAnswer={() => { void speak(referenceAnswer, { langOverride: answerSide.lang }); }}
            playAnswerAriaLabel={`Ouvir resposta em ${answerLabel}`}
          />
        )}

        {evaluation !== null && onOpenLayers && layerCount >= 2 && (
          <div className="mt-3 flex justify-center">
            <LayeredCardHintButton
              layerCount={layerCount}
              visitedCount={layersVisitedCount}
              onOpen={onOpenLayers}
            />
          </div>
        )}
        </div>
      </div>

      {evaluation === null && (
        <div className="sticky bottom-4 z-10 rounded-lg bg-background/95 p-2 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => advance.requestAdvance({ source: "next_button" })}
              className="h-11 shrink-0 px-3 text-muted-foreground"
              title="Pular"
            >
              <SkipForward className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Pular</span>
            </Button>
            {onOpenLayers && (
              <LayeredCardHintButton
                layerCount={layerCount}
                visitedCount={layersVisitedCount}
                onOpen={onOpenLayers}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleHint}
              disabled={revealed || isRewriteActivity}
              className="h-11 shrink-0 px-3 text-muted-foreground"
              title={isRewriteActivity ? "O texto já está visível" : "Dica"}
            >
              <Lightbulb className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Dica</span>
            </Button>
            <Button onClick={handleSubmit} size="lg" className="min-h-[50px] flex-1 text-base font-semibold shadow-md">
              Corrigir
            </Button>
          </div>
        </div>
      )}
      <SkipCardConfirmDialog
        open={advance.dialog.open}
        flowMode={advance.dialog.flowMode}
        onCancel={advance.dialog.cancel}
        onKnown={() => advance.dialog.classify("known")}
        onUnknown={() => advance.dialog.classify("unknown")}
      />
    </div>
  );
};