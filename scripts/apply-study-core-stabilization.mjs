import fs from "node:fs";

function replaceOnce(source, matcher, replacement, label) {
  const next = source.replace(matcher, replacement);
  if (next === source) {
    throw new Error(`Transformation not applied: ${label}`);
  }
  return next;
}

const studyPath = "src/pages/Study.tsx";
let study = fs.readFileSync(studyPath, "utf8");

study = replaceOnce(
  study,
  'import { resolveCardStatusIdentity } from "@/features/cards/lib/cardStatusIdentity";\n',
  'import { resolveCardStatusIdentity } from "@/features/cards/lib/cardStatusIdentity";\nimport { filterCardsForStudyScope } from "@/features/study/lib/studyScopePolicy";\n',
  "Study scope policy import",
);

study = replaceOnce(
  study,
  /  \/\/ Derive effective flashcards filtered by favorites when enabled\.[\s\S]*?  \}, \[flashcards, urlFavoritesOnly, favorites, redFocusActiveForDeck, redListIds\]\);/,
  `  // The visible deck follows a local session scope immediately. Preferences\n  // remain persistence only; they are not used as a delayed live filter.\n  const [deckSubset, setDeckSubset] = useState<"all" | "favorites">(initialGameSettings.subset);\n  const [redFocusActiveForDeck, setRedFocusActiveForDeck] = useState(false);\n\n  const favoritesFilterFellBack =\n    !redFocusActiveForDeck &&\n    deckSubset === "favorites" &&\n    favoritesConfirmedZero &&\n    flashcards.length > 0;\n\n  const effectiveFlashcards = useMemo(() => {\n    const scoped = filterCardsForStudyScope({\n      cards: flashcards,\n      favoriteIds: favorites,\n      redListIds,\n      settings: { subset: deckSubset, redFocus: redFocusActiveForDeck },\n    });\n\n    // Favorites keeps the historical safe fallback. Red focus intentionally\n    // stays empty when the user has no red cards; mixing normal cards would\n    // violate the selected scope.\n    if (!redFocusActiveForDeck && deckSubset === "favorites" && favorites.length === 0) {\n      return flashcards;\n    }\n\n    return scoped;\n  }, [flashcards, favorites, redListIds, deckSubset, redFocusActiveForDeck]);`,
  "Study effective deck",
);

study = replaceOnce(
  study,
  "  const redFocusActive = !!gameSettings.redFocus && favoritesOnly;",
  "  const redFocusActive = !!gameSettings.redFocus;",
  "Study red focus derivation",
);

study = replaceOnce(
  study,
  `    setGameSettings({\n      mode: prefs.order === "sequential" ? "sequential" : "random",\n      subset: prefs.favoritesOnly ? "favorites" : "all",\n      fastMode: prefs.fastMode,\n    });`,
  `    setGameSettings({\n      mode: prefs.order === "sequential" ? "sequential" : "random",\n      subset: prefs.favoritesOnly ? "favorites" : "all",\n      fastMode: prefs.fastMode,\n      redFocus: false,\n    });\n    setDeckSubset(prefs.favoritesOnly ? "favorites" : "all");\n    setRedFocusActiveForDeck(false);`,
  "Study initial settings sync",
);

study = replaceOnce(
  study,
  /  const handleSettingsChange = \(newSettings: GameSettings\) => \{[\s\S]*?\n  \};\n\n  const handleRestartWithSettings/,
  `  const handleSettingsChange = (newSettings: GameSettings) => {\n    const coerced: GameSettings = {\n      ...newSettings,\n      mode: newSettings.redFocus ? "sequential" : newSettings.mode,\n      redFocus: !!newSettings.redFocus,\n    };\n\n    const subsetChanged = coerced.subset !== gameSettings.subset;\n    const redFocusChanged = !!coerced.redFocus !== !!gameSettings.redFocus;\n\n    if (subsetChanged || redFocusChanged) {\n      void saveProgressNow();\n    }\n\n    setDeckSubset(coerced.subset);\n    setRedFocusActiveForDeck(!!coerced.redFocus);\n    setGameSettings(coerced);\n    updatePrefs({\n      order: coerced.mode === "sequential" ? "sequential" : "random",\n      favoritesOnly: coerced.subset === "favorites",\n      fastMode: coerced.fastMode ?? false,\n    });\n  };\n\n  const handleRestartWithSettings`,
  "Study settings handler",
);

fs.writeFileSync(studyPath, study);

const enginePath = "src/features/study/hooks/useStudyEngine.ts";
let engine = fs.readFileSync(enginePath, "utf8");

engine = replaceOnce(
  engine,
  'import {\n  buildCanonicalToPlayableMap,\n  mapCanonicalIdsToPlayable,\n} from "@/features/cards/lib/cardStatusIdentity";\n',
  'import {\n  buildCanonicalToPlayableMap,\n  mapCanonicalIdsToPlayable,\n} from "@/features/cards/lib/cardStatusIdentity";\nimport { shouldInjectRedPriority } from "@/features/study/lib/studyScopePolicy";\n',
  "Engine scope policy import",
);

engine = replaceOnce(
  engine,
  `  /** When true (and subset === 'favorites'), the parent restricts the deck\n   *  to favorites that are also red-listed. The engine itself does not\n   *  re-filter — it trusts the deck it receives. We carry the flag here\n   *  so it survives restartSession() round-trips. */`,
  `  /** Independent red-only study scope. The parent supplies the filtered\n   *  deck; the engine preserves it as a sequential, non-repeating run. */`,
  "Engine red focus comment",
);

engine = engine.replace(
  /mode === "mixed" \|\| gameSettings\.mode === "random"/g,
  '(mode === "mixed" && !gameSettings.redFocus) || gameSettings.mode === "random"',
);

engine = replaceOnce(
  engine,
  `        ?? (mode === "mixed"\n          ? await getPrioritizedFlashcards(user.id, listId, flashcards, true)\n          : gameSettings.mode === "sequential"`,
  `        ?? (mode === "mixed" && !gameSettings.redFocus\n          ? await getPrioritizedFlashcards(user.id, listId, flashcards, true)\n          : gameSettings.mode === "sequential"`,
  "Engine mixed initialization",
);

engine = engine.replace(
  /gameSettings\.subset === 'favorites'/g,
  "shouldInjectRedPriority(gameSettings)",
);

engine = replaceOnce(
  engine,
  `      FEATURE_FLAGS.intelligent_study_engine &&\n      mode === "mixed" &&\n      !skipped &&`,
  `      FEATURE_FLAGS.intelligent_study_engine &&\n      mode === "mixed" &&\n      !gameSettings.redFocus &&\n      !skipped &&`,
  "Engine adaptive reinjection guard",
);

engine = replaceOnce(
  engine,
  `  }, [listId, isAuthenticated, sessionId, isFlipMode, trackListStudied, scheduleFlush, updateTurmaActivity, trackAnswer, mode, cardsOrder.length, currentIndex]);`,
  `  }, [listId, isAuthenticated, sessionId, isFlipMode, trackListStudied, scheduleFlush, updateTurmaActivity, trackAnswer, mode, cardsOrder.length, currentIndex, gameSettings.redFocus]);`,
  "Engine record result dependencies",
);

fs.writeFileSync(enginePath, engine);
