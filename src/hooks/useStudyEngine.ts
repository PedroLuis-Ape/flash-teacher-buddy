import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { awardPoints, REWARD_AMOUNTS } from "@/lib/rewardEngine";
import { FEATURE_FLAGS } from "@/lib/featureFlags";

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

// Batch size for quiz modes
const BATCH_SIZE = 10;

export function useStudyEngine(
  listId: string | undefined,
  flashcards: { id: string; term: string; translation: string }[],
  mode: "flip" | "multiple-choice" | "write" | "unscramble",
  unlimitedMode: boolean = false
) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardsOrder, setCardsOrder] = useState<string[]>([]);
  const [results, setResults] = useState<StudyResult[]>([]);
  const [startTime] = useState(Date.now());
  const [isFinished, setIsFinished] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Spaced Repetition Lite state
  const [unseenCards, setUnseenCards] = useState<string[]>([]);
  const [missedCards, setMissedCards] = useState<string[]>([]);
  const [roundNumber, setRoundNumber] = useState(1);
  const [roundResults, setRoundResults] = useState<StudyResult[]>([]);

  const isFlipMode = mode === "flip";
  const useAllCards = isFlipMode || unlimitedMode;

  const correctCount = results.filter((r) => r.correct && !r.skipped).length;
  const errorCount = results.filter((r) => !r.correct && !r.skipped).length;
  const skippedCount = results.filter((r) => r.skipped).length;
  const progress = cardsOrder.length > 0 ? ((currentIndex + 1) / cardsOrder.length) * 100 : 0;

  // Check if game is complete (all cards seen and correct)
  const isGameComplete = !isFlipMode && unseenCards.length === 0 && missedCards.length === 0 && roundNumber > 1;

  // Generate next round using Priority A + B algorithm
  const generateNextRound = useCallback(() => {
    const nextRound: string[] = [];
    
    // Priority A: All missed cards from previous rounds
    const missedToAdd = [...missedCards];
    nextRound.push(...missedToAdd.slice(0, BATCH_SIZE));
    
    // Priority B: Fill remaining slots with unseen cards
    const slotsRemaining = BATCH_SIZE - nextRound.length;
    if (slotsRemaining > 0 && unseenCards.length > 0) {
      const unseenToAdd = unseenCards.slice(0, slotsRemaining);
      nextRound.push(...unseenToAdd);
      
      // Remove from unseen pool
      setUnseenCards(prev => prev.filter(id => !unseenToAdd.includes(id)));
    }
    
    // Shuffle the round
    const shuffledRound = nextRound.sort(() => Math.random() - 0.5);
    setCardsOrder(shuffledRound);
    setCurrentIndex(0);
    setRoundNumber(prev => prev + 1);
    setRoundResults([]);
    setIsFinished(false);
    
    // Clear missed cards that are now in this round
    setMissedCards(prev => prev.filter(id => !shuffledRound.includes(id)));
    
    return shuffledRound;
  }, [missedCards, unseenCards]);

  // Load flip mode progress from localStorage
  const loadFlipProgress = useCallback(() => {
    if (!listId) return null;
    try {
      const saved = localStorage.getItem(`flip-progress-${listId}`);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading flip progress:', e);
    }
    return null;
  }, [listId]);

  // Save flip mode progress to localStorage
  const saveFlipProgress = useCallback(() => {
    if (!listId || !isFlipMode) return;
    try {
      localStorage.setItem(`flip-progress-${listId}`, JSON.stringify({
        index: currentIndex,
        knownCards: results.filter(r => r.correct).map(r => r.flashcardId),
        timestamp: Date.now(),
      }));
    } catch (e) {
      console.error('Error saving flip progress:', e);
    }
  }, [listId, isFlipMode, currentIndex, results]);

  // Initialize session
  const initializeSession = useCallback(async () => {
    if (flashcards.length === 0) {
      setIsLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsAuthenticated(false);
        let shuffledIds = flashcards
          .map(f => f.id)
          .sort(() => Math.random() - 0.5);
        
        if (!useAllCards) {
          // Initialize spaced repetition pools
          setUnseenCards(shuffledIds.slice(BATCH_SIZE));
          shuffledIds = shuffledIds.slice(0, BATCH_SIZE);
        }
        
        setCardsOrder(shuffledIds);
        setCurrentIndex(0);
        setIsLoading(false);
        return;
      }

      setIsAuthenticated(true);

      if (!listId) {
        setIsLoading(false);
        return;
      }

      // For flip mode, check for existing session in Supabase first, then localStorage
      if (isFlipMode) {
        // Try to restore from Supabase first
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
          setSessionId(existingSession.id);
          setCurrentIndex(existingSession.current_index);
          setCardsOrder(existingSession.cards_order as string[]);
          toast.success("Continuando de onde você parou!");
          setIsLoading(false);
          return;
        }

        // Fallback to localStorage if no Supabase session
        const savedProgress = loadFlipProgress();
        const orderedCards = await getPrioritizedFlashcards(user.id, listId, flashcards, true);
        
        // Create new session in Supabase for flip mode
        const { data: newSession, error } = await supabase
          .from('study_sessions')
          .insert({
            user_id: user.id,
            list_id: listId,
            mode,
            current_index: savedProgress?.index || 0,
            cards_order: orderedCards,
            completed: false
          })
          .select()
          .single();

        if (!error && newSession) {
          setSessionId(newSession.id);
        }
        
        setCardsOrder(orderedCards);
        
        if (savedProgress && savedProgress.index < orderedCards.length) {
          setCurrentIndex(savedProgress.index);
          // Restore known cards to results
          const restoredResults = savedProgress.knownCards?.map((id: string) => ({
            flashcardId: id,
            correct: true,
            skipped: false,
            attempts: 1,
          })) || [];
          setResults(restoredResults);
          toast.success("Continuando de onde você parou!");
        } else {
          setCurrentIndex(0);
        }
        setIsLoading(false);
        return;
      }

      // For quiz modes, check for existing session
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
        setSessionId(existingSession.id);
        setCurrentIndex(existingSession.current_index);
        setCardsOrder(existingSession.cards_order as string[]);
        toast.success("Continuando de onde você parou!");
        setIsLoading(false);
        return;
      }

      // Create new session with prioritized flashcards
      const orderedCards = await getPrioritizedFlashcards(user.id, listId, flashcards, false);
      
      // Initialize spaced repetition pools
      const allCardIds = flashcards.map(f => f.id).sort(() => Math.random() - 0.5);
      setUnseenCards(allCardIds.slice(BATCH_SIZE));
      
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
    } catch (error) {
      console.error('Erro ao inicializar sessão:', error);
      let shuffledIds = flashcards
        .map(f => f.id)
        .sort(() => Math.random() - 0.5);
      
      if (!useAllCards) {
        setUnseenCards(shuffledIds.slice(BATCH_SIZE));
        shuffledIds = shuffledIds.slice(0, BATCH_SIZE);
      }
      
      setCardsOrder(shuffledIds);
      setCurrentIndex(0);
    } finally {
      setIsLoading(false);
    }
  }, [listId, flashcards, mode, useAllCards, isFlipMode, loadFlipProgress]);

  // Prioritize flashcards with more errors
  const getPrioritizedFlashcards = async (
    userId: string,
    listId: string,
    cards: { id: string }[],
    useAll: boolean
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

      if (useAll) {
        return cardsWithProgress.map(c => c.id);
      }
      return cardsWithProgress.slice(0, BATCH_SIZE).map(c => c.id);
    } catch (error) {
      console.error('Erro ao priorizar flashcards:', error);
      let ids = cards
        .map(c => c.id)
        .sort(() => Math.random() - 0.5);
      
      if (!useAll) {
        ids = ids.slice(0, BATCH_SIZE);
      }
      return ids;
    }
  };

  // Save progress automatically
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

  // Record result and update flashcard progress
  const recordResult = useCallback(async (flashcardId: string, correct: boolean, skipped: boolean = false) => {
    // Update results
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

    // Update round results for spaced repetition
    setRoundResults((prev) => {
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

    // Track missed cards for spaced repetition (non-flip modes)
    if (!isFlipMode && !correct && !skipped) {
      setMissedCards(prev => 
        prev.includes(flashcardId) ? prev : [...prev, flashcardId]
      );
    } else if (!isFlipMode && correct) {
      // Remove from missed queue if they got it right
      setMissedCards(prev => prev.filter(id => id !== flashcardId));
    }

    if (!isAuthenticated || !listId || skipped) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Award points for correct answer
      if (correct && FEATURE_FLAGS.economy_enabled) {
        await awardPoints(user.id, REWARD_AMOUNTS.CORRECT_ANSWER, 'Resposta correta');
      }

      // Fetch existing progress
      const { data: existingProgress } = await supabase
        .from('flashcard_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('flashcard_id', flashcardId)
        .maybeSingle();

      if (existingProgress) {
        await supabase
          .from('flashcard_progress')
          .update({
            correct_count: correct ? existingProgress.correct_count + 1 : existingProgress.correct_count,
            incorrect_count: !correct ? existingProgress.incorrect_count + 1 : existingProgress.incorrect_count,
            last_reviewed: new Date().toISOString()
          })
          .eq('id', existingProgress.id);
      } else {
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
  }, [listId, isAuthenticated, isFlipMode]);

  const goToNext = useCallback(() => {
    if (currentIndex < cardsOrder.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsFinished(true);
      if (isFlipMode) {
        completeSession();
      }
      // For quiz modes, don't auto-complete - let user decide to continue or exit
    }
  }, [currentIndex, cardsOrder.length, isFlipMode]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  // Navigate without recording result (for arrow navigation in flip mode)
  const navigateNext = useCallback(() => {
    if (currentIndex < cardsOrder.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsFinished(true);
      if (isFlipMode) {
        completeSession();
      }
    }
  }, [currentIndex, cardsOrder.length, isFlipMode]);

  const navigatePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  // Start next round (for quiz modes)
  const startNextRound = useCallback(() => {
    if (isGameComplete) {
      toast.success("Parabéns! Você completou todos os cards! 🎉");
      return;
    }
    
    const newRound = generateNextRound();
    if (newRound.length === 0) {
      toast.success("Parabéns! Você completou todos os cards! 🎉");
      setIsFinished(true);
    } else {
      toast.info(`Rodada ${roundNumber + 1} iniciada!`);
    }
  }, [generateNextRound, isGameComplete, roundNumber]);

  const completeSession = async () => {
    if (!isAuthenticated) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user && FEATURE_FLAGS.economy_enabled) {
        await awardPoints(user.id, REWARD_AMOUNTS.SESSION_COMPLETE, 'Sessão completa');
      }

      if (sessionId) {
        await supabase
          .from('study_sessions')
          .update({ completed: true })
          .eq('id', sessionId);
      }

      // Update the parent list's updated_at to move it to the top of "Recentes"
      if (listId) {
        await supabase
          .from('lists')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', listId);

        // Also update the parent folder's updated_at
        const { data: listData } = await supabase
          .from('lists')
          .select('folder_id')
          .eq('id', listId)
          .single();

        if (listData?.folder_id) {
          await supabase
            .from('folders')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', listData.folder_id);
        }
      }

      // Clear flip mode progress
      if (isFlipMode && listId) {
        localStorage.removeItem(`flip-progress-${listId}`);
      }

      toast.success("Sessão de estudo concluída! 🎉");
    } catch (error) {
      console.error('Erro ao completar sessão:', error);
    }
  };

  // Reset session (start fresh)
  const resetSession = useCallback(() => {
    if (listId && isFlipMode) {
      localStorage.removeItem(`flip-progress-${listId}`);
    }
    setResults([]);
    setRoundResults([]);
    setMissedCards([]);
    setUnseenCards(flashcards.map(f => f.id).slice(BATCH_SIZE));
    setRoundNumber(1);
    setIsFinished(false);
    initializeSession();
  }, [listId, isFlipMode, flashcards, initializeSession]);

  // Initialize session on mount
  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  // Save progress on index change
  useEffect(() => {
    if (!isLoading && sessionId) {
      saveProgress();
    }
  }, [currentIndex, isLoading, sessionId, saveProgress]);

  // Save flip progress on index change
  useEffect(() => {
    if (!isLoading && isFlipMode) {
      saveFlipProgress();
    }
  }, [currentIndex, results, isLoading, isFlipMode, saveFlipProgress]);

  const currentCard = cardsOrder[currentIndex] 
    ? flashcards.find(f => f.id === cardsOrder[currentIndex])
    : null;

  // Calculate round stats
  const roundCorrect = roundResults.filter(r => r.correct && !r.skipped).length;
  const roundErrors = roundResults.filter(r => !r.correct && !r.skipped).length;
  const hasMoreRounds = unseenCards.length > 0 || missedCards.length > 0;

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
    totalCards: cardsOrder.length,
    recordResult,
    goToNext,
    goToPrevious,
    navigateNext,
    navigatePrevious,
    setCurrentIndex,
    canGoPrevious: currentIndex > 0,
    canGoNext: currentIndex < cardsOrder.length - 1,
    // Spaced repetition exports
    roundNumber,
    roundCorrect,
    roundErrors,
    hasMoreRounds,
    isGameComplete,
    startNextRound,
    resetSession,
    unseenCardsCount: unseenCards.length,
    missedCardsCount: missedCards.length,
  };
}
