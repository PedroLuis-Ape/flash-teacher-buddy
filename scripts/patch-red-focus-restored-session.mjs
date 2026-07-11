import fs from "node:fs";

const path = "src/features/study/hooks/useStudyEngine.ts";
let source = fs.readFileSync(path, "utf8");

function replaceExact(oldText, newText, expectedCount, label) {
  const count = source.split(oldText).length - 1;
  if (count !== expectedCount) {
    throw new Error(`${label}: expected ${expectedCount} occurrence(s), found ${count}`);
  }
  source = source.split(oldText).join(newText);
}

replaceExact(
`  readStudySnapshot,
  writeStudySnapshot,`,
`  readStudySnapshot,
  sanitizePersistedStudyOrder,
  writeStudySnapshot,`,
1,
"snapshot helper import",
);

replaceExact(
`      const localSnapshot = readStudySnapshot(studySnapshotKey, snapshotCardIds);`,
`      const localSnapshot = readStudySnapshot(studySnapshotKey, snapshotCardIds, {
        enforceUniqueOrder: !!gameSettings.redFocus,
      });`,
1,
"local snapshot red-focus sanitation",
);

replaceExact(
`      const availableCardIds = new Set(flashcards.map((card) => card.id));
      const sanitizeSessionOrder = (sessionOrder: unknown): string[] => {
        if (!Array.isArray(sessionOrder)) return [];
        return sessionOrder
          .filter((id): id is string => typeof id === 'string')
          .filter((id) => availableCardIds.has(id));
      };

      // Returns true when the saved session's card-set matches the current
      // effective deck closely enough to be considered the SAME scope.
      // We use set equality of unique IDs (ignoring red-list repetitions which
      // duplicate IDs). If the saved session is a strict superset (e.g. "all"
      // vs "favorites"), it does NOT match — we want a separate session row.
      const sessionMatchesCurrentScope = (sessionOrder: unknown): boolean => {
        if (!Array.isArray(sessionOrder)) return false;
        const savedUnique = new Set(
          sessionOrder.filter((id): id is string => typeof id === 'string')
        );
        if (savedUnique.size !== availableCardIds.size) return false;
        for (const id of savedUnique) {
          if (!availableCardIds.has(id)) return false;
        }
        return true;
      };`,
`      const availableCardIds = new Set(flashcards.map((card) => card.id));
      const sanitizeSessionOrder = (sessionOrder: unknown, currentIndex: unknown) =>
        sanitizePersistedStudyOrder({
          sessionOrder,
          currentIndex,
          availableCardIds,
          enforceUniqueOrder: !!gameSettings.redFocus,
        });

      // A persisted session belongs to this scope only when it contains the
      // same effective card set. In red focus the sanitizer additionally
      // repairs legacy duplicated/random queues to the canonical deck order.
      const sessionMatchesCurrentScope = (sessionOrder: unknown): boolean =>
        sanitizeSessionOrder(sessionOrder, 0) !== null;`,
1,
"persisted session sanitizer",
);

const oldRestoreBlock = `        if (matchingSession) {
          const scopedOrder = sanitizeSessionOrder(matchingSession.cards_order);

          if (scopedOrder.length > 0) {
            const safeIndex = Math.min(
              Math.max(matchingSession.current_index ?? 0, 0),
              scopedOrder.length - 1
            );

            setSessionId(matchingSession.id);
            setCurrentIndex(safeIndex);
            setCardsOrder(scopedOrder);
            if (localSnapshot?.sessionId === matchingSession.id) {
              setResults(localSnapshot.results);
            }
            toast.success("Continuando de onde você parou!");
            setIsLoading(false);
            return;
          }
        }`;

const newRestoreBlock = `        if (matchingSession) {
          const restoredSession = sanitizeSessionOrder(
            matchingSession.cards_order,
            matchingSession.current_index,
          );

          if (restoredSession) {
            setSessionId(matchingSession.id);
            setCurrentIndex(restoredSession.currentIndex);
            setCardsOrder(restoredSession.cardsOrder);

            if (restoredSession.repaired) {
              setResults([]);
              const { error: repairError } = await supabase
                .from('study_sessions')
                .update({
                  cards_order: restoredSession.cardsOrder,
                  current_index: 0,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', matchingSession.id);
              if (repairError) {
                console.warn('[StudyEngine] Falha ao persistir reparo da fila vermelha:', repairError.message);
              }
              toast.info("Fila do Foco Vermelho corrigida. Recomeçando do primeiro card.");
            } else {
              if (localSnapshot?.sessionId === matchingSession.id) {
                setResults(localSnapshot.results);
              }
              toast.success("Continuando de onde você parou!");
            }

            setIsLoading(false);
            return;
          }
        }`;

replaceExact(oldRestoreBlock, newRestoreBlock, 2, "database session restore blocks");

fs.writeFileSync(path, source);
