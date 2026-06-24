import { readFileSync, writeFileSync } from "node:fs";

function patchFile(path, patches) {
  let source = readFileSync(path, "utf8");
  for (const { label, search, replacement } of patches) {
    const count = source.split(search).length - 1;
    if (count !== 1) {
      throw new Error(`${path}: expected one patch point for ${label}, found ${count}`);
    }
    source = source.replace(search, replacement);
  }
  writeFileSync(path, source, "utf8");
}

patchFile("src/features/study/hooks/useStudyEngine.ts", [
  {
    label: "snapshot import",
    search: `import {\n  buildCanonicalToPlayableMap,\n  mapCanonicalIdsToPlayable,\n} from "@/features/cards/lib/cardStatusIdentity";\n`,
    replacement: `import {\n  buildCanonicalToPlayableMap,\n  mapCanonicalIdsToPlayable,\n} from "@/features/cards/lib/cardStatusIdentity";\nimport {\n  buildStudySnapshotKey,\n  clearStudySnapshot,\n  readStudySnapshot,\n  writeStudySnapshot,\n} from "@/features/study/lib/studySessionSnapshot";\n`,
  },
  {
    label: "user scope argument",
    search: `  initialSettings?: Partial<GameSettings>,\n  redListIds: string[] = []\n) {\n`,
    replacement: `  initialSettings?: Partial<GameSettings>,\n  redListIds: string[] = [],\n  userScope?: string | null,\n) {\n`,
  },
  {
    label: "busy states",
    search: `  const [isLoading, setIsLoading] = useState(true);\n  const [isAuthenticated, setIsAuthenticated] = useState(false);\n`,
    replacement: `  const [isLoading, setIsLoading] = useState(true);\n  const [isAuthenticated, setIsAuthenticated] = useState(false);\n  const [isCompleting, setIsCompleting] = useState(false);\n  const [isRestarting, setIsRestarting] = useState(false);\n`,
  },
  {
    label: "completion guard",
    search: `  const authUserIdRef = useRef<string | null>(null);\n`,
    replacement: `  const authUserIdRef = useRef<string | null>(userScope ?? null);\n  const completionInFlightRef = useRef(false);\n`,
  },
  {
    label: "snapshot key",
    search: `  const sessionScopeKey = useMemo(() => {\n    const sub = gameSettings.subset ?? 'all';\n    const order = gameSettings.mode ?? 'random';\n    const red = gameSettings.redFocus ? 'red' : 'normal';\n    return \`${'${sub}:${order}:${red}'}\`;\n  }, [gameSettings.subset, gameSettings.mode, gameSettings.redFocus]);\n`,
    replacement: `  const sessionScopeKey = useMemo(() => {\n    const sub = gameSettings.subset ?? 'all';\n    const order = gameSettings.mode ?? 'random';\n    const red = gameSettings.redFocus ? 'red' : 'normal';\n    return \`${'${sub}:${order}:${red}'}\`;\n  }, [gameSettings.subset, gameSettings.mode, gameSettings.redFocus]);\n\n  const studySnapshotKey = useMemo(() => buildStudySnapshotKey({\n    userScope: userScope || 'anon',\n    listId,\n    mode,\n    sessionScopeKey,\n    cardsSignature,\n  }), [userScope, listId, mode, sessionScopeKey, cardsSignature]);\n`,
  },
  {
    label: "legacy flip scope",
    search: `  const flipProgressKey = useMemo(() => {\n    const uid = authUserIdRef.current ?? 'anon';\n    return \`flip-progress-${'${uid}'}-${'${listId ?? \'no-list\'}'}-${'${mode}'}-${'${sessionScopeKey}'}\`;\n  }, [listId, mode, sessionScopeKey]);\n`,
    replacement: `  const flipProgressKey = useMemo(() => {\n    const uid = userScope || 'anon';\n    return \`flip-progress-${'${uid}'}-${'${listId ?? \'no-list\'}'}-${'${mode}'}-${'${sessionScopeKey}'}\`;\n  }, [userScope, listId, mode, sessionScopeKey]);\n`,
  },
  {
    label: "load snapshot after auth",
    search: `      const { data: { user } } = await supabase.auth.getUser();\n      authUserIdRef.current = user?.id ?? null;\n\n      if (!user) {\n`,
    replacement: `      const { data: { user } } = await supabase.auth.getUser();\n      authUserIdRef.current = user?.id ?? userScope ?? null;\n      const snapshotCardIds = new Set(flashcards.map((card) => card.id));\n      const localSnapshot = readStudySnapshot(studySnapshotKey, snapshotCardIds);\n\n      if (!user) {\n        if (localSnapshot) {\n          setCardsOrder(localSnapshot.cardsOrder);\n          setCurrentIndex(localSnapshot.currentIndex);\n          setResults(localSnapshot.results);\n          toast.success("Continuando de onde você parou!");\n          setIsLoading(false);\n          return;\n        }\n`,
  },
  {
    label: "flip matching restore results",
    search: `            setSessionId(matchingSession.id);\n            setCurrentIndex(safeIndex);\n            setCardsOrder(scopedOrder);\n            toast.success("Continuando de onde você parou!");\n`,
    replacement: `            setSessionId(matchingSession.id);\n            setCurrentIndex(safeIndex);\n            setCardsOrder(scopedOrder);\n            if (localSnapshot?.sessionId === matchingSession.id) {\n              setResults(localSnapshot.results);\n            }\n            toast.success("Continuando de onde você parou!");\n`,
  },
  {
    label: "flip new order from snapshot",
    search: `        const orderedCards = flashcards.map(f => f.id);\n        \n        // Create new session in database for flip mode\n`,
    replacement: `        const orderedCards = localSnapshot?.cardsOrder ?? flashcards.map(f => f.id);\n        const restoredIndex = localSnapshot?.currentIndex ?? savedProgress?.index ?? 0;\n        \n        // Create new session in database for flip mode\n`,
  },
  {
    label: "flip new current index",
    search: `            current_index: savedProgress?.index || 0,\n`,
    replacement: `            current_index: restoredIndex,\n`,
  },
  {
    label: "flip snapshot restore",
    search: `        if (savedProgress && savedProgress.index < orderedCards.length) {\n          setCurrentIndex(savedProgress.index);\n          // Restore known cards to results\n          const restoredResults = savedProgress.knownCards?.map((id: string) => ({\n            flashcardId: id,\n            correct: true,\n            skipped: false,\n            attempts: 1,\n          })) || [];\n          setResults(restoredResults);\n          toast.success("Continuando de onde você parou!");\n        } else {\n          setCurrentIndex(0);\n        }\n`,
    replacement: `        if (localSnapshot) {\n          setCurrentIndex(restoredIndex);\n          setResults(localSnapshot.results);\n          toast.success("Continuando de onde você parou!");\n        } else if (savedProgress && savedProgress.index < orderedCards.length) {\n          setCurrentIndex(savedProgress.index);\n          const restoredResults = savedProgress.knownCards?.map((id: string) => ({\n            flashcardId: id,\n            correct: true,\n            skipped: false,\n            attempts: 1,\n          })) || [];\n          setResults(restoredResults);\n          toast.success("Continuando de onde você parou!");\n        } else {\n          setCurrentIndex(0);\n        }\n`,
  },
  {
    label: "quiz matching restore results",
    search: `          setSessionId(matchingSession.id);\n          setCurrentIndex(safeIndex);\n          setCardsOrder(scopedOrder);\n          toast.success("Continuando de onde você parou!");\n`,
    replacement: `          setSessionId(matchingSession.id);\n          setCurrentIndex(safeIndex);\n          setCardsOrder(scopedOrder);\n          if (localSnapshot?.sessionId === matchingSession.id) {\n            setResults(localSnapshot.results);\n          }\n          toast.success("Continuando de onde você parou!");\n`,
  },
  {
    label: "quiz new order snapshot",
    search: `      let orderedCards = await getPrioritizedFlashcards(user.id, listId, flashcards, true);\n`,
    replacement: `      let orderedCards = localSnapshot?.cardsOrder\n        ?? await getPrioritizedFlashcards(user.id, listId, flashcards, true);\n`,
  },
  {
    label: "quiz current index snapshot",
    search: `          current_index: 0,\n          cards_order: orderedCards,\n`,
    replacement: `          current_index: localSnapshot?.currentIndex ?? 0,\n          cards_order: orderedCards,\n`,
  },
  {
    label: "quiz restore after insert",
    search: `      setSessionId(newSession.id);\n      setCardsOrder(orderedCards);\n      setCurrentIndex(0);\n`,
    replacement: `      setSessionId(newSession.id);\n      setCardsOrder(orderedCards);\n      setCurrentIndex(localSnapshot?.currentIndex ?? 0);\n      if (localSnapshot) {\n        setResults(localSnapshot.results);\n        toast.success("Continuando de onde você parou!");\n      }\n`,
  },
  {
    label: "initialize dependencies",
    search: `  }, [listId, cardsSignature, mode, useAllCards, isFlipMode, loadFlipProgress, gameSettings.subset, effectiveRedPlayableIds, sessionScopeKey]);\n`,
    replacement: `  }, [listId, cardsSignature, mode, useAllCards, isFlipMode, loadFlipProgress, gameSettings.subset, effectiveRedPlayableIds, sessionScopeKey, studySnapshotKey, userScope]);\n`,
  },
  {
    label: "complete session",
    search: `  const completeSession = useCallback(async () => {\n    if (!isAuthenticated) return;\n\n    // Flush any pending progress updates before completing\n    await flushProgressBuffer();\n\n    try {\n      const userId = authUserIdRef.current;\n\n      if (userId && FEATURE_FLAGS.economy_enabled) {\n        await awardPoints(userId, REWARD_AMOUNTS.SESSION_COMPLETE, 'Sessão completa');\n      }\n\n      if (sessionId) {\n        await supabase\n          .from('study_sessions')\n          .update({ completed: true })\n          .eq('id', sessionId);\n\n        // === UPDATE GOAL PROGRESS ===\n        // Check if this completed session counts toward any active goals\n        // FREIO #1: Ler from_step do URL para priorizar aquela etapa\n        if (userId && listId) {\n          try {\n            const urlParams = new URLSearchParams(window.location.search);\n            const fromStepId = urlParams.get('from_step');\n            \n            const result = await updateGoalProgress(userId, sessionId, listId, mode, fromStepId);\n            if (result.updated) {\n              if (result.goalCompleted) {\n                toast.success("🎯 Meta concluída! Parabéns!");\n              } else if (result.stepInfo) {\n                toast.info(\`Meta atualizada: Etapa (${'${result.stepInfo}'})\`);\n              }\n            }\n          } catch (goalError) {\n            console.error('Erro ao atualizar progresso de metas:', goalError);\n            // Non-blocking: don't fail session completion if goal update fails\n          }\n        }\n      }\n\n      // Update the parent list's updated_at to move it to the top of "Recentes"\n      if (listId) {\n        await supabase\n          .from('lists')\n          .update({ updated_at: new Date().toISOString() })\n          .eq('id', listId);\n\n        // Also update the parent folder's updated_at\n        const { data: listData } = await supabase\n          .from('lists')\n          .select('folder_id')\n          .eq('id', listId)\n          .single();\n\n        if (listData?.folder_id) {\n          await supabase\n            .from('folders')\n            .update({ updated_at: new Date().toISOString() })\n            .eq('id', listData.folder_id);\n        }\n      }\n\n      // Clear flip mode progress\n      if (isFlipMode && listId) {\n        localStorage.removeItem(flipProgressKey);\n      }\n\n      toast.success("Sessão de estudo concluída! 🎉");\n    } catch (error) {\n      console.error('Erro ao completar sessão:', error);\n    }\n  }, [isAuthenticated, flushProgressBuffer, sessionId, listId, isFlipMode, mode, flipProgressKey]);\n`,
    replacement: `  const completeSession = useCallback(async (): Promise<boolean> => {\n    if (completionInFlightRef.current) return false;\n    completionInFlightRef.current = true;\n    setIsCompleting(true);\n\n    try {\n      await flushProgressBuffer();\n      const userId = authUserIdRef.current;\n\n      if (isAuthenticated && sessionId) {\n        const { error: completionError } = await supabase\n          .from('study_sessions')\n          .update({ completed: true, updated_at: new Date().toISOString() })\n          .eq('id', sessionId);\n        if (completionError) throw completionError;\n\n        if (userId && FEATURE_FLAGS.economy_enabled) {\n          await awardPoints(userId, REWARD_AMOUNTS.SESSION_COMPLETE, 'Sessão completa');\n        }\n\n        if (userId && listId) {\n          try {\n            const urlParams = new URLSearchParams(window.location.search);\n            const fromStepId = urlParams.get('from_step');\n            const result = await updateGoalProgress(userId, sessionId, listId, mode, fromStepId);\n            if (result.updated) {\n              if (result.goalCompleted) toast.success("🎯 Meta concluída! Parabéns!");\n              else if (result.stepInfo) toast.info(\`Meta atualizada: Etapa (${'${result.stepInfo}'})\`);\n            }\n          } catch (goalError) {\n            console.error('Erro ao atualizar progresso de metas:', goalError);\n          }\n        }\n      }\n\n      if (isAuthenticated && listId) {\n        await supabase\n          .from('lists')\n          .update({ updated_at: new Date().toISOString() })\n          .eq('id', listId);\n        const { data: listData } = await supabase\n          .from('lists')\n          .select('folder_id')\n          .eq('id', listId)\n          .maybeSingle();\n        if (listData?.folder_id) {\n          await supabase\n            .from('folders')\n            .update({ updated_at: new Date().toISOString() })\n            .eq('id', listData.folder_id);\n        }\n      }\n\n      clearStudySnapshot(studySnapshotKey);\n      if (isFlipMode && listId) localStorage.removeItem(flipProgressKey);\n      setSessionId(null);\n      toast.success("Sessão de estudo concluída! 🎉");\n      return true;\n    } catch (error) {\n      console.error('Erro ao completar sessão:', error);\n      toast.error("Não foi possível concluir a sessão. Tente novamente.");\n      return false;\n    } finally {\n      completionInFlightRef.current = false;\n      setIsCompleting(false);\n    }\n  }, [isAuthenticated, flushProgressBuffer, sessionId, listId, isFlipMode, mode, flipProgressKey, studySnapshotKey]);\n`,
  },
  {
    label: "restart session",
    search: `  const restartSession = useCallback((newSettings?: Partial<GameSettings>) => {\n    const settings = { ...gameSettings, ...newSettings };\n    setGameSettings(settings);\n\n    // Use flashcards directly — Study.tsx already filtered by favorites/subset\n    if (flashcards.length === 0) {\n      toast.error('Nenhum card encontrado com os filtros selecionados');\n      return;\n    }\n\n    // Get card IDs\n    let cardIds = flashcards.map(f => f.id);\n\n    // Apply ordering\n    if (settings.mode === 'random') {\n      cardIds = cardIds.sort(() => Math.random() - 0.5);\n    }\n\n    // Inject red-list spaced repetitions when studying favorites\n    cardIds = injectRedListRepetitions(\n      cardIds,\n      effectiveRedPlayableIds,\n      settings.subset === 'favorites',\n    );\n\n    // Reset state\n    if (listId && isFlipMode) {\n      localStorage.removeItem(flipProgressKey);\n    }\n\n    setCardsOrder(cardIds);\n    setCurrentIndex(0);\n    setResults([]);\n    setRoundResults([]);\n    setMissedCards([]);\n    setUnseenCards([]);\n    setRoundNumber(1);\n    setIsFinished(false);\n\n    toast.success('Jogo reiniciado!');\n  }, [gameSettings, flashcards, effectiveRedPlayableIds, listId, isFlipMode, flipProgressKey]);\n`,
    replacement: `  const restartSession = useCallback(async (newSettings?: Partial<GameSettings>) => {\n    if (isRestarting) return;\n    setIsRestarting(true);\n    const settings = { ...gameSettings, ...newSettings };\n    setGameSettings(settings);\n\n    if (flashcards.length === 0) {\n      toast.error('Nenhum card encontrado com os filtros selecionados');\n      setIsRestarting(false);\n      return;\n    }\n\n    let cardIds = flashcards.map(f => f.id);\n    if (settings.mode === 'random') cardIds = cardIds.sort(() => Math.random() - 0.5);\n    cardIds = injectRedListRepetitions(\n      cardIds,\n      effectiveRedPlayableIds,\n      settings.subset === 'favorites',\n    );\n\n    const previousSessionId = sessionId;\n    clearStudySnapshot(studySnapshotKey);\n    if (listId && isFlipMode) localStorage.removeItem(flipProgressKey);\n\n    setSessionId(null);\n    setCardsOrder(cardIds);\n    setCurrentIndex(0);\n    setResults([]);\n    setRoundResults([]);\n    setMissedCards([]);\n    setUnseenCards([]);\n    setRoundNumber(1);\n    setIsFinished(false);\n\n    try {\n      const userId = authUserIdRef.current;\n      if (isAuthenticated && userId && listId) {\n        if (previousSessionId) {\n          await supabase\n            .from('study_sessions')\n            .update({ completed: true, updated_at: new Date().toISOString() })\n            .eq('id', previousSessionId);\n        }\n        const { data: newSession, error } = await supabase\n          .from('study_sessions')\n          .insert({\n            user_id: userId,\n            list_id: listId,\n            mode,\n            current_index: 0,\n            cards_order: cardIds,\n            completed: false,\n          })\n          .select()\n          .single();\n        if (error) throw error;\n        setSessionId(newSession.id);\n      }\n      toast.success('Jogo reiniciado!');\n    } catch (error) {\n      console.error('[StudyEngine] Falha ao criar nova sessão após reinício:', error);\n      toast.warning('O jogo reiniciou neste aparelho, mas a sincronização online falhou.');\n    } finally {\n      setIsRestarting(false);\n    }\n  }, [isRestarting, gameSettings, flashcards, effectiveRedPlayableIds, listId, isFlipMode, flipProgressKey, sessionId, studySnapshotKey, isAuthenticated, mode]);\n`,
  },
  {
    label: "snapshot effect",
    search: `  // Force-save current index immediately (no debounce). Used when switching\n`,
    replacement: `  useEffect(() => {\n    if (isLoading || isFinished || cardsOrder.length === 0) return;\n    writeStudySnapshot(studySnapshotKey, {\n      version: 2,\n      sessionId,\n      currentIndex,\n      cardsOrder,\n      results,\n      timestamp: Date.now(),\n    });\n  }, [studySnapshotKey, sessionId, currentIndex, cardsOrder, results, isLoading, isFinished]);\n\n  // Force-save current index immediately (no debounce). Used when switching\n`,
  },
  {
    label: "save now local first",
    search: `  const saveProgressNow = useCallback(async () => {\n    if (!sessionId || !listId || !authUserIdRef.current) return;\n    try {\n`,
    replacement: `  const saveProgressNow = useCallback(async () => {\n    if (cardsOrder.length > 0 && !isFinished) {\n      writeStudySnapshot(studySnapshotKey, {\n        version: 2,\n        sessionId,\n        currentIndex,\n        cardsOrder,\n        results,\n        timestamp: Date.now(),\n      });\n    }\n    if (!sessionId || !listId || !authUserIdRef.current) return;\n    try {\n`,
  },
  {
    label: "save now dependencies",
    search: `  }, [sessionId, currentIndex, listId]);\n\n  // Cleanup: flush progress buffer and turma activity on unmount\n`,
    replacement: `  }, [sessionId, currentIndex, listId, cardsOrder, results, isFinished, studySnapshotKey]);\n\n  useEffect(() => {\n    const flushBeforeLeave = () => { void saveProgressNow(); };\n    const flushWhenHidden = () => {\n      if (document.visibilityState === 'hidden') void saveProgressNow();\n    };\n    window.addEventListener('pagehide', flushBeforeLeave);\n    document.addEventListener('visibilitychange', flushWhenHidden);\n    return () => {\n      window.removeEventListener('pagehide', flushBeforeLeave);\n      document.removeEventListener('visibilitychange', flushWhenHidden);\n    };\n  }, [saveProgressNow]);\n\n  // Cleanup: flush progress buffer and turma activity on unmount\n`,
  },
  {
    label: "return busy state",
    search: `    isFinished,\n    isLoading,\n`,
    replacement: `    isFinished,\n    isLoading,\n    isCompleting,\n    isRestarting,\n`,
  },
]);

