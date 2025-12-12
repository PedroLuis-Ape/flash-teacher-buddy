import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lightbulb, Eye, SkipForward, Volume2, Star } from "lucide-react";
import { isAcceptableAnswer, getHint } from "@/lib/textMatch";
import { getDiffTokens } from "@/lib/diffHighlighter";
import { useTTS } from "@/hooks/useTTS";
import { isAlmostCorrect } from "@/lib/levenshtein";
import pitecoSad from "@/assets/piteco-sad.png";
import pitecoHappy from "@/assets/piteco-happy.png";
import { SpeechRateControl, getSpeechRate } from "./SpeechRateControl";
import { HintButton } from "./HintButton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useToggleFavorite, useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";
import { playCorrect, playWrong } from "@/lib/sfx";

interface WriteStudyViewProps {
  front: string;
  back: string;
  hint?: string | null;
  flashcardId?: string;
  acceptedAnswersEn?: string[];
  acceptedAnswersPt?: string[];
  direction: "pt-en" | "en-pt" | "any";
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
  direction,
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
  const [userId, setUserId] = useState<string | undefined>();
  const [isPtToEn] = useState(() => 
    direction === "pt-en" || (direction === "any" && Math.random() > 0.5)
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const { speak } = useTTS();
  const toggleFavorite = useToggleFavorite();
  const { data: favorites = [] } = useFavorites(userId);
  
  const isFavorite = flashcardId ? favorites.includes(flashcardId) : false;

  const prompt = isPtToEn ? front : back;
  const correctAnswer = isPtToEn ? back : front;
  const promptLabel = isPtToEn ? "Português" : "English";
  const answerLabel = isPtToEn ? "English" : "Português";
  const promptLang = isPtToEn ? "pt-BR" : "en-US";
  const acceptedAnswers = [
    correctAnswer,
    ...(isPtToEn ? acceptedAnswersEn : acceptedAnswersPt),
  ];

  // Fetch user ID for favorites
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
    };
    fetchUser();
  }, []);

  // Autoplay audio when card changes
  useEffect(() => {
    if (prompt) {
      const rate = getSpeechRate();
      speak(prompt, { langOverride: promptLang as "pt-BR" | "en-US", rate });
    }
  }, [front, back, prompt]);

  const handleToggleFavorite = () => {
    if (!flashcardId || !userId) return;
    toggleFavorite.mutate({ flashcardId, isFavorite });
  };

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

  const diffTokens = feedback === "incorrect" ? getDiffTokens(answer, correctAnswer) : [];

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      <Card className="p-8 bg-gradient-to-br from-card to-muted/20 relative">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {userId && flashcardId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleFavorite}
              disabled={toggleFavorite.isPending}
              className={cn(
                "transition-colors",
                isFavorite ? "text-yellow-500 hover:text-yellow-600" : "text-muted-foreground hover:text-yellow-500"
              )}
              title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            >
              <Star className={cn("h-5 w-5", isFavorite && "fill-current")} />
            </Button>
          )}
          <HintButton hint={hint} />
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">{promptLabel}</p>
          <div className="flex items-center justify-center gap-3 mb-8">
            <p className="text-3xl font-semibold">{prompt}</p>
            <div className="flex items-center gap-2">
              <SpeechRateControl />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const rate = getSpeechRate();
                  speak(prompt, { langOverride: promptLang as "pt-BR" | "en-US", rate });
                }}
              >
                <Volume2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Traduza para {answerLabel}:</p>
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
                  Compare sua resposta com o gabarito:
                  <br />
                  <div className="mt-2 font-mono text-base">
                    <div>
                      Você digitou:{" "}
                      {diffTokens.map((token, idx) => (
                        <span
                          key={idx}
                          className={
                            token.type === "insert"
                              ? "bg-red-200 dark:bg-red-900 line-through"
                              : ""
                          }
                        >
                          {token.text}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1">
                      Correto: <span className="font-semibold">{correctAnswer}</span>
                    </div>
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {feedback === null && (
        <div className="flex gap-3 flex-wrap sticky bottom-4 bg-background/95 backdrop-blur-sm p-2 rounded-lg shadow-lg z-10">
          <Button variant="outline" onClick={onSkip} className="min-h-[44px]">
            <SkipForward className="mr-2 h-4 w-4" />
            Pular
          </Button>
          <Button variant="secondary" onClick={handleHint} disabled={revealed} className="min-h-[44px]">
            <Lightbulb className="mr-2 h-4 w-4" />
            Dica {hintLevel > 0 && `(${hintLevel}/3)`}
          </Button>
          {revealed && (
            <Button variant="ghost" disabled className="min-h-[44px]">
              <Eye className="mr-2 h-4 w-4" />
              Revelado
            </Button>
          )}
          <Button onClick={handleSubmit} className="ml-auto min-h-[44px]" size="lg">
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
