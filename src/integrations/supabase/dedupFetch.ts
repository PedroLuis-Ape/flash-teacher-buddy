const DEFAULT_TTL_MS = 900;
const DEFAULT_EMPTY_FLASHCARD_RETRY_DELAYS_MS = [150, 450, 1_000, 2_000] as const;

interface CachedResponse {
  expiresAt: number;
  response: Response;
}

interface FetchResult {
  response: Response;
  emptyFlashcardResponse: boolean;
}

interface PersistedSessionShape {
  access_token?: unknown;
  expires_at?: unknown;
}

interface DedupingFetchOptions {
  useLatestPersistedAuth?: boolean;
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

function flashcardRequestKind(request: Request): "table" | "portal-rpc" | null {
  try {
    const pathname = new URL(request.url).pathname;
    const method = request.method.toUpperCase();

    if (
      pathname.endsWith("/rest/v1/flashcards")
      && (method === "GET" || method === "HEAD")
    ) {
      return "table";
    }

    // Supabase RPC calls with arguments are POST requests. The previous
    // recovery only exercised a synthetic GET in tests, so the real public
    // study request bypassed the retry path entirely.
    if (
      pathname.endsWith("/rest/v1/rpc/get_portal_flashcards")
      && (method === "GET" || method === "POST")
    ) {
      return "portal-rpc";
    }

    return null;
  } catch {
    return null;
  }
}

function isFlashcardReadRequest(request: Request): boolean {
  return flashcardRequestKind(request) !== null;
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

function readPersistedSessionForRequest(request: Request): PersistedSessionShape | null {
  if (typeof localStorage === "undefined") return null;

  try {
    const projectRef = new URL(request.url).hostname.split(".")[0];
    if (!projectRef) return null;

    const raw = localStorage.getItem(`sb-${projectRef}-auth-token`);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const candidate = parsed?.currentSession ?? parsed?.session ?? parsed;
    if (!candidate || typeof candidate !== "object") return null;
    return candidate as PersistedSessionShape;
  } catch {
    return null;
  }
}

function withLatestPersistedAuth(request: Request): Request {
  const session = readPersistedSessionForRequest(request);
  const accessToken = typeof session?.access_token === "string"
    ? session.access_token.trim()
    : "";
  const expiresAt = typeof session?.expires_at === "number"
    ? session.expires_at * 1_000
    : null;

  // Never replace a request with a token that is already known to be expired.
  // Supabase may refresh it during the backoff; every attempt re-reads storage.
  if (!accessToken || (expiresAt !== null && expiresAt <= Date.now())) {
    return request.clone();
  }

  const headers = new Headers(request.headers);
  const nextAuthorization = `Bearer ${accessToken}`;
  if (headers.get("authorization") === nextAuthorization) {
    return request.clone();
  }

  headers.set("authorization", nextAuthorization);
  return new Request(request.clone(), {
    headers,
    cache: "no-store",
  });
}

async function performFlashcardAttempt(
  baseFetch: typeof fetch,
  request: Request,
  useLatestPersistedAuth: boolean,
): Promise<Response> {
  if (request.signal.aborted) throw abortError();

  // The first request can be created while auth is still attaching/refeshing.
  // Rebuild every attempt from the immutable original request and inject the
  // newest persisted access token instead of cloning stale headers forever.
  const attempt = useLatestPersistedAuth
    ? withLatestPersistedAuth(request)
    : request.clone();
  return baseFetch(attempt);
}

async function fetchReadWithFlashcardRecovery(
  baseFetch: typeof fetch,
  request: Request,
  retryDelaysMs: readonly number[],
  useLatestPersistedAuth: boolean,
): Promise<FetchResult> {
  let response = await performFlashcardAttempt(baseFetch, request, useLatestPersistedAuth);
  let emptyFlashcardResponse = await isEmptyJsonArrayResponse(response);

  for (const delayMs of retryDelaysMs) {
    if (!emptyFlashcardResponse) break;
    await waitForRetry(delayMs, request.signal);
    response = await performFlashcardAttempt(baseFetch, request, useLatestPersistedAuth);
    emptyFlashcardResponse = await isEmptyJsonArrayResponse(response);
  }

  return { response, emptyFlashcardResponse };
}

export function createDedupingFetch(
  baseFetch: typeof fetch = fetch,
  ttlMs = DEFAULT_TTL_MS,
  now: () => number = Date.now,
  emptyFlashcardRetryDelaysMs: readonly number[] = DEFAULT_EMPTY_FLASHCARD_RETRY_DELAYS_MS,
  options: DedupingFetchOptions = {},
): typeof fetch {
  const inflight = new Map<string, Promise<Response>>();
  const cache = new Map<string, CachedResponse>();
  let mutationGeneration = 0;

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const method = request.method.toUpperCase();

    // Flashcard reads are intentionally isolated from the generic short cache
    // and in-flight sharing. A study launch must perform its own current read;
    // it must never inherit an empty/stale response started by another screen.
    // This branch also covers the real POST-based public RPC.
    if (isFlashcardReadRequest(request)) {
      const { response } = await fetchReadWithFlashcardRecovery(
        baseFetch,
        request,
        emptyFlashcardRetryDelaysMs,
        options.useLatestPersistedAuth !== false,
      );
      return response;
    }

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
    requestPromise = baseFetch(request.clone())
      .then((response) => {
        if (
          response.ok
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

/** Public routes retain bounded empty-read recovery without attaching a private session. */
export function createSessionFreeDedupingFetch(
  baseFetch: typeof fetch = fetch,
): typeof fetch {
  return createDedupingFetch(
    baseFetch,
    DEFAULT_TTL_MS,
    Date.now,
    DEFAULT_EMPTY_FLASHCARD_RETRY_DELAYS_MS,
    { useLatestPersistedAuth: false },
  );
}
