/**
 * Global error capture — saves last unhandled error/rejection so SafeMode
 * can detect crashes on next load.
 *
 * Also tracks repeated async failures to enable zombie-state detection.
 */
const CRASH_KEY = "ape_last_crash";
const ERROR_BURST_KEY = "ape_error_burst";
const BURST_WINDOW_MS = 10_000; // 10s window
const BURST_THRESHOLD = 5; // 5 errors in 10s = zombie state

interface ErrorBurst {
  count: number;
  firstAt: number;
}

function getErrorBurst(): ErrorBurst {
  try {
    const raw = sessionStorage.getItem(ERROR_BURST_KEY);
    if (!raw) return { count: 0, firstAt: 0 };
    return JSON.parse(raw);
  } catch {
    return { count: 0, firstAt: 0 };
  }
}

function trackErrorBurst() {
  try {
    const burst = getErrorBurst();
    const now = Date.now();

    if (now - burst.firstAt > BURST_WINDOW_MS) {
      // New window
      sessionStorage.setItem(ERROR_BURST_KEY, JSON.stringify({ count: 1, firstAt: now }));
      return false;
    }

    burst.count++;
    sessionStorage.setItem(ERROR_BURST_KEY, JSON.stringify(burst));

    if (burst.count >= BURST_THRESHOLD) {
      // Reset counter to avoid infinite triggers
      sessionStorage.removeItem(ERROR_BURST_KEY);
      return true; // zombie state detected
    }
    return false;
  } catch {
    return false;
  }
}

function saveError(label: string, err: unknown) {
  try {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack?.slice(0, 800) : "";
    localStorage.setItem(CRASH_KEY, JSON.stringify({ label, message: msg, stack, time: Date.now() }));
  } catch { /* storage disabled */ }
}

/**
 * Dispatch a custom event so SafeMode can listen and offer recovery
 * without requiring a full React crash.
 */
function notifyZombieState(reason: string) {
  console.error('[ErrorCapture] Zombie state detected:', reason);
  try {
    window.dispatchEvent(new CustomEvent('ape-zombie-state', { detail: { reason } }));
  } catch { /* best-effort */ }
}

window.addEventListener("error", (e) => {
  saveError("uncaught", e.error ?? e.message);
  const isZombie = trackErrorBurst();
  if (isZombie) notifyZombieState("Repeated uncaught errors");
});

window.addEventListener("unhandledrejection", (e) => {
  saveError("unhandled_promise", e.reason);
  const isZombie = trackErrorBurst();
  if (isZombie) notifyZombieState("Repeated unhandled promise rejections");
});

export function getLastCrash(): { label: string; message: string; time: number } | null {
  try {
    const raw = localStorage.getItem(CRASH_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Only return if crash was within last 60 seconds (recent)
    if (Date.now() - data.time > 60_000) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearCrash() {
  try { localStorage.removeItem(CRASH_KEY); } catch {}
}

export function clearErrorBurst() {
  try { sessionStorage.removeItem(ERROR_BURST_KEY); } catch {}
}
