import { useEffect, useMemo, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Volume2, ArrowRight, RotateCcw, AlertTriangle, Square, Loader2 } from "lucide-react";
import { usePronunciation } from "@/features/study/hooks/usePronunciation";
import { useTTS } from "@/features/study/hooks/useTTS";
import { cn } from "@/lib/utils";
import { toBCP47 } from "@/features/study/lib/resolveStudySides";
import { InteractiveText } from "./InteractiveText";
import { StudyFeedbackPanel } from "./StudyFeedbackPanel";
import { playCorrect, playWrong } from "@/lib/sfx";
import { evaluatePronunciation } from "@/lib/levenshtein";
import type { MergedHint } from "@/features/study/lib/glossaryMerge";
import { getRedListCardClass } from "./RedListIndicator";
import { StudyToolsMenu } from "./StudyToolsMenu";
import { getSpeechRate } from "./SpeechRateControl";
import { useShortcutMap } from "@/hooks/useKeyboardShortcuts";
import { normalizeKey, isTypingTarget } from "@/features/study/lib/keyboardShortcuts";

interface PronunciationStudyViewProps {
  front: string;
  back: string;
  wordHintsA?: unknown;
  mergedHintsA?: MergedHint[];
  mergedHintsB?: MergedHint[];
  langA?: string;
  langB?: string;
  labelA?: string;
  labelB?: string;
  isFavorite?: boolean;
  isRedListed?: boolean;
  onToggleFavorite?: () => void;
  onToggleRedList?: () => void;
  isSpecial?: boolean;
  onToggleSpecial?: () => void;
  onNext: () => void;
}

