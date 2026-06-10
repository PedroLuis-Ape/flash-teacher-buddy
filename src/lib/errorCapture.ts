/**
 * Global error capture
 *
 * Regra:
 * - erros síncronos reais de runtime/renderização podem alimentar o burst fatal
 * - unhandled promise rejections NÃO derrubam a UI inteira
 * - promessas rejeitadas viram telemetria/log, não "autodestruição"
 */
const CRASH_KEY = "ape_last_crash";
const FATAL_BURST_KEY = "ape_fatal_error_burst";
const BURST_WINDOW_MS = 10_000; // 10s
const BURST_THRESHOLD = 5; // 5 erros síncronos reais em 10s

interface ErrorBurst {
  count: number;
  firstAt: number;
}

interface ZombieDetail {
  reason: string;
  severity: "fatal-sync";
  source: "window.error";
}

function getFatalBurst(): ErrorBurst {
  try {
    const raw = sessionStorage.getItem(FATAL_BURST_KEY);
    if (!raw) return { count: 0, firstAt: 0 };
    return JSON.parse(raw);
  } catch {
    return { count: 0, firstAt: 0 };
  }
}

function trackFatalBurst() {
  try {
    const burst = getFatalBurst();
    const now = Date.now();

    if (!burst.firstAt || now - burst.firstAt > BURST_WINDOW_MS) {
      sessionStorage.setItem(
        FATAL_BURST_KEY,
        JSON.stringify({ count: 1, firstAt: now })
      );
      return false;
    }

    const next = { ...burst, count: burst.count + 1 };
    sessionStorage.setItem(FATAL_BURST_KEY, JSON.stringify(next));

    if (next.count >= BURST_THRESHOLD) {
      sessionStorage.removeItem(FATAL_BURST_KEY);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

let lastSaveAt = 0;
const SAVE_THROTTLE_MS = 1000;

function saveError(label: string, err: unknown) {
  const now = Date.now();
  if (now - lastSaveAt < SAVE_THROTTLE_MS) return;
  lastSaveAt = now;
  try {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack?.slice(0, 800) : "";
    localStorage.setItem(
      CRASH_KEY,
      JSON.stringify({
        label,
        message: msg,
        stack,
        time: now,
      })
    );
  } catch {
    // ignore storage failures
  }
}

function classifyError(err: unknown): "chunk" | "network" | "render" {
  const msg = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();
  const name = err instanceof Error ? err.name : "";
  if (
    name === "ChunkLoadError" ||
    msg.includes("loading chunk") ||
    msg.includes("loading css chunk") ||
    msg.includes("dynamically imported module")
  ) return "chunk";
  if (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed")
  ) return "network";
  return "render";
}

function notifyZombieState(detail: ZombieDetail) {
  console.error("[ErrorCapture] Fatal zombie-state detected:", detail);
  try {
    window.dispatchEvent(
      new CustomEvent<ZombieDetail>("ape-zombie-state", { detail })
    );
  } catch {
    // best effort
  }
}

function isIgnorablePromiseRejection(reason: unknown): boolean {
  const msg =
    reason instanceof Error
      ? `${reason.name}: ${reason.message}`.toLowerCase()
      : String(reason).toLowerCase();

  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") ||
    msg.includes("timeout") ||
    msg.includes("aborterror") ||
    msg.includes("the user aborted a request") ||
    msg.includes("body stream already read")
  );
}

// Apenas erros síncronos reais alimentam o burst fatal
window.addEventListener("error", (e) => {
  const err = e.error ?? e.message;
  const kind = classifyError(err);

  // Chunk/network errors são tratados por boundaries específicos — não
  // contam para o burst fatal e não viram crash persistido como fatal.
  if (kind === "chunk" || kind === "network") {
    saveError(kind, err);
    console.warn(`[ErrorCapture] ${kind} error (não fatal):`, err);
    return;
  }

  saveError("render", err);

  const isZombie = trackFatalBurst();
  if (isZombie) {
    notifyZombieState({
      reason: "Repeated synchronous runtime/render errors",
      severity: "fatal-sync",
      source: "window.error",
    });
  }
});

// Promessas rejeitadas: NUNCA derrubam a UI. Filtramos ruído de rede.
window.addEventListener("unhandledrejection", (e) => {
  if (isIgnorablePromiseRejection(e.reason)) {
    console.warn("[ErrorCapture] Rejeição assíncrona ignorada (network/abort):", e.reason);
    return;
  }
  const kind = classifyError(e.reason);
  saveError(`unhandled_${kind}`, e.reason);
  console.warn(`[ErrorCapture] Unhandled promise (${kind}):`, e.reason);
});

export function getLastCrash(): { label: string; message: string; time: number } | null {
  try {
    const raw = localStorage.getItem(CRASH_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);
    if (Date.now() - data.time > 60_000) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearCrash() {
  try {
    localStorage.removeItem(CRASH_KEY);
  } catch {
    // ignore
  }
}

export function clearErrorBurst() {
  try {
    sessionStorage.removeItem(FATAL_BURST_KEY);
  } catch {
    // ignore
  }
}
