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
    label: "reward imports",
    search: `import { awardPoints, REWARD_AMOUNTS } from "@/lib/rewardEngine";\n`,
    replacement: `import { recordStudyAnswer, settleStudySession } from "@/lib/rewardEngine";\n`,
  },
  {
    label: "reward queue ref",
    search: `  const completionInFlightRef = useRef(false);\n`,
    replacement: `  const completionInFlightRef = useRef(false);\n  const pitecoinWritesRef = useRef<Set<Promise<unknown>>>(new Set());\n`,
  },
  {
    label: "record explicit answer",
    search: `    trackAnswer(flashcardId, correct, skipped);\n\n    if (!isAuthenticated || !listId || skipped) return;\n\n    // Track study activity (debounced by the hook)\n    trackListStudied(listId);\n\n    // Award points non-blocking (fire-and-forget so UI transitions aren't delayed)\n    if (authUserIdRef.current && correct && FEATURE_FLAGS.economy_enabled) {\n      awardPoints(authUserIdRef.current, REWARD_AMOUNTS.CORRECT_ANSWER, 'Resposta correta')\n        .catch(err => console.error('Erro ao atribuir pontos:', err));\n    }\n`,
    replacement: `    trackAnswer(flashcardId, correct, skipped);\n\n    // Persist the exact card result for the server-authoritative PiteCOIN\n    // settlement. The write is queued so the UI stays responsive, then all\n    // pending writes are flushed before the session reward is calculated.\n    if (isAuthenticated && sessionId && FEATURE_FLAGS.economy_enabled) {\n      const write = recordStudyAnswer(sessionId, flashcardId, correct, skipped);\n      pitecoinWritesRef.current.add(write);\n      void write\n        .then((result) => {\n          if (!result.success) {\n            console.warn('[PiteCOIN] Answer not recorded:', result.error);\n          }\n        })\n        .finally(() => pitecoinWritesRef.current.delete(write));\n    }\n\n    if (!isAuthenticated || !listId || skipped) return;\n\n    // Track study activity (debounced by the hook)\n    trackListStudied(listId);\n`,
  },
  {
    label: "record result deps",
    search: `  }, [listId, isAuthenticated, isFlipMode, trackListStudied, scheduleFlush, updateTurmaActivity, trackAnswer, mode, cardsOrder.length, currentIndex]);\n`,
    replacement: `  }, [listId, isAuthenticated, sessionId, isFlipMode, trackListStudied, scheduleFlush, updateTurmaActivity, trackAnswer, mode, cardsOrder.length, currentIndex]);\n`,
  },
  {
    label: "session settlement order",
    search: `      if (isAuthenticated && sessionId) {\n        const { error: completionError } = await supabase\n          .from('study_sessions')\n          .update({ completed: true, updated_at: new Date().toISOString() })\n          .eq('id', sessionId);\n        if (completionError) throw completionError;\n\n        if (userId && FEATURE_FLAGS.economy_enabled) {\n          await awardPoints(userId, REWARD_AMOUNTS.SESSION_COMPLETE, 'Sessão completa');\n        }\n\n        if (userId && listId) {\n`,
    replacement: `      if (isAuthenticated && sessionId) {\n        // The reward RPC owns the final settlement and must run before the\n        // session is hidden from the active-session pool. Flush every answer\n        // write first so the final card is never lost in a race.\n        if (FEATURE_FLAGS.economy_enabled) {\n          await Promise.allSettled(Array.from(pitecoinWritesRef.current));\n          const reward = await settleStudySession(sessionId, true);\n\n          if (reward.success && !reward.alreadyProcessed) {\n            const pieces = [\n              reward.pitecoinAwarded > 0 ? '+₱' + reward.pitecoinAwarded : null,\n              reward.ptsAwarded > 0 ? '+' + reward.ptsAwarded + ' PTS' : null,\n              reward.xpAwarded > 0 ? '+' + reward.xpAwarded + ' XP' : null,\n            ].filter(Boolean);\n            if (pieces.length > 0) {\n              toast.success('Recompensa recebida: ' + pieces.join(' · '), { duration: 6000 });\n            }\n          } else if (!reward.success && reward.error) {\n            const messages: Record<string, string> = {\n              LIST_TOO_SHORT: 'Esta lista precisa ter pelo menos 5 cards para gerar recompensa.',\n              SESSION_TOO_SHORT: 'Pratique pelo menos 5 cards antes de receber recompensa.',\n              SESSION_NOT_FOUND: 'A sessão foi concluída, mas a recompensa não encontrou o registro ativo.',\n            };\n            toast.info(messages[reward.error] ?? 'Sessão concluída sem recompensa desta vez.');\n          }\n        }\n\n        // Harmless fallback for environments where the reward RPC only\n        // calculates values but does not mark the session itself.\n        const { error: completionError } = await supabase\n          .from('study_sessions')\n          .update({ completed: true, updated_at: new Date().toISOString() })\n          .eq('id', sessionId);\n        if (completionError) throw completionError;\n\n        if (userId && listId) {\n`,
  },
]);

