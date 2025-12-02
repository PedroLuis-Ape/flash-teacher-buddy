import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Volume2 } from "lucide-react";
import { pickLang } from "@/lib/speech";
import { useTTS } from "@/hooks/useTTS";
import pitecoSad from "@/assets/piteco-sad.png";
import pitecoHappy from "@/assets/piteco-happy.png";
import { SpeechRateControl } from "./SpeechRateControl";
import { HintButton } from "./HintButton";
import { awardPoints, REWARD_AMOUNTS } from "@/lib/rewardEngine";
import { supabase } from "@/integrations/supabase/client";

interface MultipleChoiceStudyViewProps {
  currentCard: {
    term: string;
    translation: string;
    hint?: string | null;
  };
  allCards: {
    term: string;
    translation: string;
  }[];
  direction: "pt-en" | "en-pt" | "any";
  onCorrect: () => void;
  onIncorrect: () => void;
}

export const MultipleChoiceStudyView = ({
  currentCard,
  allCards,
  direction,
  onCorrect,
  onIncorrect,
}: MultipleChoiceStudyViewProps) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const { speak } = useTTS();
  
  const isPtToEn = direction === "pt-en";

  const prompt = isPtToEn ? currentCard.term : currentCard.translation;
  const correctAnswer = isPtToEn ? currentCard.translation : currentCard.term;
  const promptLabel = isPtToEn ? "Português" : "English";
  const answerLabel = isPtToEn ? "English" : "Português";

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

    // Award points if correct
    if (index === correctIndex) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await awardPoints(session.user.id, REWARD_AMOUNTS.CORRECT_ANSWER, 'flashcard_correct');
      }
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
        <HintButton hint={currentCard.hint} className="absolute top-4 right-4" />
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
                  const side = direction === "pt-en" ? 'front' : 'back';
                  speak(prompt, { side });
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
