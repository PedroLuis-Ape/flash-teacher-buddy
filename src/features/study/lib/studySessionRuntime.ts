export const STUDY_REQUIRED_LOAD_TIMEOUT_MS = 10_000;
export const STUDY_REMOTE_RESTORE_TIMEOUT_MS = 2_500;
export const STUDY_RECOVERY_WATCHDOG_MS = 6_000;

export class StudyRuntimeTimeoutError extends Error {
  readonly code = "study-runtime-timeout";

  constructor(readonly stage: string, readonly timeoutMs: number) {
    super(`Study runtime stage timed out: ${stage}`);
    this.name = "StudyRuntimeTimeoutError";
  }
}

export async function withStudyRuntimeTimeout<T>(
  task: PromiseLike<T>,
  timeoutMs: number,
  stage: string,
  onTimeout?: () => void,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(task),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => {
            onTimeout?.();
            reject(new StudyRuntimeTimeoutError(stage, timeoutMs));
          },
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export type StudySessionReadinessPhase =
  | "loading"
  | "retrying"
  | "ready"
  | "completed"
  | "empty"
  | "recovering"
  | "cancelled"
  | "failed";

export interface StudySessionReadinessInput {
  pageLoading: boolean;
  engineLoading: boolean;
  /** A user- or watchdog-triggered recovery request is in flight. */
  retrying?: boolean;
  auxiliaryLoading?: boolean;
  eligibleCardIds: readonly string[];
  cardsOrder: readonly string[];
  currentIndex: number;
  isFinished: boolean;
  masteryStatus?: "active" | "round-complete" | "journey-complete" | null;
  recoveryFailed?: boolean;
  cancelled?: boolean;
}

export interface StudySessionReadiness {
  phase: StudySessionReadinessPhase;
  reason:
    | "required-data-loading"
    | "legitimately-completed"
    | "no-eligible-cards"
    | "playable-card-ready"
    | "empty-order"
    | "index-out-of-range"
    | "current-card-missing"
    | "request-cancelled";
  currentCardId: string | null;
}

/**
 * Single readiness contract shared by study screens.
 *
 * Completion intentionally wins over the absence of a current card: a finished
 * queue points one position past its final card and must render its summary,
 * never fall back to "Preparing your session".
 */
export function resolveStudySessionReadiness(
  input: StudySessionReadinessInput,
): StudySessionReadiness {
  const completed =
    input.isFinished ||
    input.masteryStatus === "round-complete" ||
    input.masteryStatus === "journey-complete";
  if (completed) {
    return {
      phase: "completed",
      reason: "legitimately-completed",
      currentCardId: null,
    };
  }

  if (input.cancelled) {
    return {
      phase: "cancelled",
      reason: "request-cancelled",
      currentCardId: null,
    };
  }

  if (
    input.retrying
    && (input.pageLoading || input.engineLoading || input.auxiliaryLoading)
  ) {
    return {
      phase: "retrying",
      reason: "required-data-loading",
      currentCardId: null,
    };
  }

  if (input.pageLoading || input.engineLoading || input.auxiliaryLoading) {
    return {
      phase: "loading",
      reason: "required-data-loading",
      currentCardId: null,
    };
  }

  if (input.eligibleCardIds.length === 0) {
    return {
      phase: "empty",
      reason: "no-eligible-cards",
      currentCardId: null,
    };
  }

  if (input.cardsOrder.length === 0) {
    return {
      phase: input.recoveryFailed ? "failed" : "recovering",
      reason: "empty-order",
      currentCardId: null,
    };
  }

  if (
    !Number.isInteger(input.currentIndex) ||
    input.currentIndex < 0 ||
    input.currentIndex >= input.cardsOrder.length
  ) {
    return {
      phase: input.recoveryFailed ? "failed" : "recovering",
      reason: "index-out-of-range",
      currentCardId: null,
    };
  }

  const currentCardId = input.cardsOrder[input.currentIndex] ?? null;
  if (!currentCardId || !new Set(input.eligibleCardIds).has(currentCardId)) {
    return {
      phase: input.recoveryFailed ? "failed" : "recovering",
      reason: "current-card-missing",
      currentCardId,
    };
  }

  return {
    phase: "ready",
    reason: "playable-card-ready",
    currentCardId,
  };
}

export interface StudyAnswerIdentity {
  progressCardId: string;
  engineCardId: string;
}

/**
 * Layered cards persist progress against the visible layer while the queue and
 * mastery advance gate must keep using the deck entry identity.
 */
export function resolveStudyAnswerIdentity(
  displayedCardId: string | null | undefined,
  engineCardId: string | null | undefined,
): StudyAnswerIdentity | null {
  const resolvedEngineId = engineCardId ?? displayedCardId;
  const resolvedProgressId = displayedCardId ?? engineCardId;
  if (!resolvedEngineId || !resolvedProgressId) return null;
  return {
    progressCardId: resolvedProgressId,
    engineCardId: resolvedEngineId,
  };
}

export function logStudyRuntime(
  stage: string,
  details: Record<string, string | number | boolean | null | undefined>,
): void {
  if (!import.meta.env.DEV) return;
  console.debug("[StudyRuntime]", { stage, ...details });
}
