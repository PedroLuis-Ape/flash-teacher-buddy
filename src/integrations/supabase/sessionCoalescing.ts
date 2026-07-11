interface SessionClientLike {
  auth: {
    getSession: () => Promise<any>;
    onAuthStateChange?: (callback: (...args: any[]) => void) => { data?: { subscription?: { unsubscribe?: () => void } } };
  };
}

export function installSessionReadCoalescing<T extends SessionClientLike>(
  client: T,
  ttlMs = 1_000,
  now: () => number = Date.now,
): T {
  const original = client.auth.getSession.bind(client.auth);
  let cached: { expiresAt: number; value: any } | null = null;
  let inflight: Promise<any> | null = null;

  (client.auth as any).getSession = async () => {
    if (cached && cached.expiresAt > now()) return cached.value;
    if (inflight) return inflight;

    inflight = original()
      .then((value) => {
        cached = { expiresAt: now() + ttlMs, value };
        return value;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  };

  client.auth.onAuthStateChange?.(() => {
    cached = null;
    inflight = null;
  });

  return client;
}
