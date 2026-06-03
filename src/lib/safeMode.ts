/**
 * Safe Mode — global stability toggle.
 * When enabled, the app skips secondary/optional work
 * (prefetch, heartbeat, swipe nav, secondary modals, heavy effects).
 */

const KEY = "ape_safe_mode";

export function isSafeModeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

export function enableSafeMode(): void {
  try { localStorage.setItem(KEY, "true"); } catch { /* noop */ }
}

export function disableSafeMode(): void {
  try { localStorage.setItem(KEY, "false"); } catch { /* noop */ }
}

export function toggleSafeMode(): boolean {
  const next = !isSafeModeEnabled();
  if (next) enableSafeMode(); else disableSafeMode();
  return next;
}