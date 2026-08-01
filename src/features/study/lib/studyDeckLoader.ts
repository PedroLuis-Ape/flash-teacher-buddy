import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";
import { prepareLayeredStudyDeck, type RawLayeredCard } from "@/lib/studyDeck";

export type StudyDeckResourceKind = "list" | "collection";

export interface StudyDeckPage<T> {
  data: T[] | null;
  error: unknown;
}

export interface StudyDeckLoaderOptions<T extends RawLayeredCard> {
  requestId: string;
  resourceKind: StudyDeckResourceKind;
  resourceId: string;
  isPublicList: boolean;
  hasConfirmedSession: boolean;
  signal: AbortSignal;
  fetchPage: (from: number, to: number) => PromiseLike<StudyDeckPage<T>>;
  prepare?: (rawCards: T[]) => T[];
  /** Additional empty confirmations, not retries for non-empty or failed reads. */
  emptyRetryDelaysMs?: readonly number[];
}

export type StudyDeckLoadStatus = "ready" | "empty";

export interface StudyDeckLoadResult<T extends RawLayeredCard> {
  status: StudyDeckLoadStatus;
  requestId: string;
  source: "portal-rpc" | "private-rest";
  rawCards: T[];
  playableCards: T[];
}

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
 * A single empty response is not evidence that the user has no cards. The
 * first empty read is confirmed with bounded, abortable follow-up reads. The
 * caller still owns the request generation and must ignore a result after its
 * route/account context changes.
 */
export async function loadStudyDeck<T extends RawLayeredCard>(
  options: StudyDeckLoaderOptions<T>,
): Promise<StudyDeckLoadResult<T>> {
  const {
    requestId,
    resourceKind,
    resourceId,
    isPublicList,
    hasConfirmedSession,
    signal,
    fetchPage,
    prepare = (rawCards) => prepareLayeredStudyDeck(rawCards),
  // dedupFetch already performs timed recovery for the actual HTTP request;
  // one immediate service-level confirmation covers clients/tests that bypass
  // that wrapper without multiplying the 10s study boot budget.
  emptyRetryDelaysMs = [0],
  } = options;

  if (!resourceId) {
    throw new StudyDeckLoadError("invalid-deck", "Study resource id is missing", requestId);
  }
  if (!hasConfirmedSession && !isPublicList) {
    throw new StudyDeckLoadError(
      "auth-required",
      "A confirmed session is required for a private study resource",
      requestId,
    );
  }

  const source = isPublicList ? "portal-rpc" : "private-rest";
  logDeckLoad("start", { requestId, resourceKind, source });

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

  if (rawCards.length === 0) {
    logDeckLoad("empty-confirmed", { requestId, confirmations });
    return {
      status: "empty",
      requestId,
      source,
      rawCards,
      playableCards: [],
    };
  }

  const playableCards = prepare(rawCards);
  if (playableCards.length === 0) {
    throw new StudyDeckLoadError(
      "invalid-deck",
      "The study response contained rows but no playable cards",
      requestId,
    );
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
