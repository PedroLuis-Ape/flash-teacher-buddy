/**
 * Freeze Watchdog — detects *real* main-thread stalls (conservative).
 *
 * Conservative rules:
 *  - Uses `performance.now()` (monotonic) instead of `Date.now()`,
 *    so system clock changes / sleep don't masquerade as freezes.
 *  - Completely ignores ticks while the tab is hidden — background
 *    timer throttling is normal browser behavior, not a freeze.
 *  - Resets the baseline on `visibilitychange→visible` and `pageshow`,
 *    so returning from another tab or bfcache never triggers a false
 *    positive.
 *  - Records `suspected_stall` only as telemetry. Auto Safe Mode is
 *    disabled in this delivery; the recovery banner only *suggests*
 *    enabling it.
 */

import { useEffect } from "react";
import { isSafeModeEnabled } from "@/lib/safeMode";

const STORAGE_KEY = "ape_freeze_events";
const CHECK_MS = 2000;
const THRESHOLD_MS = 8000;
const MAX_EVENTS = 20;

export interface FreezeEvent {
  timestamp: number;
  route: string;
  delayMs: number;
  userAgent: string;
  visibilityState: string;
  online: boolean;
  memory?: {
    usedJSHeapSize?: number;
    totalJSHeapSize?: number;
    jsHeapSizeLimit?: number;
  };
  version?: string;
  safeMode: boolean;
}

function readEvents(): FreezeEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEvents(events: FreezeEvent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    /* quota */
  }
}

export function getFreezeEvents(): FreezeEvent[] {
  return readEvents();
}

export function clearFreezeEvents(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

export function hasRecentFreeze(windowMs = 5 * 60 * 1000): boolean {
  const events = readEvents();
  if (events.length === 0) return false;
  const last = events[events.length - 1];
  return Date.now() - last.timestamp < windowMs;
}

function recordFreeze(delayMs: number): void {
  try {
    const perfMem = (performance as any).memory;
    let version: string | undefined;
    try {
      // Read lazily to avoid hard dependency / circular imports.
      version =
        (window as any).__APE_VERSION__ ||
        localStorage.getItem("ape_build_version") ||
        undefined;
    } catch { /* noop */ }

    const event: FreezeEvent = {
      timestamp: Date.now(),
      route: typeof location !== "undefined" ? location.pathname : "",
      delayMs: Math.round(delayMs),
      userAgent: navigator.userAgent,
      visibilityState: document.visibilityState,
      online: navigator.onLine,
      memory: perfMem
        ? {
            usedJSHeapSize: perfMem.usedJSHeapSize,
            totalJSHeapSize: perfMem.totalJSHeapSize,
            jsHeapSizeLimit: perfMem.jsHeapSizeLimit,
          }
        : undefined,
      version,
      safeMode: isSafeModeEnabled(),
    };

    const events = readEvents();
    events.push(event);
    writeEvents(events);

    // Auto Safe Mode is disabled in this delivery — the banner only suggests it.
    if (import.meta.env.DEV) {
      console.warn("[FreezeWatchdog] Suspected main-thread stall", event);
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[FreezeWatchdog] record failed", err);
  }
}

/**
 * Mount once at the global layout level. Safe to call multiple times,
 * but unnecessary — one watchdog is enough.
 */
export function useFreezeWatchdog(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let lastTick = performance.now();

    const id = window.setInterval(() => {
      // Ignore background ticks entirely — throttled timers are not freezes.
      if (document.visibilityState !== "visible") {
        lastTick = performance.now();
        return;
      }
      const now = performance.now();
      const delay = now - lastTick;
      lastTick = now;
      if (delay > THRESHOLD_MS) {
        recordFreeze(delay);
      }
    }, CHECK_MS);

    const reset = () => { lastTick = performance.now(); };
    const onVisibility = () => {
      if (document.visibilityState === "visible") reset();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", reset);
    window.addEventListener("focus", reset);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", reset);
      window.removeEventListener("focus", reset);
    };
  }, []);
}