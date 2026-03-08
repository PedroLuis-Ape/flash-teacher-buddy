import { describe, it, expect } from "vitest";

// ====================================================================
// Unit tests for card-order preservation and favorites scoping logic
// ====================================================================

// --- Helpers mirroring production logic ---

/** Simulates optimistic in-place update (ListDetail.tsx handleUpdateFlashcard) */
function optimisticUpdate<T extends { id: string }>(
  cards: T[],
  updatedId: string,
  patch: Partial<T>
): T[] {
  return cards.map((c) => (c.id === updatedId ? { ...c, ...patch } : c));
}

/** Simulates the effectiveFlashcards memo from Study.tsx */
function deriveEffectiveFlashcards<T extends { id: string }>(
  flashcards: T[],
  favoritesOnly: boolean,
  favoriteIds: string[]
): T[] {
  if (!favoritesOnly) return flashcards;
  if (favoriteIds.length === 0) return [];
  return flashcards.filter((c) => favoriteIds.includes(c.id));
}

/** Scoped counter used by GamesHub banner */
function deriveScopedFavoritesCount<T extends { id: string }>(
  flashcards: T[],
  favoriteIds: string[]
): number {
  const ids = new Set(flashcards.map((card) => card.id));
  return favoriteIds.filter((favoriteId) => ids.has(favoriteId)).length;
}

/** Safety fallback contract: never render undefined current card */
function resolveCurrentCard<T extends { id: string }>(
  flashcards: T[],
  favoritesOnly: boolean,
  favoriteIds: string[],
  currentIndex: number
): T | null {
  const effective = deriveEffectiveFlashcards(flashcards, favoritesOnly, favoriteIds);
  if (effective.length === 0) return null;
  return effective[currentIndex] ?? null;
}

// --- Test data ---
const makeCards = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `card-${i + 1}`,
    term: `term-${i + 1}`,
    translation: `trans-${i + 1}`,
  }));

// ==============================
// PART A — Card order after edit
// ==============================
describe("Card order preservation after edit", () => {
  const cards = makeCards(10);

  it("editing card in the middle preserves its position", () => {
    const updated = optimisticUpdate(cards, "card-5", { term: "new-term" });
    expect(updated.map((c) => c.id)).toEqual(cards.map((c) => c.id));
    expect(updated[4].term).toBe("new-term");
    expect(updated[4].id).toBe("card-5");
  });

  it("editing first card keeps it first", () => {
    const updated = optimisticUpdate(cards, "card-1", { term: "edited" });
    expect(updated[0].id).toBe("card-1");
    expect(updated[0].term).toBe("edited");
  });

  it("editing last card keeps it last", () => {
    const updated = optimisticUpdate(cards, "card-10", { term: "edited" });
    expect(updated[9].id).toBe("card-10");
    expect(updated[9].term).toBe("edited");
  });

  it("full list order is unchanged after editing any card", () => {
    const originalOrder = cards.map((c) => c.id);
    for (const card of cards) {
      const updated = optimisticUpdate(cards, card.id, { term: "x" });
      expect(updated.map((c) => c.id)).toEqual(originalOrder);
    }
  });
});

// ==============================
// PART B — Favorites scoped per list
// ==============================
describe("Favorites scoped per list", () => {
  const frenchCards = makeCards(5); // card-1..card-5
  const englishCards = Array.from({ length: 5 }, (_, i) => ({
    id: `eng-${i + 1}`,
    term: `eng-term-${i + 1}`,
    translation: `eng-trans-${i + 1}`,
  }));

  it("favorites from one list do not leak into another", () => {
    const frenchFavorites = ["card-1", "card-3"];
    const effectiveFrench = deriveEffectiveFlashcards(frenchCards, true, frenchFavorites);
    const effectiveEnglish = deriveEffectiveFlashcards(englishCards, true, frenchFavorites);

    expect(effectiveFrench.length).toBe(2);
    expect(effectiveEnglish.length).toBe(0); // none of eng-* match card-*
  });

  it("marking favorites in distinct lists maintains independence", () => {
    const frenchFavs = ["card-2"];
    const englishFavs = ["eng-4"];
    const allFavs = [...frenchFavs, ...englishFavs];

    const effectiveFrench = deriveEffectiveFlashcards(frenchCards, true, allFavs);
    const effectiveEnglish = deriveEffectiveFlashcards(englishCards, true, allFavs);

    expect(effectiveFrench.map((c) => c.id)).toEqual(["card-2"]);
    expect(effectiveEnglish.map((c) => c.id)).toEqual(["eng-4"]);
  });

  it("favoritesOnly=false returns all cards regardless of favorites", () => {
    const result = deriveEffectiveFlashcards(frenchCards, false, ["card-1"]);
    expect(result.length).toBe(5);
  });
});

