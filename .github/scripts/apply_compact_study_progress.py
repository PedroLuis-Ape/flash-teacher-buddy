from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


study_path = Path("src/pages/Study.tsx")
study = study_path.read_text(encoding="utf-8")

study = replace_once(
    study,
    'import { Progress } from "@/components/ui/progress";\n',
    '',
    "remove legacy progress import",
)
study = replace_once(
    study,
    'import { StudyCompletionModal } from "@/features/study/components/StudyCompletionModal";\n',
    'import { StudyCompletionModal } from "@/features/study/components/StudyCompletionModal";\n'
    'import { StudyProgressHud } from "@/features/study/components/StudyProgressHud";\n'
    'import { resolveStudyProgressMetrics } from "@/features/study/lib/studyProgressMetrics";\n',
    "add compact progress imports",
)
study = replace_once(
    study,
    '''    unseenCardsCount,\n    missedCardsCount,\n    completeSession,\n''',
    '''    unseenCardsCount,\n    missedCardsCount,\n    masteryStatus,\n    masteryRoundSummary,\n    masteryTotalEligible,\n    masteryMasteredCount,\n    completeSession,\n''',
    "read mastery progress exports",
)
study = replace_once(
    study,
    "  const order = gameSettings.mode === 'sequential' ? 'asc' : 'random';\n",
    "  const order = gameSettings.mode === 'sequential' ? 'asc' : 'random';\n"
    "  const masteryProgressActive = masteryStatus !== null;\n"
    "  const overallTotalCards = masteryProgressActive ? masteryTotalEligible : totalCards;\n"
    "  const studyProgressMetrics = resolveStudyProgressMetrics({\n"
    "    mode: masteryProgressActive ? \"mastery\" : \"continuous\",\n"
    "    overallTotal: overallTotalCards,\n"
    "    masteredTotal: masteryMasteredCount,\n"
    "    currentIndex,\n"
    "    currentRoundTotal: totalCards,\n"
    "  });\n",
    "derive two-level progress",
)
study = replace_once(
    study,
    '''            </h1>\n\n            <div className="grid grid-cols-2 gap-4 py-6 sm:grid-cols-4">\n''',
    '''            </h1>\n\n            {masteryProgressActive && (\n              <div className="space-y-2 rounded-xl border bg-muted/30 p-3 text-left">\n                <div className="flex items-center justify-between gap-3 text-sm">\n                  <span className="font-medium">Progresso geral</span>\n                  <strong className="tabular-nums">\n                    {masteryMasteredCount}/{overallTotalCards} dominados · {Math.round(studyProgressMetrics.overallPercent)}%\n                  </strong>\n                </div>\n                <div className="h-2 overflow-hidden rounded-full bg-muted">\n                  <div\n                    className="h-full rounded-full bg-primary transition-[width] duration-300"\n                    style={{ width: `${studyProgressMetrics.overallPercent}%` }}\n                  />\n                </div>\n              </div>\n            )}\n\n            <div className="grid grid-cols-2 gap-4 py-6 sm:grid-cols-4">\n''',
    "add completion macro progress",
)
study = study.replace("Cards restantes: {unseenCardsCount}", "Ainda inéditos: {unseenCardsCount}")
study = study.replace("Cards para revisar: {missedCardsCount}", "Para revisar: {missedCardsCount}")
study = replace_once(
    study,
    'className={`min-h-screen py-4 sm:py-8 px-3 sm:px-4 lg:px-8 transition-colors ${',
    'className={`min-h-screen py-2 sm:py-4 px-2.5 sm:px-4 lg:px-8 transition-colors ${',
    "compact page padding",
)
study = replace_once(
    study,
    '<div className="mb-3 flex items-center justify-center">',
    '<div className="mb-2 flex items-center justify-center">',
    "compact red focus banner",
)
study = replace_once(
    study,
    '<div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">',
    '<div className="mb-3 space-y-2">',
    "compact study header",
)
study = replace_once(
    study,
    '''              <div className="hidden sm:flex gap-4 text-sm">\n                <span className="text-success font-medium">✓ {correctCount}</span>\n                <span className="text-destructive font-medium">✗ {errorCount}</span>\n                <span className="text-warning font-medium">⊘ {skippedCount}</span>\n              </div>\n''',
    '',
    "remove duplicated desktop score",
)
study = replace_once(
    study,
    '<div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">',
    '<div className="hidden lg:flex items-center justify-center gap-2 text-xs text-muted-foreground">',
    "hide secondary language labels on compact screens",
)
study = replace_once(
    study,
    '''          <div className="space-y-2">\n            <div className="flex justify-between text-sm text-muted-foreground">\n              <span>\n                {currentIndex + 1} / {totalCards}\n              </span>\n              <span>{Math.round(progress)}%</span>\n            </div>\n            <Progress value={progress} />\n          </div>\n\n          {/* Mobile score display */}\n          <div className="flex sm:hidden justify-center gap-6 text-sm py-2">\n            <span className="text-success font-medium">✓ {correctCount}</span>\n            <span className="text-destructive font-medium">✗ {errorCount}</span>\n            <span className="text-warning font-medium">⊘ {skippedCount}</span>\n          </div>\n''',
    '''          <StudyProgressHud\n            metrics={studyProgressMetrics}\n            overallTotal={overallTotalCards}\n            currentRoundTotal={totalCards}\n            roundNumber={roundNumber}\n            isMasteryMode={masteryProgressActive}\n            correctCount={masteryProgressActive ? roundCorrect : correctCount}\n            errorCount={masteryProgressActive ? roundErrors : errorCount}\n            skippedCount={masteryProgressActive ? (masteryRoundSummary?.skippedCards ?? 0) : skippedCount}\n            pendingReview={missedCardsCount}\n            unseenRemaining={unseenCardsCount}\n          />\n''',
    "replace stacked progress with compact HUD",
)
study_path.write_text(study, encoding="utf-8")


