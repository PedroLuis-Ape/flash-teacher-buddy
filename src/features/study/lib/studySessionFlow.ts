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
export type MasterySessionStatus = "active" | "round-complete" | "journey-complete";

export interface MasterySessionState {
  readonly version: 2;
  readonly totalEligible: number;
  readonly roundSize: number;
  readonly shuffle: boolean;
  status: MasterySessionStatus;
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
  /** Final result submitted for each card in the current round. */
  currentRoundResults: Record<string, StudyCardResult>;
}

export interface RoundSummary {
  roundNumber: number;
  cardsPlayed: number;
  correctFirstTry: number;
  correctCards: number;
  recoveredCards: number;
  incorrectCards: number;
  skippedCards: number;
  revealedCards: number;
  pendingReview: number;
  unseenRemaining: number;
  masteredTotal: number;
}

export interface CreateMasterySessionOptions {
  roundSize?: number;
  shuffle?: boolean;
  random?: () => number;
}

export interface MasteryStateValidation {
  valid: boolean;
  issues: string[];
}

function normalizeRoundSize(value: number | undefined): number {
  const requested = value ?? MASTERY_ROUND_SIZE;
  if (!Number.isFinite(requested)) return MASTERY_ROUND_SIZE;
  return Math.min(MASTERY_ROUND_SIZE, Math.max(1, Math.floor(requested)));
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
export function composeMasteryRound(
  retryIds: ReadonlyArray<string>,
  unseenIds: ReadonlyArray<string>,
  roundSize: number,
  masteredIds: ReadonlyArray<string> = [],
): { roundIds: string[]; remainingRetry: string[]; remainingUnseen: string[]; reviewSource: string[] } {
  const maxRoundSize = normalizeRoundSize(roundSize);
  const roundIds: string[] = [];
  const seen = new Set<string>();
  const reviewSource: string[] = [];
  const mastered = new Set(dedupe(masteredIds));
  const retryPool = dedupe(retryIds).filter((id) => !mastered.has(id));
  const retrySet = new Set(retryPool);
  const unseenPool = dedupe(unseenIds).filter((id) => !mastered.has(id) && !retrySet.has(id));

  for (const id of retryPool) {
    if (roundIds.length >= maxRoundSize) break;
    if (seen.has(id)) continue;
    seen.add(id);
    roundIds.push(id);
    reviewSource.push(id);
  }

  const remainingRetry = retryPool.slice(reviewSource.length);

  const unseenConsumed: string[] = [];
  for (const id of unseenPool) {
    if (roundIds.length >= maxRoundSize) break;
    if (seen.has(id)) continue;
    seen.add(id);
    roundIds.push(id);
    unseenConsumed.push(id);
  }
  const remainingUnseen = unseenPool.slice(unseenConsumed.length);

  return { roundIds, remainingRetry, remainingUnseen, reviewSource };
}

/**
 * Create a fresh mastery session from eligible card IDs.
 */
export function createMasterySession(
  eligibleIds: ReadonlyArray<string>,
  options: CreateMasterySessionOptions = {},
): MasterySessionState {
  const roundSize = normalizeRoundSize(options.roundSize);
  const shuffle = options.shuffle === true;
  const random = options.random ?? Math.random;
  const base = dedupe(eligibleIds);
  const pool = shuffle ? shuffleInPlace([...base], random) : base;

  const composed = composeMasteryRound([], pool, roundSize);

  return {
    version: 2,
    totalEligible: base.length,
    roundSize,
    shuffle,
    status: composed.roundIds.length === 0 ? "journey-complete" : "active",
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
    currentRoundResults: {},
  };
}

export function getCurrentCardId(state: MasterySessionState): string | null {
  if (state.currentRoundIndex >= state.currentRoundIds.length) return null;
  return state.currentRoundIds[state.currentRoundIndex] ?? null;
}

export function isRoundFinished(state: MasterySessionState): boolean {
  return state.status !== "active" || state.currentRoundIndex >= state.currentRoundIds.length;
}

/**
 * True only when there are no unseen cards, no pending retries, and the current
 * round has been fully played through.
 */
export function isSessionFinished(state: MasterySessionState): boolean {
  return state.status === "journey-complete";
}

function removeId(ids: string[], id: string): void {
  for (let index = ids.length - 1; index >= 0; index -= 1) {
    if (ids[index] === id) ids.splice(index, 1);
  }
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
  if (state.status !== "active") return state;
  const currentCardId = getCurrentCardId(state);
  if (!currentCardId || currentCardId !== cardId) return state;
  if (state.currentRoundResults[cardId]) return state;

  state.attemptsByCard[cardId] = (state.attemptsByCard[cardId] ?? 0) + 1;
  state.currentRoundResults[cardId] = result;

  // A submitted answer is authoritative for the card's queue membership. This
  // also repairs a stale/corrupt snapshot that left the current card in a
  // previous queue or marked it mastered before the new result was recorded.
  removeId(state.unseenIds, cardId);
  removeId(state.retryIds, cardId);

  if (result === "correct") {
    if (!state.correctThisRoundIds.includes(cardId)) state.correctThisRoundIds.push(cardId);
    // If this card was queued for retry from earlier rounds it is now mastered.
    if (!state.masteredIds.includes(cardId)) state.masteredIds.push(cardId);
    // Drop from failed list in case of retry within round (not used today but defensive).
    state.failedThisRoundIds = state.failedThisRoundIds.filter((id) => id !== cardId);
  } else {
    removeId(state.masteredIds, cardId);
    removeId(state.correctThisRoundIds, cardId);
    state.mistakesByCard[cardId] = (state.mistakesByCard[cardId] ?? 0) + 1;
    if (!state.failedThisRoundIds.includes(cardId)) state.failedThisRoundIds.push(cardId);
  }

  state.currentRoundIndex += 1;
  if (state.currentRoundIndex >= state.currentRoundIds.length) {
    const journeyComplete = state.unseenIds.length === 0
      && state.retryIds.length === 0
      && state.failedThisRoundIds.length === 0
      && new Set(state.masteredIds).size === state.totalEligible;
    state.status = journeyComplete ? "journey-complete" : "round-complete";
  }

  return state;
}

function addValidationIssue(issues: string[], message: string): void {
  if (!issues.includes(message)) issues.push(message);
}

function checkDuplicateIds(
  issues: string[],
  label: string,
  ids: ReadonlyArray<string>,
): void {
  if (new Set(ids).size !== ids.length) {
    addValidationIssue(issues, `${label} contains duplicate IDs`);
  }
}

function checkDisjoint(
  issues: string[],
  leftLabel: string,
  left: ReadonlyArray<string>,
  rightLabel: string,
  right: ReadonlyArray<string>,
): void {
  const rightSet = new Set(right);
  if (left.some((id) => rightSet.has(id))) {
    addValidationIssue(issues, `${leftLabel} overlaps ${rightLabel}`);
  }
}

/**
 * Validate the state machine without mutating it. The active round is allowed
 * to overlap masteredIds only for cards with a recorded correct result: the
 * card remains in currentRoundIds as historical round context until the next
 * round is composed. All other queues are pairwise disjoint.
 */
export function validateMasterySessionState(
  state: MasterySessionState,
  eligibleCardIds?: ReadonlySet<string>,
): MasteryStateValidation {
  const issues: string[] = [];
  const queueEntries = [
    ["currentRoundIds", state.currentRoundIds],
    ["unseenIds", state.unseenIds],
    ["retryIds", state.retryIds],
    ["masteredIds", state.masteredIds],
    ["correctThisRoundIds", state.correctThisRoundIds],
    ["failedThisRoundIds", state.failedThisRoundIds],
    ["reviewSourceThisRound", state.reviewSourceThisRound],
  ] as const;

  if (state.version !== 2) addValidationIssue(issues, "unsupported state version");
  if (!Number.isInteger(state.totalEligible) || state.totalEligible < 0) {
    addValidationIssue(issues, "totalEligible must be a non-negative integer");
  }
  if (!Number.isInteger(state.roundSize) || state.roundSize < 1 || state.roundSize > MASTERY_ROUND_SIZE) {
    addValidationIssue(issues, `roundSize must be between 1 and ${MASTERY_ROUND_SIZE}`);
  }
  if (!Number.isInteger(state.roundNumber) || state.roundNumber < 1) {
    addValidationIssue(issues, "roundNumber must be a positive integer");
  }
  if (!Number.isInteger(state.currentRoundIndex)
    || state.currentRoundIndex < 0
    || state.currentRoundIndex > state.currentRoundIds.length) {
    addValidationIssue(issues, "currentRoundIndex is outside the current round");
  }
  if (state.currentRoundIds.length > MASTERY_ROUND_SIZE || state.currentRoundIds.length > state.roundSize) {
    addValidationIssue(issues, "current round exceeds its configured size");
  }

  for (const [label, ids] of queueEntries) {
    checkDuplicateIds(issues, label, ids);
    if (ids.some((id) => typeof id !== "string" || id.length === 0)) {
      addValidationIssue(issues, `${label} contains an invalid ID`);
    }
  }

  checkDisjoint(issues, "currentRoundIds", state.currentRoundIds, "unseenIds", state.unseenIds);
  checkDisjoint(issues, "currentRoundIds", state.currentRoundIds, "retryIds", state.retryIds);
  checkDisjoint(issues, "unseenIds", state.unseenIds, "retryIds", state.retryIds);
  checkDisjoint(issues, "unseenIds", state.unseenIds, "masteredIds", state.masteredIds);
  checkDisjoint(issues, "retryIds", state.retryIds, "masteredIds", state.masteredIds);

  const currentSet = new Set(state.currentRoundIds);
  const unseenSet = new Set(state.unseenIds);
  const retrySet = new Set(state.retryIds);
  const masteredSet = new Set(state.masteredIds);
  const union = new Set([...currentSet, ...unseenSet, ...retrySet, ...masteredSet]);

  if (union.size !== state.totalEligible) {
    addValidationIssue(issues, "queue union does not match totalEligible");
  }
  if (eligibleCardIds) {
    if (union.size !== eligibleCardIds.size) {
      addValidationIssue(issues, "queue union does not match eligible card IDs");
    }
    for (const id of union) {
      if (!eligibleCardIds.has(id)) addValidationIssue(issues, "state contains an ineligible card ID");
    }
    for (const id of eligibleCardIds) {
      if (!union.has(id)) addValidationIssue(issues, "state is missing an eligible card ID");
    }
  }

  const currentResults = state.currentRoundResults;
  for (const [id, result] of Object.entries(currentResults)) {
    if (!currentSet.has(id)) addValidationIssue(issues, "currentRoundResults contains a non-current card");
    if (!(["correct", "incorrect", "skipped", "revealed"] as StudyCardResult[]).includes(result)) {
      addValidationIssue(issues, "currentRoundResults contains an invalid result");
    }
  }
  for (const id of state.masteredIds) {
    if (currentSet.has(id) && currentResults[id] !== "correct") {
      addValidationIssue(issues, "a current non-correct card is marked mastered");
    }
  }
  for (const id of state.correctThisRoundIds) {
    if (!currentSet.has(id) || currentResults[id] !== "correct") {
      addValidationIssue(issues, "correctThisRoundIds disagrees with current results");
    }
  }
  for (const id of state.failedThisRoundIds) {
    const unresolvedAtRoundEnd = !currentResults[id]
      && state.currentRoundIndex === state.currentRoundIds.length;
    if (!currentSet.has(id) || currentResults[id] === "correct" || (!currentResults[id] && !unresolvedAtRoundEnd)) {
      addValidationIssue(issues, "failedThisRoundIds disagrees with current results");
    }
  }
  for (const [label, record] of [["attemptsByCard", state.attemptsByCard], ["mistakesByCard", state.mistakesByCard]] as const) {
    for (const [id, count] of Object.entries(record)) {
      if (!union.has(id) || !Number.isInteger(count) || count < 0) {
        addValidationIssue(issues, `${label} contains an invalid entry`);
      }
    }
  }

  if (state.status === "active") {
    if (state.currentRoundIndex >= state.currentRoundIds.length || !getCurrentCardId(state)) {
      addValidationIssue(issues, "active state has no current card");
    }
  } else if (state.currentRoundIndex !== state.currentRoundIds.length) {
    addValidationIssue(issues, `${state.status} state is not at the end of the round`);
  }

  const noPending = state.unseenIds.length === 0
    && state.retryIds.length === 0
    && state.failedThisRoundIds.length === 0;
  if (state.status === "round-complete" && noPending) {
    addValidationIssue(issues, "round-complete state has no pending work");
  }
  if (state.status === "journey-complete"
    && (!noPending || masteredSet.size !== state.totalEligible)) {
    addValidationIssue(issues, "journey-complete state still has unmastered work");
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Snapshot summary of the round that just ended. Call before startNextRound.
 */
export function summarizeCurrentRound(state: MasterySessionState): RoundSummary {
  const entries = Object.entries(state.currentRoundResults);
  const cardsPlayed = entries.length;
  const correctIds = entries.filter(([, result]) => result === "correct").map(([id]) => id);
  const recoveredCards = correctIds.filter((id) => state.reviewSourceThisRound.includes(id)).length;
  const correctCards = correctIds.length;
  const correctFirstTry = correctCards - recoveredCards;
  const incorrectCards = entries.filter(([, result]) => result === "incorrect").length;
  const skippedCards = entries.filter(([, result]) => result === "skipped").length;
  const revealedCards = entries.filter(([, result]) => result === "revealed").length;

  return {
    roundNumber: state.roundNumber,
    cardsPlayed,
    correctFirstTry: Math.max(0, correctFirstTry),
    correctCards,
    recoveredCards,
    incorrectCards,
    skippedCards,
    revealedCards,
    pendingReview: state.retryIds.length + state.failedThisRoundIds.length,
    unseenRemaining: state.unseenIds.length,
    masteredTotal: new Set(state.masteredIds).size,
  };
}

/**
 * Advance from a finished round to the next round.
 * Merges this round's failures into retryIds, drops any card that was later
 * mastered, then composes the next round.
 */
export function startNextRound(state: MasterySessionState): MasterySessionState {
  if (state.status !== "round-complete") return state;
  if (isSessionFinished(state)) {
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

  const composed = composeMasteryRound(
    mergedRetry,
    state.unseenIds,
    state.roundSize,
    state.masteredIds,
  );

  state.roundNumber += 1;
  state.currentRoundIds = composed.roundIds;
  state.currentRoundIndex = 0;
  state.unseenIds = composed.remainingUnseen;
  state.retryIds = composed.remainingRetry;
  state.correctThisRoundIds = [];
  state.failedThisRoundIds = [];
  state.reviewSourceThisRound = composed.reviewSource;
  state.currentRoundResults = {};
  state.status = composed.roundIds.length === 0 ? "journey-complete" : "active";
  return state;
}

/**
 * Convenience: number of cards in the whole session that are still not mastered
 * (used for progress display).
 */
export function pendingReviewCount(state: MasterySessionState): number {
  return state.retryIds.length + state.failedThisRoundIds.length;
}
