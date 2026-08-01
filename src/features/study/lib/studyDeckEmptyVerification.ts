import type { RawLayeredCard } from "@/lib/studyDeck";
import type {
  StudyDeckLoadResult,
  StudyDeckResourceKind,
} from "./studyDeckLoader";

export type StudyDeckSource = "portal-rpc" | "private-rest";

export interface StudyDeckCountResponse {
  count: number | null;
  error: unknown;
}

export type StudyDeckEmptyReason =
  | "authoritative-zero"
  | "count-unavailable"
  | "count-failed"
  | "count-mismatch"
  | "reread-failed"
  | "session-missing";

export type StudyDeckEmptyResolution<T extends RawLayeredCard> =
  | { state: "cards-present"; deck: StudyDeckLoadResult<T> }
  | { state: "confirmed-empty"; count: number }
  | { state: "empty-unconfirmed"; reason: StudyDeckEmptyReason; technicalId: string }
  | { state: "cancelled" };

export interface ResolveStudyDeckEmptyStateOptions<T extends RawLayeredCard> {
  requestId: string;
  resourceKind: StudyDeckResourceKind;
  source: StudyDeckSource;
  hasConfirmedSession: boolean;
  signal: AbortSignal;
  /** Authoritative count in the exact current context (auth/route/RPC). */
  countCards: () => PromiseLike<StudyDeckCountResponse>;
  /** Fresh read with the current credential; must not reuse a cached body. */
  rereadDeck: () => Promise<StudyDeckLoadResult<T>>;
  /** Must exceed the client dedup/cache TTL so the reread is a real read. */
  rereadDelayMs?: number;
  isCurrentGeneration?: () => boolean;
}

/** Dedup cache TTL is 900ms; wait past it so the reread cannot be served stale. */
export const STUDY_DECK_REREAD_DELAY_MS = 1_100;

export function formatStudyDeckTechnicalId(input: {
  code: string;
  requestId: string;
  source: StudyDeckSource;
  resourceKind: StudyDeckResourceKind;
  reason: string;
}): string {
  // Deliberately non-sensitive: no token, no account, no card content.
  return [input.code, input.requestId, input.source, input.resourceKind, input.reason].join("/");
}

function isAbortLike(error: unknown): boolean {
  return Boolean(error) && (error as { name?: string }).name === "AbortError";
}

function wait(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, Math.max(0, delayMs));
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * A single empty deck read is never authoritative. Route/scope mistakes, auth
 * or RLS gaps, an expired token, the public RPC contract, a cancelled request
 * and transient responses all produce `[]`. Only an error-free authoritative
 * count in the current context may promote empty to "confirmed-empty";
 * everything else stays recoverable.
 */
export async function resolveStudyDeckEmptyState<T extends RawLayeredCard>(
  options: ResolveStudyDeckEmptyStateOptions<T>,
): Promise<StudyDeckEmptyResolution<T>> {
  const {
    requestId,
    resourceKind,
    source,
    hasConfirmedSession,
    signal,
    countCards,
    rereadDeck,
    rereadDelayMs = STUDY_DECK_REREAD_DELAY_MS,
    isCurrentGeneration = () => true,
  } = options;

  const unconfirmed = (reason: StudyDeckEmptyReason): StudyDeckEmptyResolution<T> => ({
    state: "empty-unconfirmed",
    reason,
    technicalId: formatStudyDeckTechnicalId({
      code: "ST-EMPTY",
      requestId,
      source,
      resourceKind,
      reason,
    }),
  });

  if (signal.aborted || !isCurrentGeneration()) return { state: "cancelled" };
  if (source === "private-rest" && !hasConfirmedSession) {
    return unconfirmed("session-missing");
  }

  let response: StudyDeckCountResponse;
  try {
    response = await countCards();
  } catch (error) {
    if (isAbortLike(error)) return { state: "cancelled" };
    return unconfirmed("count-failed");
  }

  if (signal.aborted || !isCurrentGeneration()) return { state: "cancelled" };
  if (response.error) return unconfirmed("count-failed");
  if (typeof response.count !== "number" || !Number.isFinite(response.count)) {
    return unconfirmed("count-unavailable");
  }
  if (response.count === 0) return { state: "confirmed-empty", count: 0 };

  try {
    await wait(rereadDelayMs, signal);
  } catch {
    return { state: "cancelled" };
  }
  if (!isCurrentGeneration()) return { state: "cancelled" };

  let deck: StudyDeckLoadResult<T>;
  try {
    deck = await rereadDeck();
  } catch (error) {
    if (isAbortLike(error)) return { state: "cancelled" };
    return unconfirmed("reread-failed");
  }

  if (signal.aborted || !isCurrentGeneration()) return { state: "cancelled" };
  if (deck.status === "ready" && deck.playableCards.length > 0) {
    return { state: "cards-present", deck };
  }
  return unconfirmed("count-mismatch");
}

export interface StudyDeckCountReaderOptions {
  client: {
    from: (table: string) => any;
    rpc: (name: string, args?: Record<string, unknown>, options?: Record<string, unknown>) => any;
  };
  isPublicList: boolean;
  resourceId: string;
  queryColumn: "list_id" | "collection_id";
  signal: AbortSignal;
}

/**
 * Context-preserving authoritative count: the private REST scope for private
 * lists/collections and the public Portal RPC for shared list routes.
 */
export function createStudyDeckCountReader(
  options: StudyDeckCountReaderOptions,
): () => Promise<StudyDeckCountResponse> {
  const { client, isPublicList, resourceId, queryColumn, signal } = options;

  return async () => {
    if (!isPublicList) {
      const result = await client
        .from("flashcards")
        .select("id", { count: "exact", head: true })
        .eq(queryColumn, resourceId)
        .is("deleted_at", null)
        .abortSignal(signal);
      return { count: result?.count ?? null, error: result?.error ?? null };
    }

    // The Portal RPC is a POST; `head`+`count` is not guaranteed for every
    // deployment, so fall back to counting the rows the RPC actually returns.
    const rows = await client
      .rpc("get_portal_flashcards", { _list_id: resourceId })
      .abortSignal(signal);
    if (rows?.error) return { count: null, error: rows.error };
    return {
      count: Array.isArray(rows?.data) ? rows.data.length : null,
      error: null,
    };
  };
}