engine_path = Path("src/features/study/hooks/useStudyEngine.ts")
engine = engine_path.read_text(encoding="utf-8")
engine = replace_once(
    engine,
    '''        const cardId = getCurrentCardId(prev);\n        if (!cardId) return prev;\n        return recordMasteryResult({\n''',
    '''        const currentCardId = getCurrentCardId(prev);\n        // Use the submitted identity as an advance gate. A repeated click or\n        // duplicated keyboard event must never answer the following card.\n        if (!currentCardId || currentCardId !== flashcardId) return prev;\n        return recordMasteryResult({\n''',
    "guard duplicate mastery submissions",
)
engine = replace_once(
    engine,
    '''        }, cardId, resultType);\n''',
    '''        }, flashcardId, resultType);\n''',
    "record the submitted mastery card",
)
engine = replace_once(
    engine,
    '''    masteryStatus: masterySession?.status ?? null,\n    masteryRoundSummary: masterySummary,\n''',
    '''    masteryStatus: masterySession?.status ?? null,\n    masteryRoundSummary: masterySummary,\n    masteryTotalEligible: masterySession?.totalEligible ?? flashcards.length,\n    masteryMasteredCount: masterySession?.masteredIds.length ?? 0,\n''',
    "export overall mastery progress",
)
engine_path.write_text(engine, encoding="utf-8")