patchFile("src/features/study/components/FlipStudyView.impl.tsx", [
  {
    label: "remove legacy reward imports",
    search: `import { awardPoints, REWARD_AMOUNTS } from "@/lib/rewardEngine";\nimport { supabase } from "@/integrations/supabase/client";\n`,
    replacement: ``,
  },
  {
    label: "remove duplicate reward request",
    search: `  const handleKnew = async () => {\n    playCorrect();\n    const { data: { session } } = await supabase.auth.getSession();\n    if (session?.user) {\n      await awardPoints(session.user.id, REWARD_AMOUNTS.CORRECT_ANSWER, 'flashcard_correct');\n    }\n    onKnew();\n  };\n`,
    replacement: `  const handleKnew = () => {\n    playCorrect();\n    // useStudyEngine records the explicit session/card answer once. Keeping\n    // reward writes out of this view prevents duplicate and out-of-order calls.\n    onKnew();\n  };\n`,
  },
]);

patchFile("src/pages/Index.tsx", [
  {
    label: "pitecoin asset import",
    search: `import { useQuery } from "@tanstack/react-query";\n`,
    replacement: `import { useQuery } from "@tanstack/react-query";\nimport pitecoinIcon from "@/assets/pitecoin.png";\n`,
  },
  {
    label: "economy balance",
    search: `  const { pts_weekly, level, current_streak } = useEconomy();\n`,
    replacement: `  const { pts_weekly, balance_pitecoin, level, current_streak } = useEconomy();\n`,
  },
  {
    label: "five stat columns",
    search: `        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-3 xl:gap-4">\n`,
    replacement: `        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 xl:gap-4">\n`,
  },
  {
    label: "pitecoin dashboard tile",
    search: `          <Card className="stat-tile p-4 border-0">\n            <div className="flex items-center gap-2 mb-2">\n              <span className="icon-tile !w-9 !h-9"><Crown className="h-4 w-4 text-primary" /></span>\n              <span className="text-xs text-muted-foreground">Nível</span>\n            </div>\n`,
    replacement: `          <Card\n            className="stat-tile cursor-pointer p-4 border-0"\n            onClick={() => navigate('/store')}\n          >\n            <div className="flex items-center gap-2 mb-2">\n              <span className="icon-tile !w-9 !h-9"><img src={pitecoinIcon} alt="" className="h-5 w-5" /></span>\n              <span className="text-xs text-muted-foreground">PiteCOIN</span>\n            </div>\n            {loading ? (\n              <Skeleton className="h-8 w-16" />\n            ) : (\n              <p className="text-3xl font-bold tracking-tight">₱{balance_pitecoin}</p>\n            )}\n          </Card>\n\n          <Card className="stat-tile p-4 border-0">\n            <div className="flex items-center gap-2 mb-2">\n              <span className="icon-tile !w-9 !h-9"><Crown className="h-4 w-4 text-primary" /></span>\n              <span className="text-xs text-muted-foreground">Nível</span>\n            </div>\n`,
  },
]);

console.log("PiteCOIN frontend patch applied.");