export function PronunciationStudyView({
  front,
  back,
  wordHintsA,
  mergedHintsA,
  mergedHintsB,
  langA = "en",
  langB = "pt",
  labelA,
  labelB,
  isFavorite = false,
  isRedListed = false,
  onToggleFavorite,
  onToggleRedList,
  isSpecial = false,
  onToggleSpecial,
  onNext,
}: PronunciationStudyViewProps) {
  const sideA = { text: front, lang: langA, label: labelA || "Termo" };
  const sideB = { text: back, lang: langB, label: labelB || "Definição" };
  const speakSide = sideB;
  const hintSide = sideA;
  const speakLang = toBCP47(speakSide.lang);
  const hintLang = toBCP47(hintSide.lang);

  const {
    isListening,
    isProcessing,
    transcript,
    alternatives,
    error,
    isSupported,
    provider,
    startListening,
    stopListening,
    resetTranscript,
  } = usePronunciation({ lang: speakLang, expectedText: speakSide.text });

  const { speak, stop: stopTTS } = useTTS();
  const shortcuts = useShortcutMap();
  const lastSoundPlayedForRef = useRef("");

  const handleNext = () => {
    stopListening();
    stopTTS();
    onNext();
  };

  useEffect(() => {
    resetTranscript();
    stopTTS();
    lastSoundPlayedForRef.current = "";
  }, [speakSide.text, resetTranscript, stopTTS]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (normalizeKey(event.key) === normalizeKey(shortcuts.nextCard)) {
        event.preventDefault();
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, onNext]);

  const handlePlayPronunciation = () => {
    stopTTS();
    const rate = getSpeechRate();
    speak(speakSide.text, {
      langOverride: speakLang,
      rate,
      mode: rate === 0.5 ? "word-by-word" : "natural",
    });
  };

  const handleMicToggle = () => {
    if (isProcessing) return;
    if (isListening) stopListening();
    else void startListening();
  };

  const evaluation = useMemo(() => {
    if (!transcript || alternatives.length === 0) return null;
    return evaluatePronunciation(alternatives, speakSide.text);
  }, [speakSide.text, transcript, alternatives]);

  useEffect(() => {
    if (!evaluation || !transcript || lastSoundPlayedForRef.current === transcript) return;
    lastSoundPlayedForRef.current = transcript;

    if (evaluation.result === "correct") playCorrect();
    else if (evaluation.result === "incorrect") playWrong();
  }, [evaluation, transcript]);

  if (!isSupported) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center sm:p-8">
        <AlertTriangle className="mb-3 h-10 w-10 text-amber-500 sm:mb-4 sm:h-12 sm:w-12" />
        <h3 className="text-lg font-bold sm:text-xl">Gravação não suportada</h3>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Este navegador não oferece acesso compatível ao microfone nem reconhecimento de voz.
        </p>
        <Button onClick={onNext} className="mt-4 sm:mt-6">Pular exercício</Button>
      </div>
    );
  }

  const microphoneStatus = isProcessing
    ? "Analisando sua fala..."
    : isListening
      ? provider === "cloud"
        ? "Gravando... toque para concluir"
        : "Ouvindo... fale agora"
      : "Toque para falar";

  const percentage = evaluation ? Math.round(evaluation.bestScore * 100) : 0;
  const feedbackTitle = evaluation?.result === "correct"
    ? `Pronúncia correta! (${percentage}%)`
    : evaluation?.result === "almost"
      ? `Quase lá! (${percentage}%)`
      : `Vamos ajustar (${percentage}%)`;
  const feedbackMessage = evaluation?.result === "correct"
    ? "A frase reconhecida ficou muito próxima da pronúncia esperada."
    : evaluation?.result === "almost"
      ? "Está quase lá. Ouça novamente e ajuste a pronúncia com calma."
      : "Ouça a frase original e tente novamente antes de seguir.";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 animate-fade-in sm:gap-6">
      <Card className={cn("relative flex min-h-[160px] w-full flex-col items-center justify-center overflow-hidden border-2 p-4 text-center sm:min-h-[200px] sm:p-8", getRedListCardClass(isRedListed))}>
        <div className="absolute right-2 top-2 sm:right-3 sm:top-3">
          <StudyToolsMenu
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            isRedListed={isRedListed}
            onToggleRedList={onToggleRedList}
            isSpecial={isSpecial}
            onToggleSpecial={onToggleSpecial}
          />
        </div>

        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground sm:mb-4 sm:text-xs">
          Fale em {speakSide.label}
        </p>
        <h2 className="mb-1 text-[clamp(1.75rem,8.5vw,2.5rem)] font-bold leading-tight tracking-tight text-primary sm:mb-2 sm:text-4xl md:text-5xl">
          <InteractiveText text={speakSide.text} wordHints={wordHintsA} mergedHints={mergedHintsB} speakOnHintClick speakLang={speakLang} />
        </h2>
        <p className="mb-4 text-xs italic text-muted-foreground/60 sm:mb-8 sm:text-sm">
          “<InteractiveText text={hintSide.text} wordHints={wordHintsA} mergedHints={mergedHintsA} speakOnHintClick speakLang={hintLang} />”
        </p>
        <Button variant="secondary" size="sm" onClick={handlePlayPronunciation} className="h-10 gap-2 rounded-full px-5 sm:px-6">
          <Volume2 className="h-4 w-4" /> Ouvir original
        </Button>
      </Card>

      <div className="flex flex-col items-center gap-2 py-0 sm:gap-4 sm:py-2">
        <Button
          size="lg"
          variant={isListening ? "destructive" : "default"}
          disabled={isProcessing}
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-full border-[3px] shadow-2xl transition-all duration-300 sm:h-20 sm:w-20 sm:border-4",
            isListening ? "scale-110 animate-pulse border-red-200 ring-4 ring-red-100" : "border-primary/20 hover:scale-105",
            isProcessing && "cursor-wait opacity-80",
          )}
          onClick={handleMicToggle}
        >
          {isProcessing ? <Loader2 className="h-6 w-6 animate-spin sm:h-8 sm:w-8" /> : isListening ? <Square className="h-6 w-6 fill-current sm:h-8 sm:w-8" /> : <Mic className="h-6 w-6 sm:h-8 sm:w-8" />}
        </Button>
        <span className={cn(
          "h-5 text-xs font-medium transition-all duration-300 sm:h-6 sm:text-sm",
          isListening && "animate-pulse text-red-500",
          isProcessing && "text-primary",
          !isListening && !isProcessing && "text-muted-foreground",
        )}>
          {microphoneStatus}
        </span>
      </div>

      {error ? (
        <div className="flex min-h-[88px] w-full items-center justify-center gap-2 rounded-xl border-2 border-destructive/40 bg-destructive/8 p-4 text-sm text-destructive sm:min-h-[120px] sm:p-6 sm:text-base">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : isProcessing ? (
        <div className="flex min-h-[88px] w-full items-center justify-center gap-2 rounded-xl border-2 border-primary/30 bg-primary/5 p-4 text-sm text-primary sm:min-h-[120px] sm:p-6 sm:text-base">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p>Transcrevendo o áudio...</p>
        </div>
      ) : evaluation && transcript ? (
        <StudyFeedbackPanel
          status={evaluation.result}
          title={feedbackTitle}
          message={feedbackMessage}
          userAnswer={transcript}
          userAnswerLabel="Reconhecido"
          correctAnswer={speakSide.text}
          correctAnswerLabel="Frase esperada"
          actionLabel="Próximo card"
          onAction={handleNext}
        />
      ) : transcript ? (
        <div className="flex min-h-[88px] w-full flex-col items-center justify-center rounded-xl border-2 border-muted bg-muted/20 p-4 text-center sm:min-h-[120px] sm:p-6">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">Reconhecido</p>
          <p className="text-xl font-medium italic text-foreground sm:text-2xl">“{transcript}”</p>
        </div>
      ) : (
        <div className="flex min-h-[88px] w-full items-center justify-center rounded-xl border-2 border-dashed border-muted bg-muted/20 p-4 text-center sm:min-h-[120px] sm:p-6">
          <p className="text-sm italic text-muted-foreground/50 sm:text-base">O texto falado aparecerá aqui...</p>
        </div>
      )}

      <div className="flex w-full items-center justify-between pt-0 sm:pt-2">
        <Button
          variant="ghost"
          onClick={resetTranscript}
          disabled={isProcessing || (!transcript && !error)}
          className="h-10 px-2 text-sm text-muted-foreground hover:text-foreground sm:px-4"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          {evaluation ? "Tentar novamente" : "Limpar"}
        </Button>

        {!evaluation && (
          <Button onClick={handleNext} disabled={isProcessing} className="h-11 px-6 sm:h-12 sm:px-8" size="lg">
            Próximo
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
