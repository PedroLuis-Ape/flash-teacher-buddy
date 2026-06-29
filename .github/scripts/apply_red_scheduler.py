from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"{label} not found")
    return text.replace(old, new, 1)


hook_path = Path("src/features/study/hooks/useStudyEngine.ts")
hook = hook_path.read_text()

hook = replace_once(
    hook,
    '''import {
  orderByIntelligence,
  reinjectFailedCard,
  type CardProgressLike,
} from "@/features/study/lib/intelligenceScoring";''',
    '''import {
  getRedCardTargetAppearances,
  injectRedListRepetitions,
  orderByIntelligence,
  reinjectFailedCard,
  type CardProgressLike,
} from "@/features/study/lib/intelligenceScoring";''',
    "study engine intelligence import",
)

legacy_scheduler_pattern = re.compile(
    r'''/\*\*\n \* Inject red-list cards as extra appearances with spaced repetition\..*?\n}\n\n(?=export function useStudyEngine)''',
    re.DOTALL,
)
hook, replacements = legacy_scheduler_pattern.subn("", hook, count=1)
if replacements != 1:
    raise SystemExit("legacy red scheduler block not found")

hook = replace_once(
    hook,
    '''      setCardsOrder((prev) =>
        reinjectFailedCard(prev, currentIndex, flashcardId, 5, 3)
      );''',
    '''      setCardsOrder((prev) => {
        const isRedCard = effectiveRedPlayableIds.includes(flashcardId);
        const maxAppearances = isRedCard
          ? Math.min(4, getRedCardTargetAppearances(flashcardsRef.current.length) + 1)
          : 2;
        return reinjectFailedCard(
          prev,
          currentIndex,
          flashcardId,
          5,
          3,
          maxAppearances,
        );
      });''',
    "failed-card reinjection call",
)

hook = replace_once(
    hook,
    '''  }, [listId, isAuthenticated, sessionId, isFlipMode, trackListStudied, scheduleFlush, updateTurmaActivity, trackAnswer, mode, cardsOrder.length, currentIndex]);''',
    '''  }, [listId, isAuthenticated, sessionId, isFlipMode, trackListStudied, scheduleFlush, updateTurmaActivity, trackAnswer, mode, cardsOrder.length, currentIndex, effectiveRedPlayableIds]);''',
    "recordResult dependency list",
)

hook_path.write_text(hook)


scoring_path = Path("src/features/study/lib/intelligenceScoring.ts")
scoring = scoring_path.read_text()

scheduler_code = '''const RED_CARD_EXTRA_RATE = 0.05;
const MIN_RED_TOTAL_APPEARANCES = 2;
const MAX_RED_TOTAL_APPEARANCES = 4;

/**
 * Proportional red-card frequency.
 * - every red card appears at least twice;
 * - larger decks gradually raise the target;
 * - no red card exceeds four planned appearances.
 */
export function getRedCardTargetAppearances(deckSize: number): number {
  const safeDeckSize = Math.max(0, Math.floor(deckSize));
  if (safeDeckSize === 0) return 0;

  const extraAppearances = Math.min(
    MAX_RED_TOTAL_APPEARANCES - 1,
    Math.max(
      MIN_RED_TOTAL_APPEARANCES - 1,
      Math.round(safeDeckSize * RED_CARD_EXTRA_RATE),
    ),
  );

  return 1 + extraAppearances;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function findBestRedInsertionIndex(
  order: string[],
  redId: string,
  redSet: Set<string>,
  salt: number,
): number {
  const candidateCount = order.length + 1;
  const preferredIndex = stableHash(`${redId}:${salt}`) % candidateCount;
  let bestIndex = order.length;
  let bestDistance = -1;
  let bestRedNeighborPenalty = Number.POSITIVE_INFINITY;
  let bestTieDistance = Number.POSITIVE_INFINITY;

  for (let candidate = 0; candidate <= order.length; candidate++) {
    const left = candidate > 0 ? order[candidate - 1] : undefined;
    const right = candidate < order.length ? order[candidate] : undefined;

    // Never place the same card back-to-back when another slot exists.
    if (left === redId || right === redId) continue;

    let nearestSameCard = Number.POSITIVE_INFINITY;
    for (let index = 0; index < order.length; index++) {
      if (order[index] !== redId) continue;
      const shiftedIndex = index >= candidate ? index + 1 : index;
      nearestSameCard = Math.min(
        nearestSameCard,
        Math.abs(shiftedIndex - candidate),
      );
    }

    const redNeighborPenalty =
      Number(Boolean(left && redSet.has(left))) +
      Number(Boolean(right && redSet.has(right)));
    const rawTieDistance = Math.abs(candidate - preferredIndex);
    const tieDistance = Math.min(
      rawTieDistance,
      candidateCount - rawTieDistance,
    );

    const isBetter =
      nearestSameCard > bestDistance ||
      (nearestSameCard === bestDistance && redNeighborPenalty < bestRedNeighborPenalty) ||
      (nearestSameCard === bestDistance &&
        redNeighborPenalty === bestRedNeighborPenalty &&
        tieDistance < bestTieDistance);

    if (isBetter) {
      bestIndex = candidate;
      bestDistance = nearestSameCard;
      bestRedNeighborPenalty = redNeighborPenalty;
      bestTieDistance = tieDistance;
    }
  }

  return bestIndex;
}

/**
 * Adds proportional, evenly separated appearances for red-list cards.
 * The base order is preserved; only the extra appearances are inserted.
 */
export function injectRedListRepetitions(
  cardIds: string[],
  redListIds: string[],
  isFavoritesMode: boolean,
): string[] {
  if (!isFavoritesMode || cardIds.length === 0 || redListIds.length === 0) {
    return cardIds;
  }

  const redSet = new Set(redListIds);
  const redInSession = Array.from(
    new Set(cardIds.filter((id) => redSet.has(id))),
  );
  if (redInSession.length === 0) return cardIds;

  const result = [...cardIds];
  const targetAppearances = getRedCardTargetAppearances(cardIds.length);
  const extraAppearances = Math.max(0, targetAppearances - 1);

  // Round-robin insertion prevents one red card from consuming a whole block.
  for (let round = 0; round < extraAppearances; round++) {
    redInSession.forEach((redId, redIndex) => {
      const insertAt = findBestRedInsertionIndex(
        result,
        redId,
        redSet,
        round * redInSession.length + redIndex,
      );
      result.splice(insertAt, 0, redId);
    });
  }

  return result;
}

'''

