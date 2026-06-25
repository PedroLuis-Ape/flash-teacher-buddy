export type MixedActivityMode = "write" | "multiple-choice" | "unscramble";

export type MixedSessionStatus =
  | "active"
  | "round-failed"
  | "round-complete"
  | "journey-complete";

export interface AdaptiveMixedSessionState {
  version: 1;
  deckSignature: string;
  allCardIds: string[];
  unseenCardIds: string[];
  pendingCardIds: string[];
  masteredCardIds: string[];
  currentRoundCardIds: string[];
  currentRoundOrigins: Record<string, "pending" | "new">;
  currentRoundErrors: string[];
  currentRoundAnswered: string[];
  activityByCardId: Record<string, MixedActivityMode>;
  lastActivityByCardId: Record<string, MixedActivityMode>;
  currentIndex: number;
  roundNumber: number;
  roundSize: number;
  attemptNumber: number;
  hearts: number;
  maxHearts: number;
  status: MixedSessionStatus;
  updatedAt: number;
}

export interface CreateAdaptiveMixedSessionOptions {
  random?: () => number;
  weightByCardId?: Readonly<Record<string, number>>;
}

const MAX_HEARTS = 3;
const ACTIVITY_PATTERN: readonly MixedActivityMode[] = [
  "write",
  "multiple-choice",
  "unscramble",
  "write",
  "unscramble",
  "multiple-choice",
];

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function signature(cardIds: readonly string[]): string {
  return [...unique(cardIds)].sort().join("|");
}

export function shuffleMixedCards<T>(values: readonly T[], random: () => number = Math.random): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

export function getAdaptiveRoundSize(totalCards: number): number {
  const total = Math.max(0, Math.floor(totalCards));
  if (total <= 15) return total;
  if (total <= 35) return 10;
  return 15;
}

export function weightedShuffleMixedCards(
  cardIds: readonly string[],
  weightByCardId: Readonly<Record<string, number>> = {},
  random: () => number = Math.random,
): string[] {
  return unique(cardIds)
    .map((cardId, originalIndex) => {
      const weight = Math.max(0.01, Number(weightByCardId[cardId]) || 1);
      const sample = Math.max(Number.EPSILON, random());
      return {
        cardId,
        originalIndex,
        key: Math.pow(sample, 1 / weight),
      };
    })
    .sort((left, right) => (right.key - left.key) || (left.originalIndex - right.originalIndex))
    .map((entry) => entry.cardId);
}

function assignActivities(
  cardIds: readonly string[],
  previousByCardId: Readonly<Record<string, MixedActivityMode>>,
  random: () => number,
): {
  activityByCardId: Record<string, MixedActivityMode>;
  lastActivityByCardId: Record<string, MixedActivityMode>;
} {
  const offset = Math.floor(random() * ACTIVITY_PATTERN.length);
  const activityByCardId: Record<string, MixedActivityMode> = {};
  const lastActivityByCardId: Record<string, MixedActivityMode> = { ...previousByCardId };

  cardIds.forEach((cardId, index) => {
    const previous = previousByCardId[cardId];
    let candidate = ACTIVITY_PATTERN[(offset + index) % ACTIVITY_PATTERN.length];
    if (candidate === previous) {
      candidate = ACTIVITY_PATTERN[(offset + index + 1) % ACTIVITY_PATTERN.length];
    }
    activityByCardId[cardId] = candidate;
    lastActivityByCardId[cardId] = candidate;
  });

  return { activityByCardId, lastActivityByCardId };
}

function mountRound(
  state: AdaptiveMixedSessionState,
  random: () => number,
  incrementRound: boolean,
): AdaptiveMixedSessionState {
  const pending = unique(state.pendingCardIds);
  const pendingForRound = shuffleMixedCards(pending, random).slice(0, state.roundSize);
  const remainingSlots = Math.max(0, state.roundSize - pendingForRound.length);
  const newForRound = state.unseenCardIds.slice(0, remainingSlots);
  const nextUnseen = state.unseenCardIds.slice(newForRound.length);
  const currentRoundCardIds = shuffleMixedCards([...pendingForRound, ...newForRound], random);
  const currentRoundOrigins: Record<string, "pending" | "new"> = {};
  pendingForRound.forEach((cardId) => { currentRoundOrigins[cardId] = "pending"; });
  newForRound.forEach((cardId) => { currentRoundOrigins[cardId] = "new"; });
  const activities = assignActivities(currentRoundCardIds, state.lastActivityByCardId, random);

  return {
    ...state,
    unseenCardIds: nextUnseen,
    currentRoundCardIds,
    currentRoundOrigins,
    currentRoundErrors: [],
    currentRoundAnswered: [],
    activityByCardId: activities.activityByCardId,
    lastActivityByCardId: activities.lastActivityByCardId,
    currentIndex: 0,
    roundNumber: incrementRound ? state.roundNumber + 1 : state.roundNumber,
    attemptNumber: 1,
    hearts: state.maxHearts,
    status: currentRoundCardIds.length === 0 ? "journey-complete" : "active",
    updatedAt: Date.now(),
  };
}

