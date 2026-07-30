const DEFAULT_TTL_MS = 900;
const DEFAULT_EMPTY_FLASHCARD_RETRY_DELAYS_MS = [120, 360] as const;

interface CachedResponse {
  expiresAt: number;
  response: Response;
}

interface FetchResult {
  response: Response;
  emptyFlashcardResponse: boolean;
}

function headerEntries(headers: Headers): string {
  return Array.from(headers.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join("|");
}

function buildRequestKey(request: Request): string | null {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return null;
  if (request.cache === "no-store") return null;
  return `${method}|${request.url}|${headerEntries(request.headers)}`;
}

function isFlashcardReadRequest(request: Request): boolean {
  try {
    const pathname = new URL(request.url).pathname;
    return pathname.endsWith("/rest/v1/flashcards")
      || pathname.endsWith("/rest/v1/rpc/get_portal_flashcards");
  } catch {
    return false;
  }
}

async function isEmptyJsonArrayResponse(response: Response): Promise<boolean> {
  if (!response.ok) return false;
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("json")) return false;

  try {
    return (await response.clone().text()).trim() === "[]";
  } catch {
    return false;
  }
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(abortError());

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, Math.max(0, delayMs));

    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function fetchReadWithFlashcardRecovery(
  baseFetch: typeof fetch,
  request: Request,
  retryDelaysMs: readonly number[],
): Promise<FetchResult> {
  let response = await baseFetch(request.clone());
  if (!isFlashcardReadRequest(request)) {
    return { response, emptyFlashcardResponse: false };
  }

  let emptyFlashcardResponse = await isEmptyJsonArrayResponse(response);
  for (const delayMs of retryDelaysMs) {
    if (!emptyFlashcardResponse) break;
    await waitForRetry(delayMs, request.signal);
    response = await baseFetch(request.clone());
    emptyFlashcardResponse = await isEmptyJsonArrayResponse(response);
  }

  return { response, emptyFlashcardResponse };
}

export function createDedupingFetch(
  baseFetch: typeof fetch = fetch,
  ttlMs = DEFAULT_TTL_MS,
  now: () => number = Date.now,
  emptyFlashcardRetryDelaysMs: readonly number[] = DEFAULT_EMPTY_FLASHCARD_RETRY_DELAYS_MS,
): typeof fetch {
  const inflight = new Map<string, Promise<Response>>();
  const cache = new Map<string, CachedResponse>();
  let mutationGeneration = 0;

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const method = request.method.toUpperCase();

    if (method !== "GET" && method !== "HEAD") {
      mutationGeneration += 1;
      cache.clear();
      inflight.clear();
      return baseFetch(input, init);
    }

    const key = buildRequestKey(request);
    if (!key) return baseFetch(input, init);

    const cached = cache.get(key);
    if (cached && cached.expiresAt > now()) return cached.response.clone();
    if (cached) cache.delete(key);

    const pending = inflight.get(key);
    if (pending) return (await pending).clone();

    const requestGeneration = mutationGeneration;
    let requestPromise: Promise<Response>;
    requestPromise = fetchReadWithFlashcardRecovery(
      baseFetch,
      request,
      emptyFlashcardRetryDelaysMs,
    )
      .then(({ response, emptyFlashcardResponse }) => {
        if (
          response.ok
          && !emptyFlashcardResponse
          && ttlMs > 0
          && requestGeneration === mutationGeneration
        ) {
          cache.set(key, { expiresAt: now() + ttlMs, response: response.clone() });
        }
        return response;
      })
      .finally(() => {
        if (inflight.get(key) === requestPromise) inflight.delete(key);
      });

    inflight.set(key, requestPromise);
    return (await requestPromise).clone();
  }) as typeof fetch;
}