patchFile("src/pages/Study.tsx", [
  {
    label: "navigation import",
    search: `import { safeGoBack, getFallbackRoute } from "@/lib/safeNavigation";\n`,
    replacement: `import { buildStudyReturnRoute } from "@/features/study/lib/studyCompletionNavigation";\n`,
  },
  {
    label: "trophy import",
    search: `import { ArrowLeft, Trophy, RefreshCcw, RotateCcw, Star, CheckCircle, Flame, Layers, ChevronRight, ChevronLeft } from "lucide-react";\n`,
    replacement: `import { ArrowLeft, RefreshCcw, RotateCcw, Star, CheckCircle, Flame, Layers, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";\n`,
  },
  {
    label: "return route",
    search: `  const completionKey = useMemo(() => {\n    if (!resolvedId) return null;\n    const scope = authUserId || "anon";\n    return \`study-completed:${'${scope}'}:${'${resolvedId}'}:${'${normalizedMode}'}:${'${initialDir}'}:${'${urlFavoritesOnly}'}\`;\n  }, [resolvedId, normalizedMode, initialDir, urlFavoritesOnly, authUserId]);\n`,
    replacement: `  const completionKey = useMemo(() => {\n    if (!resolvedId) return null;\n    const scope = authUserId || "anon";\n    return \`study-completed:${'${scope}'}:${'${resolvedId}'}:${'${normalizedMode}'}:${'${initialDir}'}:${'${urlFavoritesOnly}'}\`;\n  }, [resolvedId, normalizedMode, initialDir, urlFavoritesOnly, authUserId]);\n\n  const returnRoute = useMemo(() => buildStudyReturnRoute({\n    pathname: window.location.pathname,\n    resolvedId,\n    isListRoute,\n    searchParams,\n  }), [resolvedId, isListRoute, searchParams]);\n`,
  },
  {
    label: "busy destructuring",
    search: `    isFinished,\n    isLoading: studyLoading,\n`,
    replacement: `    isFinished,\n    isLoading: studyLoading,\n    isCompleting,\n    isRestarting,\n`,
  },
  {
    label: "user scope call",
    search: `  } = useStudyEngine(listId, stableFlashcards, normalizedMode, false, favorites, initialGameSettings, redListIds);\n`,
    replacement: `  } = useStudyEngine(listId, stableFlashcards, normalizedMode, false, favorites, initialGameSettings, redListIds, authUserId);\n`,
  },
  {
    label: "exit handler",
    search: `  const handleExit = () => {\n    const fallback = getFallbackRoute(window.location.pathname);\n    safeGoBack(navigate, fallback);\n  };\n`,
    replacement: `  const handleExit = async () => {\n    await saveProgressNow();\n    navigate(returnRoute, { replace: true });\n  };\n\n  const handleCompleteAndExit = async () => {\n    const completed = await completeSession();\n    if (!completed) return;\n    setShowCompletionModal(false);\n    navigate(returnRoute, { replace: true });\n  };\n\n  const handleFinishedExit = async () => {\n    const completed = await completeSession();\n    if (!completed) return;\n    setShowCompletionModal(false);\n    navigate(returnRoute, { replace: true });\n  };\n`,
  },
  {
    label: "restart handler",
    search: `  const handleRestartWithSettings = () => {\n    setShowCompletionModal(false);\n    // Clear persistent completion state on restart\n    if (completionKey) {\n      try { localStorage.removeItem(completionKey); } catch {}\n    }\n    restartSession(gameSettings);\n  };\n`,
    replacement: `  const handleRestartWithSettings = async () => {\n    setShowCompletionModal(false);\n    if (completionKey) {\n      try { localStorage.removeItem(completionKey); } catch {}\n    }\n    await restartSession(gameSettings);\n  };\n`,
  },
  {
    label: "3d trophy",
    search: `            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">\n              <Trophy className="h-10 w-10 text-primary" />\n            </div>\n`,
    replacement: `            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-300/25 via-yellow-400/10 to-orange-500/20 shadow-[0_18px_45px_-18px_rgba(245,158,11,0.9)] ring-1 ring-amber-300/30">\n              <span\n                role="img"\n                aria-label="Troféu"\n                className="select-none text-6xl leading-none drop-shadow-[0_8px_8px_rgba(0,0,0,0.4)] [filter:saturate(1.2)_contrast(1.05)]"\n              >\n                🏆\n              </span>\n            </div>\n`,
  },
  {
    label: "completion title",
    search: `              {isGameComplete ? "Parabéns! Todos os cards dominados! 🎉" : \`Rodada ${'${roundNumber}'} Concluída!\`}\n`,
    replacement: `              {isGameComplete && correctCount === totalCards && errorCount === 0 && skippedCount === 0\n                ? "Parabéns! Todos os cards dominados! 🎉"\n                : "Sessão finalizada!"}\n`,
  },
  {
    label: "desktop complete button",
    search: `                onClick={completeSession}\n                className="w-full sm:w-auto min-w-[220px] text-lg font-bold shadow-lg bg-green-600 hover:bg-green-700"\n              >\n                <CheckCircle className="mr-2 h-6 w-6" />\n                CONCLUIR SESSÃO\n`,
    replacement: `                type="button"\n                onClick={() => void handleCompleteAndExit()}\n                disabled={isCompleting || isRestarting}\n                className="w-full sm:w-auto min-w-[220px] text-lg font-bold shadow-lg bg-green-600 hover:bg-green-700"\n              >\n                {isCompleting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <CheckCircle className="mr-2 h-6 w-6" />}\n                {isCompleting ? "CONCLUINDO..." : "CONCLUIR SESSÃO"}\n`,
  },
  {
    label: "desktop restart button",
    search: `                  onClick={handleRestartWithSettings}\n                >\n                  <RotateCcw className="mr-2 h-5 w-5" />\n                  Jogar Novamente\n`,
    replacement: `                  onClick={() => void handleRestartWithSettings()}\n                  disabled={isCompleting || isRestarting}\n                >\n                  {isRestarting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <RotateCcw className="mr-2 h-5 w-5" />}\n                  {isRestarting ? "Reiniciando..." : "Jogar Novamente"}\n`,
  },
  {
    label: "desktop exit button",
    search: `                onClick={handleExit}\n              >\n                Voltar à Lista\n`,
    replacement: `                onClick={() => void handleFinishedExit()}\n                disabled={isCompleting || isRestarting}\n              >\n                Voltar à Lista\n`,
  },
  {
    label: "mobile restart button",
    search: `                <Button variant="secondary" size="sm" onClick={handleRestartWithSettings}>\n                  <RotateCcw className="mr-2 h-4 w-4" />\n                  Jogar Novamente\n`,
    replacement: `                <Button variant="secondary" size="sm" onClick={() => void handleRestartWithSettings()} disabled={isCompleting || isRestarting}>\n                  {isRestarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}\n                  {isRestarting ? "Reiniciando..." : "Jogar Novamente"}\n`,
  },
  {
    label: "mobile exit button",
    search: `              <Button variant="ghost" size="sm" onClick={handleExit}>\n                Voltar\n`,
    replacement: `              <Button variant="ghost" size="sm" onClick={() => void handleFinishedExit()} disabled={isCompleting || isRestarting}>\n                Voltar\n`,
  },
  {
    label: "sticky complete button",
    search: `            onClick={completeSession}\n            className="w-full text-lg font-bold shadow-lg bg-green-600 hover:bg-green-700 min-h-[56px]"\n          >\n            <CheckCircle className="mr-2 h-6 w-6" />\n            CONCLUIR SESSÃO\n`,
    replacement: `            type="button"\n            onClick={() => void handleCompleteAndExit()}\n            disabled={isCompleting || isRestarting}\n            className="w-full text-lg font-bold shadow-lg bg-green-600 hover:bg-green-700 min-h-[56px]"\n          >\n            {isCompleting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <CheckCircle className="mr-2 h-6 w-6" />}\n            {isCompleting ? "CONCLUINDO..." : "CONCLUIR SESSÃO"}\n`,
  },
  {
    label: "modal callbacks",
    search: `        onComplete={() => {\n          setShowCompletionModal(false);\n          if (completionKey) {\n            try { localStorage.removeItem(completionKey); } catch {}\n          }\n          completeSession();\n        }}\n        onRestart={handleRestartWithSettings}\n`,
    replacement: `        onComplete={() => void handleCompleteAndExit()}\n        onRestart={() => void handleRestartWithSettings()}\n        isCompleting={isCompleting}\n        isRestarting={isRestarting}\n`,
  },
  {
    label: "modal exit",
    search: `        onExit={() => {\n          setShowCompletionModal(false);\n          handleExit();\n        }}\n`,
    replacement: `        onExit={() => void handleFinishedExit()}\n`,
  },
]);

