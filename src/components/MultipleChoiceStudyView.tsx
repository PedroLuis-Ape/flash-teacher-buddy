import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Volume2, Star } from "lucide-react";
import { useTTS } from "@/hooks/useTTS";
import pitecoSad from "@/assets/piteco-sad.png";
import pitecoHappy from "@/assets/piteco-happy.png";
import { SpeechRateControl, getSpeechRate } from "./SpeechRateControl";
import { HintButton } from "./HintButton";
import { awardPoints, REWARD_AMOUNTS } from "@/lib/rewardEngine";
import { supabase } from "@/integrations/supabase/client";
import { useToggleFavorite, useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";
import { playCorrect, playWrong } from "@/lib/sfx";

interface MultipleChoiceStudyViewProps {
  currentCard: {
    id?: string;
    term: string;
    translation: string;
    hint?: string | null;
  };
  allCards: {
    term: string;
    translation: string;
  }[];
  direction: "pt-en" | "en-pt" | "any";
  langA?: string; // ISO code e.g. "en", "fr"
  langB?: string; // ISO code e.g. "pt", "de"
  onCorrect: () => void;
  onIncorrect: () => void;
}

export const MultipleChoiceStudyView = ({
  currentCard,
  allCards,
  direction,
  langA = "en",
  langB = "pt",
  onCorrect,
  onIncorrect,
}: MultipleChoiceStudyViewProps) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [userId, setUserId] = useState<string | undefined>();
  const { speak } = useTTS();
  const toggleFavorite = useToggleFavorite();
  const { data: favorites = [] } = useFavorites(userId, 'flashcard');
  
  const isFavorite = currentCard.id ? favorites.includes(currentCard.id) : false;
  
  // FIXED: Derive isPtToEn dynamically per card (handles "any" mode)
  const isPtToEn = useMemo(() => {
    if (direction === "pt-en") return true;
    if (direction === "en-pt") return false;
    // For "any" mode, use card id to determine direction deterministically
    const hash = (currentCard.id || currentCard.term).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return hash % 2 === 0;
  }, [direction, currentCard.id, currentCard.term]);

  const prompt = isPtToEn ? currentCard.term : currentCard.translation;
  const correctAnswer = isPtToEn ? currentCard.translation : currentCard.term;
  
  // Dynamic labels based on langA/langB props
  const getLangLabel = (code: string): string => {
    const labels: Record<string, string> = {
      "en": "English", "pt": "Português", "es": "Español", "fr": "Français",
      "de": "Deutsch", "it": "Italiano", "ja": "日本語", "zh": "中文",
      "ko": "한국어", "ru": "Русский", "ar": "العربية", "hi": "हिन्दी"
    };
    return labels[code] || code.toUpperCase();
  };
  
  const promptLabel = isPtToEn ? getLangLabel(langA) : getLangLabel(langB);
  const answerLabel = isPtToEn ? getLangLabel(langB) : getLangLabel(langA);
  
  // Dynamic TTS language - map short codes to BCP-47
  const toBCP47 = (code: string): string => {
    const map: Record<string, string> = {
      "en": "en-US", "pt": "pt-BR", "es": "es-ES", "fr": "fr-FR",
      "de": "de-DE", "it": "it-IT", "ja": "ja-JP", "zh": "zh-CN",
      "ko": "ko-KR", "ru": "ru-RU", "ar": "ar-SA", "hi": "hi-IN"
    };
    return map[code] || code;
  };
  const promptLang = isPtToEn ? toBCP47(langA) : toBCP47(langB);

  // Fetch user ID for favorites
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
    };
    fetchUser();
  }, []);

  // TTS removed from autoplay - only plays on button click

  const handleToggleFavorite = () => {
    if (!currentCard.id || !userId) return;
    toggleFavorite.mutate({ resourceId: currentCard.id, resourceType: 'flashcard', isFavorite });
  };

  useEffect(() => {
    // Gerar 3 alternativas incorretas
    const wrongOptions = allCards
      .filter(card => 
        isPtToEn 
          ? card.translation !== currentCard.translation 
          : card.term !== currentCard.term
      )
      .map(card => isPtToEn ? card.translation : card.term);

    // Embaralhar e pegar 3
    const shuffledWrong = wrongOptions.sort(() => Math.random() - 0.5).slice(0, 3);

    // Adicionar a resposta correta
    const allOptions = [...shuffledWrong, correctAnswer];

    // Embaralhar todas as opções
    const shuffled = allOptions.sort(() => Math.random() - 0.5);
    
    setOptions(shuffled);
    setCorrectIndex(shuffled.indexOf(correctAnswer));
    setSelectedOption(null);
    setShowFeedback(false);
  }, [currentCard, allCards, isPtToEn]);

  const handleOptionClick = async (index: number) => {
    if (showFeedback) return; // Prevenir cliques após resposta

    setSelectedOption(index);
    setShowFeedback(true);

    // Award points and play sound if correct
    if (index === correctIndex) {
      playCorrect();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await awardPoints(session.user.id, REWARD_AMOUNTS.CORRECT_ANSWER, 'flashcard_correct');
      }
    } else {
      playWrong();
    }

    // Dar feedback visual antes de avançar
    setTimeout(() => {
      if (index === correctIndex) {
        onCorrect();
      } else {
        onIncorrect();
      }
    }, 2000);
  };

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
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      <Card className="p-8 bg-gradient-to-br from-card to-muted/20 relative">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {userId && currentCard.id && (
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
          <HintButton hint={currentCard.hint} />
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">{promptLabel}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
            <p className="text-2xl sm:text-3xl font-semibold break-words max-w-full px-2">{prompt}</p>
            <div className="flex items-center gap-2">
              <SpeechRateControl />
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0"
                onClick={() => {
                  const rate = getSpeechRate();
                  speak(prompt, { langOverride: promptLang as "pt-BR" | "en-US", rate });
                }}
              >
                <Volume2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground break-words px-2">Escolha a tradução em {answerLabel}:</p>
        </div>
      </Card>

      <div className="grid gap-3">
        {options.map((option, index) => (
          <Card
            key={index}
            className={`p-6 cursor-pointer transition-all ${getOptionClassName(index)}`}
            onClick={() => handleOptionClick(index)}
          >
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold">
                {String.fromCharCode(65 + index)}
              </div>
              <p className="text-lg font-medium">{option}</p>
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
    </div>
  );
};