snapshot_path = Path("src/features/study/lib/masterySessionSnapshot.ts")
snapshot = snapshot_path.read_text(encoding="utf-8")
snapshot = replace_once(
    snapshot,
    'import type { MasterySessionState, StudyCardResult } from "./studySessionFlow";\n',
    'import { MASTERY_ROUND_SIZE, type MasterySessionState, type StudyCardResult } from "./studySessionFlow";\n',
    "import canonical mastery round size",
)
snapshot = replace_once(
    snapshot,
    '''  const filterIds = (ids: string[]) => ids.filter((id) => availableCardIds.has(id));\n  const currentRoundIds = filterIds(row.currentRoundIds);\n  if (currentRoundIds.length === 0) return null;\n\n  // Every card referenced in the snapshot must still exist in the eligible set,\n  // and the union of currentRound + unseen + retry + mastered must equal the\n  // deck. If the deck changed (add/remove card), we discard the snapshot so\n  // the engine rebuilds from scratch.\n  const unseenIds = filterIds(row.unseenIds);\n  const retryIds = filterIds(row.retryIds);\n  const masteredIds = filterIds(row.masteredIds);\n  const union = new Set<string>([\n    ...currentRoundIds,\n    ...unseenIds,\n    ...retryIds,\n    ...masteredIds,\n  ]);\n  if (union.size !== availableCardIds.size) return null;\n  for (const id of availableCardIds) {\n    if (!union.has(id)) return null;\n  }\n\n  const currentRoundIndex = Math.min(Math.max(row.currentRoundIndex, 0), currentRoundIds.length);\n  let status = row.status;\n  if (status === "active" && currentRoundIndex >= currentRoundIds.length) {\n    status = unseenIds.length === 0\n      && retryIds.length === 0\n      && filterIds(row.failedThisRoundIds).length === 0\n      ? "journey-complete"\n      : "round-complete";\n  }\n\n  const currentRoundSet = new Set(currentRoundIds);\n''',
    '''  const filterIds = (ids: string[]) => ids.filter((id) => availableCardIds.has(id));\n  const dedupeIds = (ids: string[]) => Array.from(new Set(ids));\n  const currentRoundIds = dedupeIds(filterIds(row.currentRoundIds));\n  if (currentRoundIds.length === 0) return null;\n\n  // Legacy snapshots could contain the same card in the active round and in\n  // unseen/retry queues. That made a recovered card look permanently pending\n  // and could offer endless next rounds. Repair the queues into disjoint sets.\n  const currentRoundSet = new Set(currentRoundIds);\n  const masteredIds = dedupeIds(filterIds(row.masteredIds));\n  const masteredSet = new Set(masteredIds);\n  const unseenIds = dedupeIds(filterIds(row.unseenIds)).filter(\n    (id) => !currentRoundSet.has(id) && !masteredSet.has(id),\n  );\n  const unseenSet = new Set(unseenIds);\n  const retryIds = dedupeIds(filterIds(row.retryIds)).filter(\n    (id) => !currentRoundSet.has(id) && !masteredSet.has(id) && !unseenSet.has(id),\n  );\n\n  const union = new Set<string>([\n    ...currentRoundIds,\n    ...unseenIds,\n    ...retryIds,\n    ...masteredIds,\n  ]);\n  if (union.size !== availableCardIds.size) return null;\n  for (const id of availableCardIds) {\n    if (!union.has(id)) return null;\n  }\n\n  const failedThisRoundIds = dedupeIds(filterIds(row.failedThisRoundIds)).filter(\n    (id) => currentRoundSet.has(id) && !masteredSet.has(id),\n  );\n  const currentRoundIndex = Math.min(Math.max(row.currentRoundIndex, 0), currentRoundIds.length);\n  let status = row.status;\n  if (currentRoundIndex < currentRoundIds.length) {\n    status = "active";\n  } else {\n    status = unseenIds.length === 0\n      && retryIds.length === 0\n      && failedThisRoundIds.length === 0\n      ? "journey-complete"\n      : "round-complete";\n  }\n\n''',
    "repair overlapping mastery queues",
)
snapshot = replace_once(
    snapshot,
    '''    totalEligible: row.totalEligible,\n    roundSize: row.roundSize,\n''',
    '''    totalEligible: availableCardIds.size,\n    roundSize: MASTERY_ROUND_SIZE,\n''',
    "normalize mastery totals",
)
snapshot = replace_once(
    snapshot,
    '''    failedThisRoundIds: filterIds(row.failedThisRoundIds),\n''',
    '''    failedThisRoundIds,\n''',
    "return repaired failures",
)
snapshot_path.write_text(snapshot, encoding="utf-8")


hud_path = Path("src/features/study/components/StudyProgressHud.tsx")
hud = hud_path.read_text(encoding="utf-8").replace(
    'className="hidden xs:inline"',
    'className="hidden min-[380px]:inline"',
)
hud_path.write_text(hud, encoding="utf-8")


test_path = Path("src/features/study/lib/masterySessionSnapshot.test.ts")
test = test_path.read_text(encoding="utf-8")
test = replace_once(
    test,
    '''    expect(restored).not.toBeNull();\n    expect(restored?.roundSize).toBe(MASTERY_ROUND_SIZE);\n    expect(restored?.unseenIds).toEqual(ids(14).map((_, index) => `c${index + 15}`));\n    expect(restored?.unseenIds.some((id) => restored.currentRoundIds.includes(id))).toBe(false);\n    expect(restored?.status).toBe("round-complete");\n''',
    '''    expect(restored).not.toBeNull();\n    if (!restored) throw new Error("snapshot should be repaired");\n    expect(restored.roundSize).toBe(MASTERY_ROUND_SIZE);\n    expect(restored.unseenIds).toEqual(ids(14).map((_, index) => `c${index + 15}`));\n    expect(restored.unseenIds.some((id) => restored.currentRoundIds.includes(id))).toBe(false);\n    expect(restored.status).toBe("round-complete");\n''',
    "narrow repaired snapshot test",
)
test_path.write_text(test, encoding="utf-8")
