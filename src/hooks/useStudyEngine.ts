import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { awardPoints, REWARD_AMOUNTS } from "@/lib/rewardEngine";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { useListActivity } from "@/hooks/useListActivity";

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

export interface GameSettings {
  mode: 'sequential' | 'random';
  subset: 'all' | 'favorites';
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
  unlimitedMode: boolean = false,
  favoriteIds: string[] = []
) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardsOrder, setCardsOrder] = useState<string[]>([]);
  const [results, setResults] = useState<StudyResult[]>([]);
  const [startTime] = useState(Date.now());
  const [isFinished, setIsFinished] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Refs for preventing duplicate init, debouncing saves, and batching progress
  const lastInitSignatureRef = useRef<string>("");
  const saveProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressBufferRef = useRef<Map<string, { correct: boolean; timestamp: number }>>(new Map());
  const flushProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFlushRef = useRef<number>(0);

  // Game settings state
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    mode: 'random',
    subset: 'all'
  });

  // Spaced Repetition Lite state
  const [unseenCards, setUnseenCards] = useState<string[]>([]);
  const [missedCards, setMissedCards] = useState<string[]>([]);
  const [roundNumber, setRoundNumber] = useState(1);
  const [roundResults, setRoundResults] = useState<StudyResult[]>([]);

  const isFlipMode = mode === "flip";
  const useAllCards = isFlipMode || unlimitedMode;

  // List activity tracking
  const { trackListOpened, trackListStudied } = useListActivity();

  // Create stable signature from flashcard IDs to detect meaningful changes
  const cardsSignature = useMemo(() => 
    flashcards.map(c => c.id).sort().join("|"), 
    [flashcards]
  );

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

  // Initialize session - guards against duplicate calls
  const initializeSession = useCallback(async () => {
    // Skip if already initialized with same signature
    const initKey = `${listId}|${mode}|${cardsSignature}`;
    if (lastInitSignatureRef.current === initKey) {
      return;
    }
    
    if (flashcards.length === 0) {
      setIsLoading(false);
      return;
    }
    
    // Mark as initializing with this signature
    lastInitSignatureRef.current = initKey;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsAuthenticated(false);
        
        // For flip mode without auth: use EXACT order from flashcards (already ordered by Study.tsx)
        if (isFlipMode) {
          const orderedIds = flashcards.map(f => f.id);
          setCardsOrder(orderedIds);
          setCurrentIndex(0);
          setIsLoading(false);
          return;
        }
        
        // For quiz modes without auth: shuffle and batch
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

      // Track that the user opened this list
      trackListOpened(listId);

      // For flip mode: use EXACT order from flashcards (Study.tsx already applied random/sequential)
      if (isFlipMode) {
        // Try to restore from Supabase first (for session continuity)
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
        
        // CRITICAL FIX: Use the exact order from flashcards passed by Study.tsx
        // Study.tsx already applied random/sequential ordering before passing here
        const orderedCards = flashcards.map(f => f.id);
        
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
  }, [listId, cardsSignature, mode, useAllCards, isFlipMode, loadFlipProgress]);
  
  // Store flashcards in a ref for stable access
  const flashcardsRef = useRef(flashcards);
  useEffect(() => {
    flashcardsRef.current = flashcards;
  }, [flashcards]);

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

  // Save progress with debounce to reduce DB writes
  const saveProgress = useCallback(async () => {
    // Clear any pending save
    if (saveProgressTimeoutRef.current) {
      clearTimeout(saveProgressTimeoutRef.current);
    }
    
    // Debounce by 500ms
    saveProgressTimeoutRef.current = setTimeout(async () => {
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
    }, 500);
  }, [sessionId, currentIndex, listId]);

  // Flush buffered progress to database
  const flushProgressBuffer = useCallback(async () => {
    if (progressBufferRef.current.size === 0) return;
    if (!listId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const entries = Array.from(progressBufferRef.current.entries());
      progressBufferRef.current.clear();
      lastFlushRef.current = Date.now();

      // Fetch existing progress for all cards in batch
      const flashcardIds = entries.map(([id]) => id);
      const { data: existingProgress } = await supabase
        .from('flashcard_progress')
        .select('id, flashcard_id, correct_count, incorrect_count')
        .eq('user_id', user.id)
        .in('flashcard_id', flashcardIds);

      const existingMap = new Map(
        (existingProgress || []).map(p => [p.flashcard_id, p])
      );

      const toUpdate: any[] = [];
      const toInsert: any[] = [];

      for (const [flashcardId, { correct }] of entries) {
        const existing = existingMap.get(flashcardId);
        if (existing) {
          toUpdate.push({
            id: existing.id,
            correct_count: correct ? existing.correct_count + 1 : existing.correct_count,
            incorrect_count: !correct ? existing.incorrect_count + 1 : existing.incorrect_count,
            last_reviewed: new Date().toISOString()
          });
        } else {
          toInsert.push({
            user_id: user.id,
            flashcard_id: flashcardId,
            list_id: listId,
            correct_count: correct ? 1 : 0,
            incorrect_count: !correct ? 1 : 0,
            last_reviewed: new Date().toISOString()
          });
        }
      }

      // Batch update existing records
      if (toUpdate.length > 0) {
        for (const record of toUpdate) {
          await supabase
            .from('flashcard_progress')
            .update({
              correct_count: record.correct_count,
              incorrect_count: record.incorrect_count,
              last_reviewed: record.last_reviewed
            })
            .eq('id', record.id);
        }
      }

      // Batch insert new records
      if (toInsert.length > 0) {
        await supabase
          .from('flashcard_progress')
          .insert(toInsert);
      }
    } catch (error) {
      console.error('Erro ao salvar progresso em batch:', error);
    }
  }, [listId]);

  // Schedule flush with debounce (every 5 seconds or 10 cards)
  const scheduleFlush = useCallback(() => {
    const FLUSH_INTERVAL_MS = 5000; // 5 seconds
    const FLUSH_CARD_THRESHOLD = 10;

    // Clear existing timeout
    if (flushProgressTimeoutRef.current) {
      clearTimeout(flushProgressTimeoutRef.current);
    }

    // Flush immediately if buffer is large enough
    if (progressBufferRef.current.size >= FLUSH_CARD_THRESHOLD) {
      flushProgressBuffer();
      return;
    }

    // Otherwise schedule a flush
    flushProgressTimeoutRef.current = setTimeout(() => {
      flushProgressBuffer();
    }, FLUSH_INTERVAL_MS);
  }, [flushProgressBuffer]);

  // Record result and buffer flashcard progress for batch save
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

    // Track study activity (debounced by the hook)
    trackListStudied(listId);

    // Award points immediately (important for feedback)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && correct && FEATURE_FLAGS.economy_enabled) {
        await awardPoints(user.id, REWARD_AMOUNTS.CORRECT_ANSWER, 'Resposta correta');
      }
    } catch (error) {
      console.error('Erro ao atribuir pontos:', error);
    }

    // Buffer the progress update instead of writing immediately
    progressBufferRef.current.set(flashcardId, { correct, timestamp: Date.now() });
    scheduleFlush();
  }, [listId, isAuthenticated, isFlipMode, trackListStudied, scheduleFlush]);

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

  const completeSession = useCallback(async () => {
    if (!isAuthenticated) return;

    // Flush any pending progress updates before completing
    await flushProgressBuffer();

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
  }, [isAuthenticated, flushProgressBuffer, sessionId, listId, isFlipMode]);

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

  // Restart session with new settings
  const restartSession = useCallback((newSettings?: Partial<GameSettings>) => {
    const settings = { ...gameSettings, ...newSettings };
    setGameSettings(settings);

    // Get base cards
    let baseCards = [...flashcards];

    // Filter by favorites if selected
    if (settings.subset === 'favorites' && favoriteIds.length > 0) {
      baseCards = baseCards.filter(card => favoriteIds.includes(card.id));
    }

    if (baseCards.length === 0) {
      toast.error('Nenhum card encontrado com os filtros selecionados');
      return;
    }

    // Get card IDs
    let cardIds = baseCards.map(f => f.id);

    // Apply ordering
    if (settings.mode === 'random') {
      cardIds = cardIds.sort(() => Math.random() - 0.5);
    }

    // Reset state
    if (listId && isFlipMode) {
      localStorage.removeItem(`flip-progress-${listId}`);
    }

    setCardsOrder(cardIds);
    setCurrentIndex(0);
    setResults([]);
    setRoundResults([]);
    setMissedCards([]);
    setUnseenCards(cardIds.slice(BATCH_SIZE));
    setRoundNumber(1);
    setIsFinished(false);

    toast.success('Jogo reiniciado!');
  }, [gameSettings, flashcards, favoriteIds, listId, isFlipMode]);

  // Initialize session on mount
  useEffect(() => {
    initializeSession();
  }, [listId, cardsSignature, mode]); // Only reinit on meaningful changes

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

  // Cleanup: flush progress buffer on unmount
  useEffect(() => {
    return () => {
      // Clear scheduled flush
      if (flushProgressTimeoutRef.current) {
        clearTimeout(flushProgressTimeoutRef.current);
      }
      // Flush any remaining buffered progress
      if (progressBufferRef.current.size > 0) {
        flushProgressBuffer();
      }
    };
  }, [flushProgressBuffer]);

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
    restartSession,
    gameSettings,
    setGameSettings,
    unseenCardsCount: unseenCards.length,
    missedCardsCount: missedCards.length,
  };
}
