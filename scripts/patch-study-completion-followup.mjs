import { readFileSync, writeFileSync } from "node:fs";

function patchFile(path, patches) {
  let source = readFileSync(path, "utf8");
  for (const { label, search, replacement } of patches) {
    const count = source.split(search).length - 1;
    if (count !== 1) throw new Error(`${path}: ${label} expected once, found ${count}`);
    source = source.replace(search, replacement);
  }
  writeFileSync(path, source, "utf8");
}

patchFile("src/features/study/hooks/useStudyEngine.ts", [
  {
    label: "avoid duplicate red injection",
    search: `      // Inject red-list spaced repetitions when studying favorites\n      orderedCards = injectRedListRepetitions(\n        orderedCards,\n        effectiveRedPlayableIds,\n        gameSettings.subset === 'favorites',\n      );\n`,
    replacement: `      // A restored snapshot already contains its exact repetition order.\n      if (!localSnapshot) {\n        orderedCards = injectRedListRepetitions(\n          orderedCards,\n          effectiveRedPlayableIds,\n          gameSettings.subset === 'favorites',\n        );\n      }\n`,
  },
  {
    label: "discard restored session",
    search: `  // Reset session (start fresh)\n  const resetSession = useCallback(() => {\n`,
    replacement: `  const discardSession = useCallback(async () => {\n    clearStudySnapshot(studySnapshotKey);\n    if (listId && isFlipMode) localStorage.removeItem(flipProgressKey);\n    const currentSessionId = sessionId;\n    setSessionId(null);\n    if (!currentSessionId || !isAuthenticated) return;\n    try {\n      await supabase\n        .from('study_sessions')\n        .update({ completed: true, updated_at: new Date().toISOString() })\n        .eq('id', currentSessionId);\n    } catch (error) {\n      console.error('[StudyEngine] Falha ao descartar sessão restaurada:', error);\n    }\n  }, [studySnapshotKey, listId, isFlipMode, flipProgressKey, sessionId, isAuthenticated]);\n\n  // Reset session (start fresh)\n  const resetSession = useCallback(() => {\n`,
  },
  {
    label: "return discard",
    search: `    startNextRound,\n    resetSession,\n`,
    replacement: `    startNextRound,\n    discardSession,\n    resetSession,\n`,
  },
]);

patchFile("src/pages/Study.tsx", [
  {
    label: "restored completion state",
    search: `  // Completion modal\n  const [showCompletionModal, setShowCompletionModal] = useState(false);\n`,
    replacement: `  // Completion modal\n  const [showCompletionModal, setShowCompletionModal] = useState(false);\n  const [completionWasRestored, setCompletionWasRestored] = useState(false);\n`,
  },
  {
    label: "discard destructuring",
    search: `    completeSession,\n    cardsOrder,\n`,
    replacement: `    completeSession,\n    discardSession,\n    cardsOrder,\n`,
  },
  {
    label: "fresh finish marker",
    search: `    if (isFinished) {\n      setShowCompletionModal(true);\n      // Persist completion state\n`,
    replacement: `    if (isFinished) {\n      setCompletionWasRestored(false);\n      setShowCompletionModal(true);\n      // Persist completion state\n`,
  },
  {
    label: "restore marker flag",
    search: `      if (saved) {\n        setShowCompletionModal(true);\n      }\n`,
    replacement: `      if (saved) {\n        setCompletionWasRestored(true);\n        setShowCompletionModal(true);\n      }\n`,
  },
  {
    label: "complete restored behavior",
    search: `  const handleCompleteAndExit = async () => {\n    const completed = await completeSession();\n    if (!completed) return;\n    setShowCompletionModal(false);\n    navigate(returnRoute, { replace: true });\n  };\n\n  const handleFinishedExit = async () => {\n    const completed = await completeSession();\n    if (!completed) return;\n    setShowCompletionModal(false);\n    navigate(returnRoute, { replace: true });\n  };\n`,
    replacement: `  const finishAndReturn = async () => {\n    if (completionWasRestored) {\n      await discardSession();\n    } else {\n      const completed = await completeSession();\n      if (!completed) return;\n    }\n    setShowCompletionModal(false);\n    navigate(returnRoute, { replace: true });\n  };\n\n  const handleCompleteAndExit = finishAndReturn;\n  const handleFinishedExit = finishAndReturn;\n`,
  },
  {
    label: "restart restored flag",
    search: `  const handleRestartWithSettings = async () => {\n    setShowCompletionModal(false);\n`,
    replacement: `  const handleRestartWithSettings = async () => {\n    setCompletionWasRestored(false);\n    setShowCompletionModal(false);\n`,
  },
]);

console.log("Study completion follow-up patch applied.");
