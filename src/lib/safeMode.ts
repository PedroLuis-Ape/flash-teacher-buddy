/**
 * Safe Mode — global stability toggle.
 * When enabled, the app skips secondary/optional work
 * (prefetch, heartbeat, swipe nav, secondary modals, heavy effects).
 *
 * Reactive store backed by localStorage. Consumers subscribe via
 * `useSafeMode()` (uses `useSyncExternalStore`) and update synchronously
 * — no polling, no F5 needed.
 */

import { useSyncExternalStore } from "react";

const KEY = "ape_safe_mode";

type Listener = () => void;
const listeners = new Set<Listener>();

function readSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

function emit(): void {
  listeners.forEach((l) => {
    try { l(); } catch { /* noop */ }
  });
}

// Cross-tab sync: when another tab toggles the flag, notify subscribers.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) emit();
  });
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function isSafeModeEnabled(): boolean {
  return readSnapshot();
}

export function enableSafeMode(): void {
  try { localStorage.setItem(KEY, "true"); } catch { /* noop */ }
  emit();
}

export function disableSafeMode(): void {
  try { localStorage.setItem(KEY, "false"); } catch { /* noop */ }
  emit();
}

export function toggleSafeMode(): boolean {
  const next = !readSnapshot();
  if (next) enableSafeMode(); else disableSafeMode();
  return next;
}

/**
 * React hook: reactive subscription to Safe Mode without polling.
 * Re-renders the consumer whenever enable/disable/toggle is called
 * (in this tab or any other).
 */
export function useSafeMode(): boolean {
  return useSyncExternalStore(
    subscribe,
    readSnapshot,
    () => false, // SSR fallback
  );
}