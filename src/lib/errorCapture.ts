/**
 * Global error capture — saves last unhandled error/rejection so SafeMode
 * can detect crashes on next load.
 */
const CRASH_KEY = "ape_last_crash";

function saveError(label: string, err: unknown) {
  try {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack?.slice(0, 800) : "";
    localStorage.setItem(CRASH_KEY, JSON.stringify({ label, message: msg, stack, time: Date.now() }));
  } catch { /* storage disabled */ }
}

window.addEventListener("error", (e) => {
  saveError("uncaught", e.error ?? e.message);
});

window.addEventListener("unhandledrejection", (e) => {
  saveError("unhandled_promise", e.reason);
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
