import { useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Volume2, ArrowRight, RotateCcw, AlertTriangle, Square, CheckCircle2, XCircle } from "lucide-react";
import { usePronunciation } from "@/hooks/usePronunciation";
import { useTTS } from "@/hooks/useTTS";
import { cn } from "@/lib/utils";

interface PronunciationStudyViewProps {
  front: string;
  back: string;
  onNext: () => void;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function PronunciationStudyView({ front, back, onNext }: PronunciationStudyViewProps) {
  // CRITICAL: In pronunciation mode, we practice speaking ENGLISH
  // front = Portuguese (term), back = English (translation) based on flashcard structure
  // We SWAP them here: englishText is what we practice, portugueseText is just a hint
  const englishText = back;      // The phrase user must speak (ENGLISH)
  const portugueseText = front;  // Just a visual hint (Portuguese)

  const {
    isListening,
    transcript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = usePronunciation({ lang: "en-US" });

  const { speak, stop: stopTTS } = useTTS();

  useEffect(() => {
    resetTranscript();
    stopTTS();
  }, [englishText, resetTranscript, stopTTS]);

  const handlePlayPronunciation = () => {
    stopTTS();
    speak(englishText, { langOverride: "en-US" });
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

  // Compare transcript against ENGLISH text only
  const result = useMemo(() => {
    if (!transcript) return null;
    const expected = normalize(englishText);
    const said = normalize(transcript);
    return { isCorrect: expected === said };
  }, [englishText, transcript]);

  if (!isSupported) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
        <h3 className="text-xl font-bold">Navegador não suportado</h3>
        <p className="text-muted-foreground mt-2">
          O reconhecimento de voz requer Google Chrome ou Edge.
        </p>
        <Button onClick={onNext} className="mt-6">
          Pular Exercício
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto animate-fade-in">
      <Card className="w-full p-8 flex flex-col items-center min-h-[200px] justify-center border-2 text-center relative overflow-hidden">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4 font-semibold">
          Fale em Inglês
        </p>

        {/* ENGLISH phrase - BIG */}
        <h2 className="text-4xl md:text-5xl font-bold text-primary mb-2 tracking-tight">
          {englishText}
        </h2>

        {/* Portuguese translation - small hint */}
        <p className="text-sm text-muted-foreground/60 mb-8 italic">
          "{portugueseText}"
        </p>

        <Button
          variant="secondary"
          size="sm"
          onClick={handlePlayPronunciation}
          className="gap-2 rounded-full px-6"
        >
          <Volume2 className="w-4 h-4" />
          Ouvir Original
        </Button>
      </Card>

      <div className="flex flex-col items-center gap-4 py-2">
        <Button
          size="lg"
          variant={isListening ? "destructive" : "default"}
          className={cn(
            "rounded-full w-20 h-20 shadow-2xl border-4 transition-all duration-300 flex items-center justify-center",
            isListening
              ? "scale-110 border-red-200 ring-4 ring-red-100 animate-pulse"
              : "border-primary/20 hover:scale-105"
          )}
          onClick={handleMicToggle}
        >
          {isListening ? (
            <Square className="w-8 h-8 fill-current" />
          ) : (
            <Mic className="w-8 h-8" />
          )}
        </Button>

        <span
          className={cn(
            "text-sm font-medium transition-all duration-300 h-6",
            isListening ? "text-red-500 animate-pulse" : "text-muted-foreground"
          )}
        >
          {isListening ? "Ouvindo... (Fale agora)" : "Toque para falar"}
        </span>
      </div>

      <div
        className={cn(
          "w-full p-6 rounded-xl border-2 text-center transition-all duration-500 min-h-[120px] flex flex-col justify-center items-center",
          result?.isCorrect === true && "bg-green-50/50 border-green-400 dark:bg-green-900/20 dark:border-green-600",
          result?.isCorrect === false && "bg-red-50/50 border-red-400 dark:bg-red-900/20 dark:border-red-600",
          !result && "bg-muted/20 border-dashed border-muted"
        )}
      >
        {error ? (
          <div className="flex items-center gap-2 text-destructive animate-in fade-in slide-in-from-bottom-2">
            <AlertTriangle className="w-4 h-4" />
            <p>{error}</p>
          </div>
        ) : transcript ? (
          <div className="animate-in zoom-in-95 duration-300">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">
              Reconhecido
            </p>
            <p className="text-2xl font-medium italic text-foreground">
              "{transcript}"
            </p>
            {result?.isCorrect ? (
              <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 mt-2">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold">Correto!</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400 mt-2">
                <XCircle className="w-5 h-5" />
                <span className="font-semibold">Incorreto</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground/40 italic">
            O texto falado aparecerá aqui...
          </p>
        )}
      </div>

      <div className="w-full flex justify-between pt-2">
        <Button
          variant="ghost"
          onClick={resetTranscript}
          disabled={!transcript && !error}
          className="text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Limpar
        </Button>

        <Button onClick={handleNext} className="px-8" size="lg">
          Próximo
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
