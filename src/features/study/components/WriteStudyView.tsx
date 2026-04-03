import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lightbulb, Eye, SkipForward, Volume2, Star } from "lucide-react";
import { isAcceptableAnswer, getHint } from "@/lib/textMatch";
import { getDiffTokens } from "@/lib/diffHighlighter";
import { useTTS } from "@/features/study/hooks/useTTS";
import { resolveStudySides, toBCP47, getLangLabel } from "@/features/study/lib/resolveStudySides";
import { InteractiveText } from "./InteractiveText";
import type { MergedHint } from "@/features/study/lib/glossaryMerge";
import { isAlmostCorrect } from "@/lib/levenshtein";
import pitecoSad from "@/assets/piteco-sad.png";
import pitecoHappy from "@/assets/piteco-happy.png";
import { SpeechRateControl, getSpeechRate } from "./SpeechRateControl";
import { HintButton } from "./HintButton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { playCorrect, playWrong } from "@/lib/sfx";

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
  onToggleFavorite?: () => void;
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
  onToggleFavorite,
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
  
  // --- Centralized Side Resolution ---
  const sideA = { text: front, lang: langA, label: getLangLabel(langA), acceptedAnswers: acceptedAnswersEn };
  const sideB = { text: back, lang: langB, label: getLangLabel(langB), acceptedAnswers: acceptedAnswersPt };

  const { promptSide, answerSide, isAFirst } = resolveStudySides(sideA, sideB, direction, flashcardId || front);

  // word_hints contain bindings for both sides; segmentText auto-filters by text match
  const promptWordHints = wordHintsA;
  const promptMergedHints = isAFirst ? mergedHintsA : mergedHintsB;

  const prompt = promptSide.text;
  const correctAnswer = answerSide.text;
  const promptLabel = promptSide.label;
  const answerLabel = answerSide.label;

  const promptLang = toBCP47(promptSide.lang);

  const inputRef = useRef<HTMLInputElement>(null);
  const { speak } = useTTS();

  // TTS removed from autoplay - only plays on button click

  const acceptedAnswers = [
    correctAnswer,
    ...(answerSide.acceptedAnswers || []),
  ];

  useEffect(() => {
    setAnswer("");
    setFeedback(null);
    setHintLevel(0);
    setCurrentHint("");
    setRevealed(false);
    setShake(false);
    // Auto-focus with slight delay to ensure DOM is ready
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [front, back]);

  const handleSubmit = () => {
    // Preserva o texto original digitado pelo usuário
    const userOriginalAnswer = answer.trim();
    
    if (!userOriginalAnswer) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    // Check exact match first (case and space insensitive)
    const result = isAcceptableAnswer(userOriginalAnswer, acceptedAnswers);

    if (result.isCorrect) {
      setFeedback("correct");
      playCorrect();
    } else {
      // Verifica se está quase correto (typo tolerance via Levenshtein)
      const almostCorrect = acceptedAnswers.some(accepted => 
        isAlmostCorrect(userOriginalAnswer, accepted)
      );
      
      if (almostCorrect) {
        setFeedback("almost");
        playCorrect(); // Almost correct also plays success sound
        // Show typo warning
        toast.warning(`Correto! (Atenção ao erro de digitação: "${correctAnswer}")`, {
          duration: 3000,
        });
      } else {
        setFeedback("incorrect");
        playWrong();
      }
    }
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !feedback) {
      handleSubmit();
    }
  };

  // diff tokens no longer used – keeping import for potential future use

  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full max-w-2xl mx-auto">
      <Card className="p-4 sm:p-8 bg-gradient-to-br from-card to-muted/20 relative">
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1 sm:gap-2">
          {onToggleFavorite && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleFavorite}
              className={cn(
                "h-8 w-8 sm:h-9 sm:w-9 transition-colors",
                isFavorite ? "text-yellow-500 hover:text-yellow-600" : "text-muted-foreground hover:text-yellow-500"
              )}
              title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            >
              <Star className={cn("h-4 w-4 sm:h-5 sm:w-5", isFavorite && "fill-current")} />
            </Button>
          )}
          <HintButton hint={hint} />
        </div>
        <div className="text-center">
          <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">{promptLabel}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-8">
            <p className="text-xl sm:text-3xl font-semibold break-words max-w-full px-2">
              <InteractiveText text={prompt} wordHints={promptWordHints} mergedHints={promptMergedHints} speakOnHintClick speakLang={promptLang} />
            </p>
            <div className="flex items-center gap-1">
              <SpeechRateControl />
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
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">Traduza para {answerLabel}:</p>
        </div>
      </Card>

      {currentHint && (
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertDescription className="font-mono text-lg">
            {currentHint}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <Input
          ref={inputRef}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Digite sua resposta..."
          disabled={feedback !== null}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck="false"
          className={`text-lg h-14 transition-all duration-300 ${
            shake ? "animate-[shake_0.5s_ease-in-out]" : ""
          } ${
            feedback === "correct"
              ? "border-green-500 border-2 bg-green-50 dark:bg-green-950"
              : feedback === "almost"
              ? "border-yellow-500 border-2 bg-yellow-50 dark:bg-yellow-950"
              : feedback === "incorrect"
              ? "border-red-500 border-2 bg-red-50 dark:bg-red-950"
              : ""
          }`}
          style={{ fontSize: '1.125rem' }}
        />

        {feedback === "correct" && (
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
                  <span className="font-semibold">{correctAnswer}</span>
                  {acceptedAnswers.length > 1 && (
                    <>
                      <br />
                      <span className="text-sm">
                        Outras respostas: {acceptedAnswers.slice(1).join(", ")}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {feedback === "almost" && (
          <Alert className="border-warning bg-warning/10 animate-fade-in">
            <AlertDescription className="text-warning-foreground">
              <div className="flex items-start gap-4">
                <img 
                  src={pitecoHappy} 
                  alt="Piteco quase feliz" 
                  className="w-16 h-16 object-contain flex-shrink-0"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-lg font-semibold mb-2">
                    <span className="text-2xl">⚠</span>
                    Quase perfeito!
                  </div>
                  Você escreveu <span className="font-semibold">"{answer.trim()}"</span>, mas o correto seria <span className="font-semibold">"{correctAnswer}"</span>.
                  <br />
                  <span className="text-sm mt-2 block">
                    Faltou ou sobrou apenas 1 caractere. Vamos considerar como acerto!
                  </span>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {feedback === "incorrect" && (
          <Alert className="border-destructive bg-red-50 dark:bg-red-950 animate-fade-in">
            <AlertDescription className="text-red-700 dark:text-red-300">
              <div className="flex items-start gap-3 sm:gap-4">
                <img 
                  src={pitecoSad} 
                  alt="Piteco triste" 
                  className="w-12 h-12 sm:w-16 sm:h-16 object-contain flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-base sm:text-lg font-semibold mb-2">
                    <span className="text-xl sm:text-2xl">✗</span>
                    Incorreto
                  </div>
                  <div className="space-y-2 text-sm sm:text-base">
                    <div className="p-2 rounded bg-red-100 dark:bg-red-900/50 break-words">
                      <span className="text-muted-foreground text-xs block mb-0.5">Você digitou:</span>
                      <span className="line-through opacity-75">{answer.trim()}</span>
                    </div>
                    <div className="p-2 rounded bg-green-100 dark:bg-green-900/50 break-words">
                      <span className="text-muted-foreground text-xs block mb-0.5">Correto:</span>
                      <span className="font-semibold text-green-800 dark:text-green-200">{correctAnswer}</span>
                    </div>
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {feedback === null && (
        <div className="grid grid-cols-[1fr_auto_1fr] sm:flex sm:flex-row gap-2 sm:gap-3 sticky bottom-4 bg-background/95 backdrop-blur-sm p-2 rounded-lg shadow-lg z-10 items-center">
          <Button variant="outline" onClick={onSkip} className="min-h-[44px] text-sm">
            <SkipForward className="mr-1 h-4 w-4" />
            Pular
          </Button>
          <Button variant="secondary" onClick={handleHint} disabled={revealed} className="min-h-[44px] text-sm">
            <Lightbulb className="mr-1 h-4 w-4" />
            Dica
          </Button>
          <Button onClick={handleSubmit} className="min-h-[44px] text-sm sm:ml-auto" size="lg">
            Corrigir
          </Button>
        </div>
      )}

      {(feedback === "correct" || feedback === "almost") && (
        <div className="flex justify-end">
          <Button 
            onClick={onCorrect} 
            size="lg" 
            className={feedback === "almost" ? "bg-yellow-600 hover:bg-yellow-700" : "bg-green-600 hover:bg-green-700"}
          >
            Próximo
          </Button>
        </div>
      )}

      {feedback === "incorrect" && (
        <div className="flex justify-end">
          <Button onClick={onIncorrect} variant="destructive" size="lg">
            Continuar
          </Button>
        </div>
      )}
    </div>
  );
};
