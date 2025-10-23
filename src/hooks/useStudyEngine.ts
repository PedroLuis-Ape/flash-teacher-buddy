import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface StudyResult {
  flashcardId: string;
  correct: boolean;
  skipped: boolean;
  attempts: number;
}

export interface StudySession {
  collectionId: string;
  mode: "flip" | "write" | "mixed";
  direction: "pt-en" | "en-pt" | "any";
  results: StudyResult[];
  startTime: number;
  endTime?: number;
}

interface FlashcardWithProgress {
  id: string;
  term: string;
  translation: string;
  incorrectCount: number;
  lastReviewed: string | null;
}

export function useStudyEngine(
  listId: string | undefined,
  flashcards: { id: string; term: string; translation: string }[],
  mode: "flip" | "multiple-choice" | "write" | "unscramble"
) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardsOrder, setCardsOrder] = useState<string[]>([]);
  const [results, setResults] = useState<StudyResult[]>([]);
  const [startTime] = useState(Date.now());
  const [isFinished, setIsFinished] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const correctCount = results.filter((r) => r.correct && !r.skipped).length;
  const errorCount = results.filter((r) => !r.correct && !r.skipped).length;
  const skippedCount = results.filter((r) => r.skipped).length;
  const progress = cardsOrder.length > 0 ? ((currentIndex + 1) / cardsOrder.length) * 100 : 0;

  // Carregar ou criar sessão de estudo
  const initializeSession = useCallback(async () => {
    if (!listId || flashcards.length === 0) {
      setIsLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Verificar se existe sessão não completa
      const { data: existingSession } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('list_id', listId)
        .eq('mode', mode)
        .eq('completed', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSession) {
        // Continuar sessão existente
        setSessionId(existingSession.id);
        setCurrentIndex(existingSession.current_index);
        setCardsOrder(existingSession.cards_order as string[]);
        toast.success("Continuando de onde você parou!");
      } else {
        // Criar nova sessão com flashcards priorizados
        const orderedCards = await getPrioritizedFlashcards(user.id, listId, flashcards);
        
        const { data: newSession, error } = await supabase
          .from('study_sessions')
          .insert({
            user_id: user.id,
            list_id: listId,
            mode,
            current_index: 0,
            cards_order: orderedCards,
            completed: false
          })
          .select()
          .single();

        if (error) throw error;

        setSessionId(newSession.id);
        setCardsOrder(orderedCards);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error('Erro ao inicializar sessão:', error);
    } finally {
      setIsLoading(false);
    }
  }, [listId, flashcards, mode]);

  // Priorizar flashcards com mais erros
  const getPrioritizedFlashcards = async (
    userId: string,
    listId: string,
    cards: { id: string }[]
  ): Promise<string[]> => {
    try {
      const { data: progressData } = await supabase
        .from('flashcard_progress')
        .select('flashcard_id, incorrect_count')
        .eq('user_id', userId)
        .eq('list_id', listId);

      const progressMap = new Map(
        progressData?.map(p => [p.flashcard_id, p.incorrect_count]) || []
      );

      // Ordenar: cards com mais erros primeiro, depois aleatório
      const cardsWithProgress = cards.map(card => ({
        id: card.id,
        incorrectCount: progressMap.get(card.id) || 0
      }));

      cardsWithProgress.sort((a, b) => {
        if (b.incorrectCount !== a.incorrectCount) {
          return b.incorrectCount - a.incorrectCount;
        }
        return Math.random() - 0.5;
      });

      return cardsWithProgress.map(c => c.id);
    } catch (error) {
      console.error('Erro ao priorizar flashcards:', error);
      return cards.map(c => c.id).sort(() => Math.random() - 0.5);
    }
  };

  // Salvar progresso automaticamente
  const saveProgress = useCallback(async () => {
    if (!sessionId || !listId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('study_sessions')
        .update({
          current_index: currentIndex,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
    } catch (error) {
      console.error('Erro ao salvar progresso:', error);
    }
  }, [sessionId, currentIndex, listId]);

  // Registrar resultado e atualizar progresso do flashcard
  const recordResult = useCallback(async (flashcardId: string, correct: boolean, skipped: boolean = false) => {
    setResults((prev) => {
      const existing = prev.find((r) => r.flashcardId === flashcardId);
      if (existing) {
        return prev.map((r) =>
          r.flashcardId === flashcardId
            ? { ...r, correct, skipped, attempts: r.attempts + 1 }
            : r
        );
      }
      return [...prev, { flashcardId, correct, skipped, attempts: 1 }];
    });

    if (!listId || skipped) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar progresso existente
      const { data: existingProgress } = await supabase
        .from('flashcard_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('flashcard_id', flashcardId)
        .maybeSingle();

      if (existingProgress) {
        // Atualizar progresso existente
        await supabase
          .from('flashcard_progress')
          .update({
            correct_count: correct ? existingProgress.correct_count + 1 : existingProgress.correct_count,
            incorrect_count: !correct ? existingProgress.incorrect_count + 1 : existingProgress.incorrect_count,
            last_reviewed: new Date().toISOString()
          })
          .eq('id', existingProgress.id);
      } else {
        // Criar novo progresso
        await supabase
          .from('flashcard_progress')
          .insert({
            user_id: user.id,
            flashcard_id: flashcardId,
            list_id: listId,
            correct_count: correct ? 1 : 0,
            incorrect_count: !correct ? 1 : 0,
            last_reviewed: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error('Erro ao registrar resultado:', error);
    }
  }, [listId]);

  const goToNext = useCallback(() => {
    if (currentIndex < cardsOrder.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsFinished(true);
      completeSession();
    }
  }, [currentIndex, cardsOrder.length]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const completeSession = async () => {
    if (!sessionId) return;

    try {
      await supabase
        .from('study_sessions')
        .update({ completed: true })
        .eq('id', sessionId);

      toast.success("Sessão de estudo concluída! 🎉");
    } catch (error) {
      console.error('Erro ao completar sessão:', error);
    }
  };

  // Inicializar sessão ao montar
  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  // Salvar progresso a cada mudança de índice
  useEffect(() => {
    if (!isLoading && sessionId) {
      saveProgress();
    }
  }, [currentIndex, isLoading, sessionId, saveProgress]);

  const currentCard = cardsOrder[currentIndex] 
    ? flashcards.find(f => f.id === cardsOrder[currentIndex])
    : null;

  return {
    currentIndex,
    progress,
    correctCount,
    errorCount,
    skippedCount,
    results,
    isFinished,
    isLoading,
    currentCard,
    cardsOrder,
    recordResult,
    goToNext,
    goToPrevious,
    setCurrentIndex,
  };
}