export function createAdaptiveMixedSession(
  cardIds: readonly string[],
  options: CreateAdaptiveMixedSessionOptions = {},
): AdaptiveMixedSessionState {
  const random = options.random ?? Math.random;
  const allCardIds = unique(cardIds);
  const roundSize = getAdaptiveRoundSize(allCardIds.length);
  const unseenCardIds = weightedShuffleMixedCards(allCardIds, options.weightByCardId, random);
  const emptyState: AdaptiveMixedSessionState = {
    version: 1,
    deckSignature: signature(allCardIds),
    allCardIds,
    unseenCardIds,
    pendingCardIds: [],
    masteredCardIds: [],
    currentRoundCardIds: [],
    currentRoundOrigins: {},
    currentRoundErrors: [],
    currentRoundAnswered: [],
    activityByCardId: {},
    lastActivityByCardId: {},
    currentIndex: 0,
    roundNumber: allCardIds.length > 0 ? 1 : 0,
    roundSize,
    attemptNumber: 1,
    hearts: MAX_HEARTS,
    maxHearts: MAX_HEARTS,
    status: allCardIds.length > 0 ? "active" : "journey-complete",
    updatedAt: Date.now(),
  };

  return mountRound(emptyState, random, false);
}

export function answerAdaptiveMixedCard(
  state: AdaptiveMixedSessionState,
  correct: boolean,
  skipped = false,
): AdaptiveMixedSessionState {
  if (state.status !== "active") return state;
  const cardId = state.currentRoundCardIds[state.currentIndex];
  if (!cardId) return state;

  const failed = !correct || skipped;
  const currentRoundAnswered = unique([...state.currentRoundAnswered, cardId]);
  const currentRoundErrors = failed
    ? unique([...state.currentRoundErrors, cardId])
    : state.currentRoundErrors.filter((id) => id !== cardId);
  const hearts = failed ? Math.max(0, state.hearts - 1) : state.hearts;

  if (hearts === 0) {
    return {
      ...state,
      currentRoundAnswered,
      currentRoundErrors,
      hearts,
      status: "round-failed",
      updatedAt: Date.now(),
    };
  }

  if (state.currentIndex < state.currentRoundCardIds.length - 1) {
    return {
      ...state,
      currentRoundAnswered,
      currentRoundErrors,
      hearts,
      currentIndex: state.currentIndex + 1,
      updatedAt: Date.now(),
    };
  }

  const pending = new Set(state.pendingCardIds);
  const mastered = new Set(state.masteredCardIds);
  const errors = new Set(currentRoundErrors);

  state.currentRoundCardIds.forEach((roundCardId) => {
    if (errors.has(roundCardId)) {
      pending.add(roundCardId);
      mastered.delete(roundCardId);
    } else {
      pending.delete(roundCardId);
      mastered.add(roundCardId);
    }
  });

  const pendingCardIds = unique([...pending]);
  const masteredCardIds = unique([...mastered]);
  const journeyComplete = state.unseenCardIds.length === 0 && pendingCardIds.length === 0;

  return {
    ...state,
    pendingCardIds,
    masteredCardIds,
    currentRoundAnswered,
    currentRoundErrors,
    hearts,
    status: journeyComplete ? "journey-complete" : "round-complete",
    updatedAt: Date.now(),
  };
}

export function restartAdaptiveMixedRound(
  state: AdaptiveMixedSessionState,
  random: () => number = Math.random,
): AdaptiveMixedSessionState {
  if (state.status !== "round-failed" && state.status !== "round-complete" && state.status !== "active") return state;

  const pending = new Set(state.pendingCardIds);
  const mastered = new Set(state.masteredCardIds);
  if (state.status === "round-complete") {
    state.currentRoundCardIds.forEach((cardId) => {
      mastered.delete(cardId);
      if (state.currentRoundOrigins[cardId] === "pending") pending.add(cardId);
      else pending.delete(cardId);
    });
  }

  const currentRoundCardIds = shuffleMixedCards(state.currentRoundCardIds, random);
  const activities = assignActivities(currentRoundCardIds, state.lastActivityByCardId, random);
  return {
    ...state,
    pendingCardIds: unique([...pending]),
    masteredCardIds: unique([...mastered]),
    currentRoundCardIds,
    currentRoundErrors: [],
    currentRoundAnswered: [],
    activityByCardId: activities.activityByCardId,
    lastActivityByCardId: activities.lastActivityByCardId,
    currentIndex: 0,
    attemptNumber: state.attemptNumber + 1,
    hearts: state.maxHearts,
    status: "active",
    updatedAt: Date.now(),
  };
}

export function startNextAdaptiveMixedRound(
  state: AdaptiveMixedSessionState,
  random: () => number = Math.random,
): AdaptiveMixedSessionState {
  if (state.status !== "round-complete") return state;
  return mountRound(state, random, true);
}

export function restartAdaptiveMixedJourney(
  state: AdaptiveMixedSessionState,
  options: CreateAdaptiveMixedSessionOptions = {},
): AdaptiveMixedSessionState {
  return createAdaptiveMixedSession(state.allCardIds, options);
}

export function isAdaptiveMixedStateCompatible(
  value: unknown,
  cardIds: readonly string[],
): value is AdaptiveMixedSessionState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AdaptiveMixedSessionState>;
  return candidate.version === 1
    && candidate.deckSignature === signature(cardIds)
    && Array.isArray(candidate.allCardIds)
    && Array.isArray(candidate.currentRoundCardIds)
    && typeof candidate.currentIndex === "number"
    && typeof candidate.hearts === "number"
    && typeof candidate.status === "string";
}

export function getAdaptiveMixedProgress(state: AdaptiveMixedSessionState) {
  const totalCards = state.allCardIds.length;
  const masteredCards = state.masteredCardIds.length;
  return {
    totalCards,
    masteredCards,
    unseenCards: state.unseenCardIds.length,
    pendingCards: state.pendingCardIds.length,
    roundPosition: state.currentRoundCardIds.length === 0 ? 0 : state.currentIndex + 1,
    roundTotal: state.currentRoundCardIds.length,
    overallPercent: totalCards === 0 ? 100 : Math.round((masteredCards / totalCards) * 100),
  };
}
