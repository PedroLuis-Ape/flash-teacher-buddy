/**
 * Freeze Watchdog — detects main-thread stalls.
 *
 * A timer is scheduled every CHECK_MS. If the actual delay between
 * fires exceeds THRESHOLD_MS, we consider the main thread to have
 * been frozen for (delay - CHECK_MS) ms and record an event in
 * localStorage. Nothing is sent to the server in this version.
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

    if (import.meta.env.DEV) {
      console.warn("[FreezeWatchdog] Main-thread freeze detected", event);
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
    let lastTick = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const delay = now - lastTick;
      lastTick = now;
      if (delay > THRESHOLD_MS) {
        recordFreeze(delay);
      }
    }, CHECK_MS);
    return () => window.clearInterval(id);
  }, []);
}