marker = '''/**
 * Re-inject a failed card a few slots ahead of `currentIndex` in the deck.
'''
scoring = replace_once(
    scoring,
    marker,
    scheduler_code + marker,
    "intelligence scoring insertion marker",
)

scoring = replace_once(
    scoring,
    '''export function reinjectFailedCard(
  order: string[],
  currentIndex: number,
  failedCardId: string,
  offset: number = 5,
  windowAhead: number = 3,
): string[] {
  if (currentIndex < 0 || currentIndex >= order.length) return order;
''',
    '''export function reinjectFailedCard(
  order: string[],
  currentIndex: number,
  failedCardId: string,
  offset: number = 5,
  windowAhead: number = 3,
  maxAppearances: number = Number.POSITIVE_INFINITY,
): string[] {
  if (currentIndex < 0 || currentIndex >= order.length) return order;
  const existingAppearances = order.reduce(
    (count, id) => count + Number(id === failedCardId),
    0,
  );
  if (existingAppearances >= maxAppearances) return order;
''',
    "reinjection signature",
)

scoring_path.write_text(scoring)


test_path = Path("src/features/study/lib/intelligenceScoring.test.ts")
tests = test_path.read_text()

tests = replace_once(
    tests,
    '''import {
  scoreCard,
  orderByIntelligence,
  reinjectFailedCard,
} from "./intelligenceScoring";''',
    '''import {
  getRedCardTargetAppearances,
  injectRedListRepetitions,
  scoreCard,
  orderByIntelligence,
  reinjectFailedCard,
} from "./intelligenceScoring";''',
    "test import block",
)

tests = replace_once(
    tests,
    '''  it("does not stack within lookahead window", () => {
    const order = ["a", "b", "x", "b", "y"];
    const out = reinjectFailedCard(order, 1, "b", 5, 3);
    expect(out).toBe(order); // same reference = no-op
  });
});''',
    '''  it("does not stack within lookahead window", () => {
    const order = ["a", "b", "x", "b", "y"];
    const out = reinjectFailedCard(order, 1, "b", 5, 3);
    expect(out).toBe(order); // same reference = no-op
  });

  it("respects the maximum number of appearances", () => {
    const order = ["a", "b", "c", "b", "d"];
    const out = reinjectFailedCard(order, 1, "b", 5, 3, 2);
    expect(out).toBe(order);
  });
});''',
    "last reinjection test block",
)

tests += '''

describe("red-list proportional scheduling", () => {
  it.each([
    [1, 2],
    [20, 2],
    [30, 3],
    [50, 4],
    [200, 4],
  ])("uses a proportional target for a %i-card deck", (deckSize, expected) => {
    expect(getRedCardTargetAppearances(deckSize)).toBe(expected);
  });

  it("shows a red card exactly twice in a 20-card deck", () => {
    const cards = Array.from({ length: 20 }, (_, index) => `card-${index}`);
    const out = injectRedListRepetitions(cards, ["card-7"], true);
    const positions = out
      .map((id, index) => id === "card-7" ? index : -1)
      .filter((index) => index >= 0);

    expect(positions).toHaveLength(2);
    expect(positions[1] - positions[0]).toBeGreaterThanOrEqual(8);
  });

  it("keeps every red card at the same proportional frequency", () => {
    const cards = Array.from({ length: 30 }, (_, index) => `card-${index}`);
    const redIds = ["card-2", "card-11", "card-24"];
    const out = injectRedListRepetitions(cards, redIds, true);

    for (const redId of redIds) {
      expect(out.filter((id) => id === redId)).toHaveLength(3);
      expect(out.some((id, index) => id === redId && out[index + 1] === redId)).toBe(false);
    }
  });
});
'''

test_path.write_text(tests)
