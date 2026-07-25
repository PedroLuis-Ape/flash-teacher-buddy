/**
 * Study session flow engine — pure, deterministic core shared by Write and Mixed modes.
 *
 * Two formats:
 *  - "mastery_rounds": rounds of up to MASTERY_ROUND_SIZE distinct cards. Incorrect,
 *    skipped and revealed cards return in later rounds until they are answered
 *    correctly. A card cannot appear twice within the same round.
 *  - "continuous": every eligible card is presented exactly once; results do not
 *    reinsert cards.
 *
 * Identity is opaque to the engine — callers pass canonical card IDs. The engine
 * never inspects card content and never persists transient state.
 */

export const MASTERY_ROUND_SIZE = 15;

export type StudyFlowMode = "mastery_rounds" | "continuous";

export type StudyCardResult = "correct" | "incorrect" | "skipped" | "revealed";

export interface MasterySessionState {
  readonly totalEligible: number;
  readonly roundSize: number;
  readonly shuffle: boolean;
  roundNumber: number;
  currentRoundIds: string[];
  currentRoundIndex: number;
  unseenIds: string[];
  retryIds: string[];
  masteredIds: string[];
  attemptsByCard: Record<string, number>;
  mistakesByCard: Record<string, number>;
  /** IDs answered correctly at least once during the current round. */
  correctThisRoundIds: string[];
  /** IDs that failed (incorrect/skipped/revealed) during the current round. */
  failedThisRoundIds: string[];
  /** Cards that came from retryIds when this round was composed. */
  reviewSourceThisRound: string[];
}

export interface RoundSummary {
  roundNumber: number;
  cardsPlayed: number;
  correctFirstTry: number;
  recoveredCards: number;
  incorrectCards: number;
  skippedCards: number;
  pendingReview: number;
  unseenRemaining: number;
  masteredTotal: number;
}

export interface CreateMasterySessionOptions {
  roundSize?: number;
  shuffle?: boolean;
  random?: () => number;
}

