import { useEffect, useMemo, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Volume2, Gauge, ArrowRight, RotateCcw, AlertTriangle, Square, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { usePronunciationEngine } from "@/features/speech/usePronunciationEngine";
import { useTTS } from "@/features/study/hooks/useTTS";
import { cn } from "@/lib/utils";
import { resolveStudySides, toBCP47, type Direction } from "@/features/study/lib/resolveStudySides";
import { InteractiveText } from "./InteractiveText";
import { playCorrect, playWrong } from "@/lib/sfx";
import type { MergedHint } from "@/features/study/lib/glossaryMerge";
import { getRedListCardClass } from "./RedListIndicator";
import { StudyToolsMenu } from "./StudyToolsMenu";
import { useShortcutMap } from "@/hooks/useKeyboardShortcuts";
import { normalizeKey, isTypingTarget } from "@/features/study/lib/keyboardShortcuts";
import type { PronunciationResultKind } from "@/features/speech/types";

interface PronunciationStudyViewProps {
  front: string;
  back: string;
  flashcardId?: string;
  listId?: string;
  direction: Direction | string;
  wordHintsA?: unknown;
  wordHintsB?: unknown;
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
  onResult: (result: { result: PronunciationResultKind; score: number | null }) => void;
}

export function PronunciationStudyView({
  front,
  back,
  flashcardId,
  listId,
  direction,
  wordHintsA,
  wordHintsB,
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
  onResult,
}: PronunciationStudyViewProps) {
  const sideA = useMemo(() => ({ text: front, lang: langA, label: labelA || "Lado A" }), [front, langA, labelA]);
  const sideB = useMemo(() => ({ text: back, lang: langB, label: labelB || "Lado B" }), [back, langB, labelB]);
  const resolved = useMemo(
    () => resolveStudySides(sideA, sideB, direction, flashcardId || `${front}:${back}`),
    [back, direction, flashcardId, front, sideA, sideB],
  );
  const hintSide = resolved.promptSide;
  const speakSide = resolved.answerSide;
  const speakLang = toBCP47(speakSide.lang);
  const hintLang = toBCP47(hintSide.lang);
  const speakHints = resolved.isAFirst ? mergedHintsB : mergedHintsA;
  const hintHints = resolved.isAFirst ? mergedHintsA : mergedHintsB;
  const speakWordHints = resolved.isAFirst ? wordHintsB : wordHintsA;
  const hintWordHints = resolved.isAFirst ? wordHintsA : wordHintsB;

  const pronunciation = usePronunciationEngine({
    expectedText: speakSide.text,
    language: speakLang,
    cardId: flashcardId,
    listId,
  });
  const { speak, stop: stopTTS, isSpeaking, lastResult: lastPlayback } = useTTS();
  const shortcuts = useShortcutMap();
  const lastSoundPlayedForRef = useRef<string>("");

  useEffect(() => {
    pronunciation.reset();
    stopTTS();
    lastSoundPlayedForRef.current = "";
  }, [speakSide.text]); // reset only when the practiced phrase changes

  const advance = () => {
    pronunciation.cancel();
    stopTTS();
    if (pronunciation.result) {
      onResult({ result: pronunciation.result.result, score: pronunciation.result.score });
    } else {
      onResult({ result: "skipped", score: null });
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (normalizeKey(event.key) === normalizeKey(shortcuts.nextCard)) {
        event.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts.nextCard, pronunciation.result, onResult]);

  useEffect(() => {
    const result = pronunciation.result;
    if (!result || lastSoundPlayedForRef.current === result.transcript) return;
    lastSoundPlayedForRef.current = result.transcript;
    if (result.result === "correct") playCorrect();
    if (result.result === "incorrect") playWrong();
  }, [pronunciation.result]);

  const playOriginal = () => {
    stopTTS();
    void speak(speakSide.text, { langOverride: speakLang, rate: 1, mode: "natural" });
  };
  const playSlow = () => {
    stopTTS();
    void speak(speakSide.text, { langOverride: speakLang, rate: 0.5, mode: "word-by-word" });
  };
  const toggleRecording = () => {
    if (pronunciation.isRecording) pronunciation.stop();
    else void pronunciation.start();
  };

  const resultStyle = !pronunciation.result
    ? "bg-muted/20 border-dashed border-muted"
    : pronunciation.result.result === "correct"
      ? "bg-green-50/50 border-green-400 dark:bg-green-900/20 dark:border-green-600"
      : pronunciation.result.result === "almost"
        ? "bg-amber-50/50 border-amber-400 dark:bg-amber-900/20 dark:border-amber-600"
        : "bg-red-50/50 border-red-400 dark:bg-red-900/20 dark:border-red-600";
  const resultColor = pronunciation.result?.result === "correct"
    ? "text-green-600 dark:text-green-400"
    : pronunciation.result?.result === "almost"
      ? "text-amber-600 dark:text-amber-400"
      : pronunciation.result?.result === "incorrect"
        ? "text-red-600 dark:text-red-400"
        : "";
  const ResultIcon = pronunciation.result?.result === "correct"
    ? CheckCircle2
    : pronunciation.result?.result === "almost"
      ? AlertCircle
      : XCircle;

  if (!pronunciation.isSupported) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertTriangle className="mb-4 h-12 w-12 text-amber-500" />
        <h3 className="text-xl font-bold">Gravação indisponível</h3>
        <p className="mt-2 text-muted-foreground">Este navegador não oferece MediaRecorder e acesso ao microfone neste contexto. A página precisa estar em HTTPS.</p>
        <Button onClick={advance} className="mt-6">Pular exercício</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 animate-fade-in">
      <Card className={cn("relative flex min-h-[200px] w-full flex-col items-center justify-center overflow-hidden border-2 p-8 text-center", getRedListCardClass(isRedListed))}>
        <div className="absolute right-3 top-3">
          <StudyToolsMenu
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            isRedListed={isRedListed}
            onToggleRedList={onToggleRedList}
            isSpecial={isSpecial}
            onToggleSpecial={onToggleSpecial}
          />
        </div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Fale em {speakSide.label}</p>
        <h2 className="mb-2 text-4xl font-bold tracking-tight text-primary md:text-5xl">
          <InteractiveText text={speakSide.text} wordHints={speakWordHints} mergedHints={speakHints} speakOnHintClick speakLang={speakLang} />
        </h2>
        <p className="mb-8 text-sm italic text-muted-foreground/60">
          “<InteractiveText text={hintSide.text} wordHints={hintWordHints} mergedHints={hintHints} speakOnHintClick speakLang={hintLang} />”
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={playOriginal} disabled={isSpeaking} className="gap-2 rounded-full px-5">
            {isSpeaking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
            Ouvir original
          </Button>
          <Button variant="outline" size="sm" onClick={playSlow} disabled={isSpeaking} className="gap-2 rounded-full px-5">
            <Gauge className="h-4 w-4" /> Ouvir devagar
          </Button>
        </div>
        {lastPlayback?.provider === "cloud" && (
          <p className="mt-3 text-xs text-muted-foreground">Voz de fallback gerada por IA.</p>
        )}
      </Card>

      <div className="w-full rounded-lg border bg-muted/20 p-3 text-center text-xs text-muted-foreground">
        O App Piteco usa o microfone para processar esta tentativa. O áudio não é salvo permanentemente.
      </div>

      <div className="flex flex-col items-center gap-4 py-2">
        <Button
          size="lg"
          variant={pronunciation.isRecording ? "destructive" : "default"}
          disabled={pronunciation.isProcessing || pronunciation.state === "requesting-permission"}
          className={cn(
            "flex h-20 w-20 items-center justify-center rounded-full border-4 shadow-2xl transition-all duration-300",
            pronunciation.isRecording ? "scale-110 animate-pulse border-red-200 ring-4 ring-red-100" : "border-primary/20 hover:scale-105",
          )}
          onClick={toggleRecording}
        >
          {pronunciation.isProcessing || pronunciation.state === "requesting-permission"
            ? <Loader2 className="h-8 w-8 animate-spin" />
            : pronunciation.isRecording
              ? <Square className="h-8 w-8 fill-current" />
              : <Mic className="h-8 w-8" />}
        </Button>
        <span className={cn("h-6 text-sm font-medium", pronunciation.isRecording ? "animate-pulse text-red-500" : "text-muted-foreground")}>
          {pronunciation.isRecording
            ? "Gravando... toque para concluir"
            : pronunciation.isProcessing
              ? "Processando a tentativa..."
              : pronunciation.state === "requesting-permission"
                ? "Aguardando permissão do microfone..."
                : "Toque para falar"}
        </span>
      </div>

      <div className={cn("flex min-h-[130px] w-full flex-col items-center justify-center rounded-xl border-2 p-6 text-center transition-all", resultStyle)}>
        {pronunciation.error ? (
          <div className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /><p>{pronunciation.error}</p></div>
        ) : pronunciation.result ? (
          <div className="animate-in zoom-in-95">
            <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Frase reconhecida</p>
            <p className={cn("text-2xl font-medium italic", resultColor)}>“{pronunciation.result.transcript}”</p>
            <div className={cn("mt-2 flex items-center justify-center gap-2 font-semibold", resultColor)}>
              <ResultIcon className="h-5 w-5" />
              <span>{pronunciation.result.result === "correct" ? "Correto" : pronunciation.result.result === "almost" ? "Quase lá" : "Tente novamente"} ({Math.round(pronunciation.result.score)}%)</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {pronunciation.result.assessmentType === "acoustic" ? "Avaliação acústica de pronúncia" : "Correspondência da frase reconhecida"}
            </p>
            {pronunciation.result.warnings.map((warning) => <p key={warning} className="mt-1 text-xs text-amber-700 dark:text-amber-400">{warning}</p>)}
          </div>
        ) : (
          <p className="italic text-muted-foreground/50">O resultado aparecerá aqui depois da gravação.</p>
        )}
      </div>

      <div className="flex w-full justify-between pt-2">
        <Button variant="ghost" onClick={pronunciation.reset} disabled={pronunciation.isProcessing} className="text-muted-foreground hover:text-foreground">
          <RotateCcw className="mr-2 h-4 w-4" /> Tentar novamente
        </Button>
        <Button onClick={advance} className="px-8" size="lg" disabled={pronunciation.isRecording || pronunciation.isProcessing}>
          {pronunciation.result ? "Próximo" : "Pular"}<ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
