const DEFAULT_TTL_MS = 900;

interface CachedResponse {
  expiresAt: number;
  response: Response;
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

export function createDedupingFetch(
  baseFetch: typeof fetch = fetch,
  ttlMs = DEFAULT_TTL_MS,
  now: () => number = Date.now,
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
    requestPromise = baseFetch(input, init)
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
