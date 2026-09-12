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
// Incrementa a cada mudanca de autenticacao para que respostas antigas em voo
// nao repovoem o cache com a sessao anterior (troca de conta / logout).
let generation = 0;

(client.auth as any).getSession = async () => {
  if (cached && cached.expiresAt > now()) return cached.value;
  if (inflight) return inflight;

  const startedAt = generation;
  inflight = original()
    .then((value) => {
      if (startedAt === generation) cached = { expiresAt: now() + ttlMs, value };
      return value;
    })
    .finally(() => {
      if (startedAt === generation) inflight = null;
    });
  return inflight;
};

client.auth.onAuthStateChange?.(() => {
  generation += 1;
  cached = null;
  inflight = null;
});

  return client;
}