patchFile("src/features/study/components/StudyCompletionModal.impl.tsx", [
  {
    label: "modal icon import",
    search: `import { Trophy, RotateCcw, CheckCircle, ArrowLeft } from "lucide-react";\n`,
    replacement: `import { RotateCcw, CheckCircle, ArrowLeft, Loader2 } from "lucide-react";\n`,
  },
  {
    label: "modal busy props interface",
    search: `  onGoToGoals?: () => void;\n}\n`,
    replacement: `  onGoToGoals?: () => void;\n  isCompleting?: boolean;\n  isRestarting?: boolean;\n}\n`,
  },
  {
    label: "modal busy destructuring",
    search: `  fromGoalId,\n  onGoToGoals,\n}: StudyCompletionModalProps) => {\n`,
    replacement: `  fromGoalId,\n  onGoToGoals,\n  isCompleting = false,\n  isRestarting = false,\n}: StudyCompletionModalProps) => {\n`,
  },
  {
    label: "modal trophy",
    search: `          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">\n            <Trophy className="h-8 w-8 text-primary" />\n          </div>\n`,
    replacement: `          <div className="mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-300/25 via-yellow-400/10 to-orange-500/20 shadow-[0_16px_36px_-16px_rgba(245,158,11,0.9)] ring-1 ring-amber-300/30">\n            <span role="img" aria-label="Troféu" className="select-none text-5xl leading-none drop-shadow-[0_7px_7px_rgba(0,0,0,0.4)]">🏆</span>\n          </div>\n`,
  },
  {
    label: "modal complete busy",
    search: `            onClick={() => runTransition(onComplete)}\n            className="w-full bg-green-600 hover:bg-green-700 text-lg font-bold min-h-[48px]"\n          >\n            <CheckCircle className="mr-2 h-5 w-5" />\n            CONCLUIR SESSÃO\n`,
    replacement: `            onClick={() => runTransition(onComplete)}\n            disabled={isCompleting || isRestarting}\n            className="w-full bg-green-600 hover:bg-green-700 text-lg font-bold min-h-[48px]"\n          >\n            {isCompleting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}\n            {isCompleting ? "CONCLUINDO..." : "CONCLUIR SESSÃO"}\n`,
  },
  {
    label: "modal restart busy",
    search: `          <Button variant="secondary" onClick={() => runTransition(onRestart)} className="w-full">\n            <RotateCcw className="mr-2 h-4 w-4" />\n            Jogar Novamente\n`,
    replacement: `          <Button variant="secondary" onClick={() => runTransition(onRestart)} disabled={isCompleting || isRestarting} className="w-full">\n            {isRestarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}\n            {isRestarting ? "Reiniciando..." : "Jogar Novamente"}\n`,
  },
  {
    label: "modal exit busy",
    search: `          <Button variant="ghost" onClick={() => runTransition(onExit)} className="w-full">\n`,
    replacement: `          <Button variant="ghost" onClick={() => runTransition(onExit)} disabled={isCompleting || isRestarting} className="w-full">\n`,
  },
]);

console.log("Study completion and persistence patch applied.");
