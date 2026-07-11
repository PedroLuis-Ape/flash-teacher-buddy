import fs from "node:fs";

// One-time branch patch: the workflow removes this helper before merge.
const path = "src/features/study/hooks/useStudyEngine.ts";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(label, pattern, replacement) {
  const next = source.replace(pattern, replacement);
  if (next === source) {
    throw new Error(`Transformation not applied: ${label}`);
  }
  source = next;
}

replaceOnce(
  "snapshot helper import",
  /  readStudySnapshot,\n  writeStudySnapshot,/,
  `  readStudySnapshot,\n  sanitizePersistedStudyOrder,\n  writeStudySnapshot,`,
);

replaceOnce(
  "local snapshot red-focus sanitation",
  /      const localSnapshot = readStudySnapshot\(studySnapshotKey, snapshotCardIds\);/,
  `      const localSnapshot = readStudySnapshot(studySnapshotKey, snapshotCardIds, {\n        enforceUniqueOrder: !!gameSettings.redFocus,\n      });`,
);

replaceOnce(
  "persisted session sanitizer",
  /      const availableCardIds = new Set\(flashcards\.map\(\(card\) => card\.id\)\);[\s\S]*?      const sessionMatchesCurrentScope = \(sessionOrder: unknown\): boolean => \{[\s\S]*?      \};/,
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
);

const repairedRestoreBlock = `        if (matchingSession) {
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

replaceOnce(
  "flip database restore",
  /        if \(matchingSession\) \{\n          const scopedOrder = sanitizeSessionOrder\(matchingSession\.cards_order\);[\s\S]*?        \}\n\n        \/\/ Fallback to localStorage/,
  `${repairedRestoreBlock}\n\n        // Fallback to localStorage`,
);

replaceOnce(
  "quiz database restore",
  /      if \(matchingSession\) \{\n        const scopedOrder = sanitizeSessionOrder\(matchingSession\.cards_order\);[\s\S]*?      \}\n\n      \/\/ Create new session with ALL flashcards/,
  `${repairedRestoreBlock.replace(/^ {8}/gm, "      ")}\n\n      // Create new session with ALL flashcards`,
);

fs.writeFileSync(path, source);