function shuffleInPlace<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const r = Math.min(Math.max(random(), 0), 0.9999999999999999);
    const j = Math.floor(r * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function dedupe(ids: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Build a continuous queue from eligible IDs. Each ID appears once.
 */
export function buildContinuousQueue(
  ids: ReadonlyArray<string>,
  options: { shuffle?: boolean; random?: () => number } = {},
): string[] {
  const unique = dedupe(ids);
  if (!options.shuffle) return unique;
  return shuffleInPlace([...unique], options.random ?? Math.random);
}

/**
 * Compose the next mastery round from remaining unseen + retry queues.
 * Retry IDs go to the front; remaining slots (up to roundSize) are filled with unseen.
 */
function composeRound(
  retryIds: ReadonlyArray<string>,
  unseenIds: ReadonlyArray<string>,
  roundSize: number,
): { roundIds: string[]; remainingRetry: string[]; remainingUnseen: string[]; reviewSource: string[] } {
  const roundIds: string[] = [];
  const seen = new Set<string>();
  const reviewSource: string[] = [];

  for (const id of retryIds) {
    if (roundIds.length >= roundSize) break;
    if (seen.has(id)) continue;
    seen.add(id);
    roundIds.push(id);
    reviewSource.push(id);
  }

  const remainingRetry = retryIds.slice(reviewSource.length);

  const unseenConsumed: string[] = [];
  for (const id of unseenIds) {
    if (roundIds.length >= roundSize) break;
    if (seen.has(id)) continue;
    seen.add(id);
    roundIds.push(id);
    unseenConsumed.push(id);
  }
  const remainingUnseen = unseenIds.slice(unseenConsumed.length);

  return { roundIds, remainingRetry, remainingUnseen, reviewSource };
}

/**
 * Create a fresh mastery session from eligible card IDs.
 */
export function createMasterySession(
  eligibleIds: ReadonlyArray<string>,
  options: CreateMasterySessionOptions = {},
): MasterySessionState {
  const roundSize = Math.max(1, Math.floor(options.roundSize ?? MASTERY_ROUND_SIZE));
  const shuffle = options.shuffle === true;
  const random = options.random ?? Math.random;
  const base = dedupe(eligibleIds);
  const pool = shuffle ? shuffleInPlace([...base], random) : base;

  const composed = composeRound([], pool, roundSize);

  return {
    totalEligible: base.length,
    roundSize,
    shuffle,
    roundNumber: 1,
    currentRoundIds: composed.roundIds,
    currentRoundIndex: 0,
    unseenIds: composed.remainingUnseen,
    retryIds: [],
    masteredIds: [],
    attemptsByCard: {},
    mistakesByCard: {},
    correctThisRoundIds: [],
    failedThisRoundIds: [],
    reviewSourceThisRound: composed.reviewSource,
  };
}

export function getCurrentCardId(state: MasterySessionState): string | null {
  if (state.currentRoundIndex >= state.currentRoundIds.length) return null;
  return state.currentRoundIds[state.currentRoundIndex] ?? null;
}

export function isRoundFinished(state: MasterySessionState): boolean {
  return state.currentRoundIndex >= state.currentRoundIds.length;
}

/**
 * True only when there are no unseen cards, no pending retries, and the current
 * round has been fully played through.
 */
export function isSessionFinished(state: MasterySessionState): boolean {
  return (
    isRoundFinished(state)
    && state.unseenIds.length === 0
    && state.retryIds.length === 0
    && state.failedThisRoundIds.length === 0
  );
}

/**
 * Record the result for the current card and advance the pointer.
 * Returns the updated state (same reference, mutated).
 */
export function recordResult(
  state: MasterySessionState,
  cardId: string,
  result: StudyCardResult,
): MasterySessionState {
  state.attemptsByCard[cardId] = (state.attemptsByCard[cardId] ?? 0) + 1;

  if (result === "correct") {
    if (!state.correctThisRoundIds.includes(cardId)) state.correctThisRoundIds.push(cardId);
    // If this card was queued for retry from earlier rounds it is now mastered.
    if (!state.masteredIds.includes(cardId)) state.masteredIds.push(cardId);
    // Drop from failed list in case of retry within round (not used today but defensive).
    state.failedThisRoundIds = state.failedThisRoundIds.filter((id) => id !== cardId);
  } else {
    state.mistakesByCard[cardId] = (state.mistakesByCard[cardId] ?? 0) + 1;
    if (!state.failedThisRoundIds.includes(cardId)) state.failedThisRoundIds.push(cardId);
  }

  state.currentRoundIndex += 1;
  return state;
}

/**
 * Snapshot summary of the round that just ended. Call before startNextRound.
 */
export function summarizeCurrentRound(state: MasterySessionState): RoundSummary {
  const cardsPlayed = state.currentRoundIds.length;
  const recoveredCards = state.correctThisRoundIds.filter((id) =>
    state.reviewSourceThisRound.includes(id),
  ).length;
  const correctFirstTry = state.correctThisRoundIds.length - recoveredCards;
  const incorrectCards = state.failedThisRoundIds.filter(
    (id) => (state.mistakesByCard[id] ?? 0) > 0,
  ).length;
  const skippedCards = 0; // captured inside failedThisRoundIds already; kept for API shape

  return {
    roundNumber: state.roundNumber,
    cardsPlayed,
    correctFirstTry: Math.max(0, correctFirstTry),
    recoveredCards,
    incorrectCards,
    skippedCards,
    pendingReview: state.retryIds.length + state.failedThisRoundIds.length,
    unseenRemaining: state.unseenIds.length,
    masteredTotal: state.masteredIds.length,
  };
}

/**
 * Advance from a finished round to the next round.
 * Merges this round's failures into retryIds, drops any card that was later
 * mastered, then composes the next round.
 */
export function startNextRound(state: MasterySessionState): MasterySessionState {
  if (!isRoundFinished(state)) return state;
  if (state.unseenIds.length === 0 && state.retryIds.length === 0 && state.failedThisRoundIds.length === 0) {
    return state;
  }

  // Merge failures into retry queue, preserving order and skipping any mastered cards.
  const mergedRetrySet = new Set<string>();
  const mergedRetry: string[] = [];
  const pushRetry = (id: string) => {
    if (state.masteredIds.includes(id)) return;
    if (mergedRetrySet.has(id)) return;
    mergedRetrySet.add(id);
    mergedRetry.push(id);
  };
  state.retryIds.forEach(pushRetry);
  state.failedThisRoundIds.forEach(pushRetry);

  const composed = composeRound(mergedRetry, state.unseenIds, state.roundSize);

  state.roundNumber += 1;
  state.currentRoundIds = composed.roundIds;
  state.currentRoundIndex = 0;
  state.unseenIds = composed.remainingUnseen;
  state.retryIds = composed.remainingRetry;
  state.correctThisRoundIds = [];
  state.failedThisRoundIds = [];
  state.reviewSourceThisRound = composed.reviewSource;
  return state;
}

/**
 * Convenience: number of cards in the whole session that are still not mastered
 * (used for progress display).
 */
export function pendingReviewCount(state: MasterySessionState): number {
  return state.retryIds.length + state.failedThisRoundIds.length;
}
