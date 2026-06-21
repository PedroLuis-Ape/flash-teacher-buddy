import { useEffect, useMemo, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Volume2, ArrowRight, RotateCcw, AlertTriangle, Square, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { usePronunciation } from "@/features/study/hooks/usePronunciation";
import { useTTS } from "@/features/study/hooks/useTTS";
import { cn } from "@/lib/utils";
import { toBCP47 } from "@/features/study/lib/resolveStudySides";
import { InteractiveText } from "./InteractiveText";
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

export function PronunciationStudyView({ front, back, wordHintsA, mergedHintsA, mergedHintsB, langA = "en", langB = "pt", labelA, labelB, isFavorite = false, isRedListed = false, onToggleFavorite, onToggleRedList, isSpecial = false, onToggleSpecial, onNext }: PronunciationStudyViewProps) {
  // --- Side A/B State Consolidation ---
  // In pronunciation mode, user practices speaking sideB (the answer/translation side)
  const sideA = { text: front, lang: langA, label: labelA || "Termo" };
  const sideB = { text: back, lang: langB, label: labelB || "Definição" };

  // Pronunciation always practices speaking sideB
  const speakSide = sideB;   // The phrase user must speak
  const hintSide = sideA;    // Just a visual hint

  // Map short codes to BCP-47 using shared utility
  const speakLang = toBCP47(speakSide.lang);
  const hintLang = toBCP47(hintSide.lang);

  const {
    isListening,
    transcript,
    alternatives,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = usePronunciation({ lang: speakLang });

  const { speak, stop: stopTTS } = useTTS();
  const shortcuts = useShortcutMap();
  
  // Track if we've already played sound for this transcript
  const lastSoundPlayedForRef = useRef<string>('');

  useEffect(() => {
    resetTranscript();
    stopTTS();
    lastSoundPlayedForRef.current = '';
  }, [speakSide.text, resetTranscript, stopTTS]);

  // Keyboard shortcuts for pronunciation: nextCard advances to the next card.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const k = normalizeKey(e.key);
      const nextKey = normalizeKey(shortcuts.nextCard);
      if (k === nextKey) {
        e.preventDefault();
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
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleNext = () => {
    stopListening();
    stopTTS();
    onNext();
  };

  // Evaluate pronunciation using fuzzy matching
  const evaluation = useMemo(() => {
    if (!transcript || alternatives.length === 0) return null;
    return evaluatePronunciation(alternatives, speakSide.text);
  }, [speakSide.text, transcript, alternatives]);

  // Play sound effect in useEffect (NOT in useMemo to avoid issues)
  useEffect(() => {
    if (!evaluation || !transcript) return;
    
    // Only play sound once per unique transcript
    if (lastSoundPlayedForRef.current === transcript) return;
    lastSoundPlayedForRef.current = transcript;
    
    if (evaluation.result === 'correct') {
      playCorrect();
    } else if (evaluation.result === 'incorrect') {
      playWrong();
    }
    // 'almost' doesn't play any sound - it's a neutral feedback
  }, [evaluation, transcript]);

  if (!isSupported) {
    return (
      <div className="flex flex-col items-center justify-center p-6 sm:p-8 text-center">
        <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-amber-500 mb-3 sm:mb-4" />
        <h3 className="text-lg sm:text-xl font-bold">Navegador não suportado</h3>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          O reconhecimento de voz requer Google Chrome ou Edge.
        </p>
        <Button onClick={onNext} className="mt-4 sm:mt-6">
          Pular Exercício
        </Button>
      </div>
    );
  }

  const getResultStyles = () => {
    if (!evaluation) return "bg-muted/20 border-dashed border-muted";
    
    switch (evaluation.result) {
      case 'correct':
        return "bg-green-50/50 border-green-400 dark:bg-green-900/20 dark:border-green-600";
      case 'almost':
        return "bg-amber-50/50 border-amber-400 dark:bg-amber-900/20 dark:border-amber-600";
      case 'incorrect':
        return "bg-red-50/50 border-red-400 dark:bg-red-900/20 dark:border-red-600";
    }
  };

  const getResultIcon = () => {
    if (!evaluation) return null;
    
    switch (evaluation.result) {
      case 'correct':
        return <CheckCircle2 className="w-5 h-5" />;
      case 'almost':
        return <AlertCircle className="w-5 h-5" />;
      case 'incorrect':
        return <XCircle className="w-5 h-5" />;
    }
  };

  const getResultText = () => {
    if (!evaluation) return null;
    
    const percentage = Math.round(evaluation.bestScore * 100);
    
    switch (evaluation.result) {
      case 'correct':
        return `Correto! (${percentage}%)`;
      case 'almost':
        return `Quase lá! (${percentage}%)`;
      case 'incorrect':
        return `Incorreto (${percentage}%)`;
    }
  };

  const getResultColor = () => {
    if (!evaluation) return "";
    
    switch (evaluation.result) {
      case 'correct':
        return "text-green-600 dark:text-green-400";
      case 'almost':
        return "text-amber-600 dark:text-amber-400";
      case 'incorrect':
        return "text-red-600 dark:text-red-400";
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 sm:gap-6 w-full max-w-2xl mx-auto animate-fade-in">
      <Card className={cn("w-full p-4 sm:p-8 flex flex-col items-center min-h-[160px] sm:min-h-[200px] justify-center border-2 text-center relative overflow-hidden", getRedListCardClass(isRedListed))}>
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
          <StudyToolsMenu
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            isRedListed={isRedListed}
            onToggleRedList={onToggleRedList}
            isSpecial={isSpecial}
            onToggleSpecial={onToggleSpecial}
          />
        </div>
        <p className="text-[11px] sm:text-xs uppercase tracking-widest text-muted-foreground mb-2 sm:mb-4 font-semibold">
          Fale em {speakSide.label}
        </p>

        {/* Phrase to speak - BIG */}
        <h2 className="text-[clamp(1.75rem,8.5vw,2.5rem)] sm:text-4xl md:text-5xl leading-tight font-bold text-primary mb-1 sm:mb-2 tracking-tight">
          <InteractiveText text={speakSide.text} wordHints={wordHintsA} mergedHints={mergedHintsB} speakOnHintClick speakLang={speakLang} />
        </h2>

        {/* Hint translation - small */}
        <p className="text-xs sm:text-sm text-muted-foreground/60 mb-4 sm:mb-8 italic">
          "<InteractiveText text={hintSide.text} wordHints={wordHintsA} mergedHints={mergedHintsA} speakOnHintClick speakLang={hintLang} />"
        </p>

        <Button
          variant="secondary"
          size="sm"
          onClick={handlePlayPronunciation}
          className="h-10 gap-2 rounded-full px-5 sm:px-6"
        >
          <Volume2 className="w-4 h-4" />
          Ouvir Original
        </Button>
      </Card>

      <div className="flex flex-col items-center gap-2 sm:gap-4 py-0 sm:py-2">
        <Button
          size="lg"
          variant={isListening ? "destructive" : "default"}
          className={cn(
            "rounded-full w-16 h-16 sm:w-20 sm:h-20 shadow-2xl border-[3px] sm:border-4 transition-all duration-300 flex items-center justify-center",
            isListening
              ? "scale-110 border-red-200 ring-4 ring-red-100 animate-pulse"
              : "border-primary/20 hover:scale-105"
          )}
          onClick={handleMicToggle}
        >
          {isListening ? (
            <Square className="w-6 h-6 sm:w-8 sm:h-8 fill-current" />
          ) : (
            <Mic className="w-6 h-6 sm:w-8 sm:h-8" />
          )}
        </Button>

        <span
          className={cn(
            "text-xs sm:text-sm font-medium transition-all duration-300 h-5 sm:h-6",
            isListening ? "text-red-500 animate-pulse" : "text-muted-foreground"
          )}
        >
          {isListening ? "Ouvindo... (Fale agora)" : "Toque para falar"}
        </span>
      </div>

      <div
        className={cn(
          "w-full p-4 sm:p-6 rounded-xl border-2 text-center transition-all duration-500 min-h-[88px] sm:min-h-[120px] flex flex-col justify-center items-center",
          getResultStyles()
        )}
      >
        {error ? (
          <div className="flex items-center gap-2 text-sm sm:text-base text-destructive animate-in fade-in slide-in-from-bottom-2">
            <AlertTriangle className="w-4 h-4" />
            <p>{error}</p>
          </div>
        ) : transcript ? (
          <div className="animate-in zoom-in-95 duration-300">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 uppercase tracking-wider">
              Reconhecido
            </p>
            <p className={cn(
              "text-xl sm:text-2xl font-medium italic",
              getResultColor() || "text-foreground"
            )}>
              "{transcript}"
            </p>
            {evaluation && (
              <div className={cn("flex items-center justify-center gap-2 mt-1.5 sm:mt-2 text-sm sm:text-base", getResultColor())}>
                {getResultIcon()}
                <span className="font-semibold">{getResultText()}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm sm:text-base text-muted-foreground/40 italic">
            O texto falado aparecerá aqui...
          </p>
        )}
      </div>

      <div className="w-full flex justify-between items-center pt-0 sm:pt-2">
        <Button
          variant="ghost"
          onClick={resetTranscript}
          disabled={!transcript && !error}
          className="h-10 px-2 sm:px-4 text-sm text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Limpar
        </Button>

        <Button onClick={handleNext} className="h-11 sm:h-12 px-6 sm:px-8" size="lg">
          Próximo
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
