import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";
import { prepareLayeredStudyDeck, type RawLayeredCard } from "@/lib/studyDeck";
import {
  verifyStudyDeckAvailability,
  type StudyDeckAvailabilityProbe,
  type StudyDeckUnconfirmedReason,
} from "./studyDeckAvailability";

export type StudyDeckResourceKind = "list" | "collection";
export type StudyDeckSource =
  | "portal-list-rpc"
  | "portal-collection-rest"
  | "private-rest";

export interface StudyDeckPage<T> {
  data: T[] | null;
  error: unknown;
}

export interface StudyDeckLoaderOptions<T extends RawLayeredCard> {
  requestId: string;
  resourceKind: StudyDeckResourceKind;
  resourceId: string;
  source: StudyDeckSource;
  hasConfirmedSession: boolean;
  signal: AbortSignal;
  fetchPage: (from: number, to: number) => PromiseLike<StudyDeckPage<T>>;
  verifyAvailability?: () => Promise<StudyDeckAvailabilityProbe>;
  prepare?: (rawCards: T[]) => T[];
  /** Additional empty confirmations, not retries for non-empty or failed reads. */
  emptyRetryDelaysMs?: readonly number[];
}

export type StudyDeckLoadResult<T extends RawLayeredCard> =
  | {
      status: "ready";
      requestId: string;
      source: StudyDeckSource;
      rawCards: T[];
      playableCards: T[];
    }
  | {
      status: "confirmed-empty";
      requestId: string;
      source: StudyDeckSource;
      rawCards: [];
      playableCards: [];
    }
  | {
      status: "unconfirmed";
      requestId: string;
      source: StudyDeckSource;
      reason: StudyDeckUnconfirmedReason;
      rawCards: T[];
      playableCards: T[];
    };

export type StudyDeckLoadErrorCode = "auth-required" | "invalid-deck";

export class StudyDeckLoadError extends Error {
  constructor(
    readonly code: StudyDeckLoadErrorCode,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "StudyDeckLoadError";
  }
}

let requestSequence = 0;

export function createStudyDeckRequestId(): string {
  requestSequence += 1;
  return `study-${Date.now().toString(36)}-${requestSequence.toString(36)}`;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    const error = new Error("Study deck load was aborted");
    error.name = "AbortError";
    throw error;
  }
}

function waitBeforeEmptyRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const abort = () => {
      clearTimeout(timer);
      const error = new Error("Study deck load was aborted");
      error.name = "AbortError";
      reject(error);
    };
    timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, Math.max(0, delayMs));
    signal.addEventListener("abort", abort, { once: true });
  });
}

function logDeckLoad(stage: string, details: Record<string, string | number | boolean>): void {
  if (!import.meta.env.DEV) return;
  // Keep the correlation id useful without logging account or card content.
  console.debug("[StudyDeckLoader]", { stage, ...details });
}

/**
 * Shared, generation-friendly loader for every study entry point.
 *
 * A single empty response is not evidence that the user has no cards. Empty
 * reads receive bounded follow-ups and an independent authority probe. If the
 * probe is missing, inaccessible or inconsistent, the result remains
 * `unconfirmed` and the UI must offer recovery instead of claiming zero cards.
 * The caller owns request generation and ignores results after route/account
 * context changes.
 */
export async function loadStudyDeck<T extends RawLayeredCard>(
  options: StudyDeckLoaderOptions<T>,
): Promise<StudyDeckLoadResult<T>> {
  const {
    requestId,
    resourceKind,
    resourceId,
    source,
    hasConfirmedSession,
    signal,
    fetchPage,
    verifyAvailability,
    prepare = (rawCards) => prepareLayeredStudyDeck(rawCards),
  // dedupFetch already performs timed recovery for the actual HTTP request;
  // one immediate service-level confirmation covers clients/tests that bypass
  // that wrapper without multiplying the 10s study boot budget.
  emptyRetryDelaysMs = [0],
  } = options;

  if (!resourceId) {
    throw new StudyDeckLoadError("invalid-deck", "Study resource id is missing", requestId);
  }
  if (!hasConfirmedSession && source === "private-rest") {
    throw new StudyDeckLoadError(
      "auth-required",
      "A confirmed session is required for a private study resource",
      requestId,
    );
  }

  logDeckLoad("start", {
    requestId,
    resourceId,
    resourceKind,
    source,
    hasConfirmedSession,
  });

  const read = async (): Promise<T[]> => {
    throwIfAborted(signal);
    const result = await fetchAllSupabaseRows(fetchPage);
    throwIfAborted(signal);
    return result;
  };

  let rawCards = await read();
  let confirmations = 0;
  for (const delayMs of emptyRetryDelaysMs) {
    if (rawCards.length > 0) break;
    confirmations += 1;
    logDeckLoad("empty-response", { requestId, confirmation: confirmations });
    await waitBeforeEmptyRetry(delayMs, signal);
    rawCards = await read();
  }

  let playableCards = rawCards.length > 0 ? prepare(rawCards) : [];
  let availability = await verifyStudyDeckAvailability({
    source,
    rawCount: rawCards.length,
    playableCount: playableCards.length,
    probe: verifyAvailability,
  });

  // The authority can see cards while the paginated read still returned an
  // empty payload. Perform one final clean read; never loop indefinitely.
  if (rawCards.length === 0 && availability.status === "has-cards") {
    logDeckLoad("authority-found-cards", { requestId, rawCards: availability.rawCount });
    rawCards = await read();
    playableCards = rawCards.length > 0 ? prepare(rawCards) : [];
    availability = rawCards.length > 0
      ? await verifyStudyDeckAvailability({
          source,
          rawCount: rawCards.length,
          playableCount: playableCards.length,
        })
      : {
          status: "unconfirmed",
          reason: "cards-present-but-unavailable",
          source,
        };
  }

  if (availability.status === "confirmed-empty") {
    logDeckLoad("empty-confirmed", {
      requestId,
      confirmations,
      rawCards: 0,
      playableCards: 0,
    });
    return {
      status: "confirmed-empty",
      requestId,
      source,
      rawCards: [],
      playableCards: [],
    };
  }

  if (availability.status === "unconfirmed") {
    logDeckLoad("availability-unconfirmed", {
      requestId,
      rawCards: rawCards.length,
      playableCards: playableCards.length,
    });
    return {
      status: "unconfirmed",
      requestId,
      source,
      reason: availability.reason,
      rawCards,
      playableCards,
    };
  }

  logDeckLoad("ready", {
    requestId,
    rawCards: rawCards.length,
    playableCards: playableCards.length,
  });
  return {
    status: "ready",
    requestId,
    source,
    rawCards,
    playableCards,
  };
}
