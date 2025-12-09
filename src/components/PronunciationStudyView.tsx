import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, ArrowRight, RotateCcw } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useTTS } from "@/hooks/useTTS";
import { cn } from "@/lib/utils";

interface PronunciationStudyViewProps {
  front: string; // INGLÊS (term)
  back: string;  // PORTUGUÊS (translation)
  onNext: () => void;
}

/**
 * Componente de estudo de pronúncia
 * Força reconhecimento de voz em en-US
 */
export function PronunciationStudyView({ front, back, onNext }: PronunciationStudyViewProps) {
  // FORÇA 'en-US' - o aluno sempre falará inglês
  const {
    isListening,
    transcript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({ lang: "en-US", timeoutMs: 5000 });

  const { speak, stop } = useTTS();

  // Reset ao mudar de card
  useEffect(() => {
    resetTranscript();
    stop();
  }, [front, resetTranscript, stop]);

  // Handle play pronunciation
  const handlePlayPronunciation = () => {
    stop();
    speak(front, { langOverride: "en-US" });
  };

  // Toggle microphone
  const handleMicToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Handle next
  const handleNext = () => {
    stopListening();
    stop();
    onNext();
  };

  // Navegação por teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !isListening) {
        handleNext();
      } else if (e.key === " " && e.target === document.body) {
        e.preventDefault();
        handleMicToggle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isListening]);

  // Browser não suportado
  if (!isSupported) {
    return (
      <Card className="p-8 text-center">
        <div className="space-y-4">
          <div className="text-destructive text-lg font-semibold">
            Navegador não suportado
          </div>
          <p className="text-muted-foreground">
            Seu navegador não suporta reconhecimento de voz.
            <br />
            Use o Google Chrome para melhor experiência.
          </p>
          <Button onClick={onNext}>
            Pular <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto animate-fade-in">
      {/* Card principal com a frase */}
      <Card className="w-full p-8 flex flex-col items-center min-h-[200px] justify-center border-2 text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
          Leia em voz alta
        </p>

        {/* INGLÊS - GRANDE */}
        <h2 className="text-3xl md:text-4xl font-bold text-primary mb-3 leading-relaxed">
          {front}
        </h2>

        {/* PORTUGUÊS - LEGENDA */}
        <p className="text-lg text-muted-foreground mb-6 font-medium">
          {back}
        </p>

        {/* Botão de ouvir pronúncia correta */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePlayPronunciation}
          className="gap-2"
        >
          <Volume2 className="w-5 h-5" />
          Ouvir Pronúncia
        </Button>
      </Card>

      {/* Botão do microfone */}
      <div className="flex flex-col items-center gap-4 py-4">
        <Button
          size="lg"
          variant={isListening ? "destructive" : "default"}
          className={cn(
            "rounded-full w-24 h-24 shadow-xl border-4 transition-all duration-200",
            isListening && "scale-110 animate-pulse border-red-300 dark:border-red-700"
          )}
          onClick={handleMicToggle}
        >
          {isListening ? (
            <MicOff className="w-10 h-10" />
          ) : (
            <Mic className="w-10 h-10" />
          )}
        </Button>
        <span
          className={cn(
            "text-sm font-medium transition-colors",
            isListening ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {isListening ? "Ouvindo..." : "Toque para falar"}
        </span>
      </div>

      {/* Caixa de Resultado */}
      <div
        className={cn(
          "w-full min-h-[100px] p-6 rounded-xl border-2 flex items-center justify-center text-center transition-all",
          transcript 
            ? "bg-card border-primary/30" 
            : "bg-muted/30 border-dashed border-muted-foreground/30"
        )}
      >
        {error ? (
          <p className="text-destructive">{error}</p>
        ) : transcript ? (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Você disse:</p>
            <p className="text-2xl font-medium italic text-foreground">
              "{transcript}"
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground/60 italic">
            Sua fala aparecerá aqui...
          </p>
        )}
      </div>

      {/* Botões de ação */}
      <div className="w-full flex justify-between pt-4">
        <Button
          variant="ghost"
          onClick={resetTranscript}
          disabled={!transcript && !error}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Limpar
        </Button>
        <Button size="lg" onClick={handleNext}>
          Próximo
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>

      {/* Dica de teclado */}
      <p className="text-xs text-muted-foreground/50 text-center">
        Espaço = gravar • Enter = próximo
      </p>
    </div>
  );
}