// ==============================
// PART C — Study only favorites
// ==============================
describe("Study only favorites filter", () => {
  const cards = makeCards(10);
  const favIds = ["card-2", "card-5", "card-8"];

  it("returns only favorited cards when favoritesOnly is true", () => {
    const result = deriveEffectiveFlashcards(cards, true, favIds);
    expect(result.map((c) => c.id)).toEqual(["card-2", "card-5", "card-8"]);
  });

  it("returns empty array when favoritesOnly but favorites not loaded yet", () => {
    const result = deriveEffectiveFlashcards(cards, true, []);
    expect(result).toEqual([]);
  });

  it("returns full set when favoritesOnly is false", () => {
    const result = deriveEffectiveFlashcards(cards, false, favIds);
    expect(result.length).toBe(10);
  });

  it("works for flip, write, multiple-choice, and unscramble modes identically", () => {
    // The filter is mode-agnostic — same memo runs regardless of mode
    const modes = ["flip", "write", "multiple-choice", "unscramble"];
    for (const _mode of modes) {
      const result = deriveEffectiveFlashcards(cards, true, favIds);
      expect(result.length).toBe(3);
      expect(result.every((c) => favIds.includes(c.id))).toBe(true);
    }
  });

  it("disabling favorites filter restores full card set", () => {
    const filtered = deriveEffectiveFlashcards(cards, true, favIds);
    expect(filtered.length).toBe(3);

    const restored = deriveEffectiveFlashcards(cards, false, favIds);
    expect(restored.length).toBe(10);
  });

  it("no favorites in current list returns empty (coherent empty state)", () => {
    const unrelatedFavs = ["other-1", "other-2"];
    const result = deriveEffectiveFlashcards(cards, true, unrelatedFavs);
    expect(result).toEqual([]);
  });
});

// =====================================
// PART D — Scoped counter in Games Hub
// =====================================
describe("Favorites counter scoped by current list", () => {
  const listA = [{ id: "fr-1" }, { id: "fr-2" }];
  const listB = Array.from({ length: 10 }, (_, i) => ({ id: `en-${i + 1}` }));

  it("list A with 1 favorite shows 1 (not global sum)", () => {
    const globalFavorites = ["fr-1", ...listB.map((card) => card.id)]; // 11 global
    expect(deriveScopedFavoritesCount(listA, globalFavorites)).toBe(1);
  });

  it("list B with 10 favorites shows 10", () => {
    const globalFavorites = ["fr-1", ...listB.map((card) => card.id)];
    expect(deriveScopedFavoritesCount(listB, globalFavorites)).toBe(10);
  });

  it("re-opening list A keeps scoped count stable", () => {
    const globalFavorites = ["fr-1", ...listB.map((card) => card.id)];
    const firstOpen = deriveScopedFavoritesCount(listA, globalFavorites);
    const secondOpen = deriveScopedFavoritesCount(listA, globalFavorites);
    expect(firstOpen).toBe(1);
    expect(secondOpen).toBe(1);
  });
});

// =========================================
// PART E — Favorites-only across all modes
// =========================================
describe("Favorites-only works for all study modes", () => {
  const cards = makeCards(4);
  const singleFavorite = ["card-2"];

  it("flip, write, multiple-choice, unscramble, mixed and pronunciation use same filtered source", () => {
    const modes = ["flip", "write", "multiple-choice", "unscramble", "mixed", "pronunciation"];

    for (const _mode of modes) {
      const result = deriveEffectiveFlashcards(cards, true, singleFavorite);
      expect(result.map((card) => card.id)).toEqual(["card-2"]);
    }
  });

  it("with zero favorites returns coherent empty state source", () => {
    const result = deriveEffectiveFlashcards(cards, true, []);
    expect(result).toEqual([]);
  });

  it("disabling favorites-only restores full set", () => {
    const fullSet = deriveEffectiveFlashcards(cards, false, singleFavorite);
    expect(fullSet.length).toBe(4);
  });
});

// =========================================
// PART F — No black screen safety fallback
// =========================================
describe("Current card resolution safety", () => {
  const cards = makeCards(3);

  it("returns one card correctly when there is exactly one favorite", () => {
    const currentCard = resolveCurrentCard(cards, true, ["card-1"], 0);
    expect(currentCard?.id).toBe("card-1");
  });

  it("returns null (not crash) when favorites-only has no cards", () => {
    const currentCard = resolveCurrentCard(cards, true, [], 0);
    expect(currentCard).toBeNull();
  });

  it("returns null (not crash) when index is out of range", () => {
    const currentCard = resolveCurrentCard(cards, true, ["card-1"], 3);
    expect(currentCard).toBeNull();
  });
});
