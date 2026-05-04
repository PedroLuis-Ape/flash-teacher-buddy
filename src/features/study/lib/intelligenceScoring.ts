/**
 * Study Intelligence Engine — pure scoring helpers.
 *
 * All functions are side-effect free. Behavior is gated at the call site
 * by FEATURE_FLAGS.intelligent_study_engine.
 *
 * Scoring formula (per card, higher = study sooner):
 *   0.30 * newness        (1 if never seen, else 0)
 * + 0.25 * missRate       (incorrect / max(1, correct + incorrect))
 * + 0.15 * recency        (1 - recencyDecay; older = higher)
 * + 0.10 * redListBoost   (1 if in red list, else 0)
 * - 0.20 * mastery        (correct / max(1, correct + incorrect)), only after >=2 attempts
 */

export interface CardProgressLike {
  flashcard_id: string;
  correct_count?: number | null;
  incorrect_count?: number | null;
  last_reviewed?: string | null;
}

export interface ScoreInput {
  id: string;
  progress?: CardProgressLike;
  isRed?: boolean;
  /** "now" reference for recency (ms epoch). Defaults to Date.now(). */
  nowMs?: number;
}

/** Decay window: a card last seen >= 14 days ago is treated as fully "stale". */
const RECENCY_HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;

export function scoreCard({ progress, isRed, nowMs }: ScoreInput): number {
  const correct = progress?.correct_count ?? 0;
  const incorrect = progress?.incorrect_count ?? 0;
  const attempts = correct + incorrect;

  const newness = attempts === 0 ? 1 : 0;
  const missRate = attempts === 0 ? 0 : incorrect / Math.max(1, attempts);
  const mastery = attempts >= 2 ? correct / Math.max(1, attempts) : 0;

  let recency = 0;
  if (progress?.last_reviewed) {
    const last = Date.parse(progress.last_reviewed);
    if (!Number.isNaN(last)) {
      const ageMs = (nowMs ?? Date.now()) - last;
      // Linear decay clipped to [0, 1]: brand new = 0, ≥14d = 1
      recency = Math.max(0, Math.min(1, ageMs / RECENCY_HALF_LIFE_MS));
    }
  } else if (attempts > 0) {
    // Seen without timestamp — assume moderately stale
    recency = 0.5;
  }

  const redBoost = isRed ? 1 : 0;

  return (
    0.30 * newness +
    0.25 * missRate +
    0.15 * recency +
    0.10 * redBoost -
    0.20 * mastery
  );
}

/**
 * Order cards by intelligence score (descending). Stable: ties broken by
 * original input order (NOT random) so callers can shuffle upstream if desired.
 */
export function orderByIntelligence(
  cards: { id: string }[],
  progressByCardId: Map<string, CardProgressLike>,
  redSet: Set<string>,
  nowMs: number = Date.now(),
): string[] {
  const indexed = cards.map((c, i) => ({
    id: c.id,
    i,
    score: scoreCard({
      id: c.id,
      progress: progressByCardId.get(c.id),
      isRed: redSet.has(c.id),
      nowMs,
    }),
  }));
  indexed.sort((a, b) => (b.score - a.score) || (a.i - b.i));
  return indexed.map((x) => x.id);
}

/**
 * Re-inject a failed card a few slots ahead of `currentIndex` in the deck.
 *
 * Returns a NEW array. No-ops (returns same array) when:
 * - currentIndex is past the end
 * - the card already appears within the next `windowAhead` slots (avoid stacking)
 *
 * Default offset = 5 slots, clamped to deck end.
 */
export function reinjectFailedCard(
  order: string[],
  currentIndex: number,
  failedCardId: string,
  offset: number = 5,
  windowAhead: number = 3,
): string[] {
  if (currentIndex < 0 || currentIndex >= order.length) return order;

  const lookaheadEnd = Math.min(order.length, currentIndex + 1 + windowAhead);
  for (let i = currentIndex + 1; i < lookaheadEnd; i++) {
    if (order[i] === failedCardId) return order;
  }

  const insertAt = Math.min(order.length, currentIndex + 1 + offset);
  const next = order.slice();
  next.splice(insertAt, 0, failedCardId);
  return next;
}