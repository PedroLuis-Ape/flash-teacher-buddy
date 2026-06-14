/**
 * Runtime Performance Instrumentation (passive, read-only)
 *
 * Part of Fase 0 — CLARA MASTER stability delivery.
 *
 * Captures runtime signals to a small in-memory ring buffer:
 *   - long tasks (PerformanceObserver type "longtask")
 *   - navigation timing
 *   - resource timing for JS chunks (.js / .mjs entries)
 *   - custom marks / measures
 *   - visibility / pageshow / pagehide lifecycle
 *
 * Privacy:
 *   Never records tokens, e-mails, user names, card contents, or URLs
 *   containing query strings beyond hostname + pathname.
 *
 * Performance:
 *   - Ring buffer of 50 entries max.
 *   - No synchronous localStorage writes.
 *   - Persist flush is deferred to requestIdleCallback (best-effort).
 *
 * This module is intentionally side-effect-free until `installRuntimePerformance()`
 * is called explicitly. Callers should invoke it once from the app bootstrap.
 */

export type RuntimePerfKind =
  | "longtask"
  | "navigation"
  | "chunk"
  | "mark"
  | "measure"
  | "visibility"
  | "pageshow"
  | "pagehide"
  | "stall_suspected";

export interface RuntimePerfEntry {
  kind: RuntimePerfKind;
  ts: number; // performance.now()
  /** Optional duration in ms */
  duration?: number;
  /** Optional short label (no PII). */
  label?: string;
  /** Optional pathname (NO query string, NO hash). */
  path?: string;
  /** Optional visibility state at capture time. */
  visibility?: DocumentVisibilityState;
  /** Optional build id, when available. */
  buildId?: string;
}

const MAX_ENTRIES = 50;
const buffer: RuntimePerfEntry[] = [];
let installed = false;
let buildId: string | undefined;

function safeNow(): number {
  try {
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  } catch {
    return Date.now();
  }
}

function safePath(): string | undefined {
  try {
    if (typeof window === "undefined" || !window.location) return undefined;
    // pathname only — never query/hash
    return window.location.pathname;
  } catch {
    return undefined;
  }
}

function safeVisibility(): DocumentVisibilityState | undefined {
  try {
    if (typeof document === "undefined") return undefined;
    return document.visibilityState;
  } catch {
    return undefined;
  }
}

function push(entry: RuntimePerfEntry): void {
  const enriched: RuntimePerfEntry = {
    ...entry,
    ts: entry.ts ?? safeNow(),
    visibility: entry.visibility ?? safeVisibility(),
    path: entry.path ?? safePath(),
    buildId: entry.buildId ?? buildId,
  };
  buffer.push(enriched);
  if (buffer.length > MAX_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_ENTRIES);
  }
}

/** Read a snapshot of the buffer. The internal buffer is not exposed. */
export function getRuntimePerfSnapshot(): RuntimePerfEntry[] {
  return buffer.slice();
}

/** Clear the in-memory buffer. Does NOT touch storage. */
export function clearRuntimePerf(): void {
  buffer.length = 0;
}

/** Record a custom event (e.g. suspected stall). Safe to call anywhere. */
export function recordRuntimePerf(entry: Omit<RuntimePerfEntry, "ts">): void {
  push({ ...entry, ts: safeNow() });
}

/** Mark a custom timing point. */
export function markRuntime(label: string): void {
  try {
    if (typeof performance !== "undefined" && typeof performance.mark === "function") {
      performance.mark(label);
    }
  } catch {
    /* noop */
  }
  push({ kind: "mark", ts: safeNow(), label });
}

/** Measure between two marks; pushes a "measure" entry. */
export function measureRuntime(label: string, startMark: string, endMark: string): void {
  try {
    if (typeof performance !== "undefined" && typeof performance.measure === "function") {
      performance.measure(label, startMark, endMark);
      const entries = performance.getEntriesByName(label, "measure");
      const last = entries[entries.length - 1];
      if (last) {
        push({ kind: "measure", ts: safeNow(), duration: last.duration, label });
        return;
      }
    }
  } catch {
    /* noop */
  }
  push({ kind: "measure", ts: safeNow(), label });
}

function safeRequestIdle(cb: () => void): void {
  try {
    const w = window as unknown as {
      requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number;
    };
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(() => cb(), { timeout: 2000 });
      return;
    }
  } catch {
    /* noop */
  }
  setTimeout(cb, 0);
}

/**
 * One-time installer. Idempotent — calling it again is a no-op.
 *
 * Returns a teardown function. In normal app usage we do not call it,
 * but tests can use it to fully reset state.
 */
export function installRuntimePerformance(opts: { buildId?: string } = {}): () => void {
  if (installed || typeof window === "undefined") return () => {};
  installed = true;
  buildId = opts.buildId;

  const cleanups: Array<() => void> = [];

  // 1. Long tasks
  try {
    if (typeof PerformanceObserver !== "undefined") {
      const obs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          push({
            kind: "longtask",
            ts: safeNow(),
            duration: e.duration,
            label: e.name || "longtask",
          });
        }
      });
      // "longtask" is not in all TS lib targets; cast is safe.
      obs.observe({ entryTypes: ["longtask"] as unknown as string[] });
      cleanups.push(() => obs.disconnect());
    }
  } catch {
    /* longtask not supported */
  }

  // 2. Navigation timing (one-shot, after load)
  safeRequestIdle(() => {
    try {
      if (typeof performance === "undefined") return;
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (nav) {
        push({
          kind: "navigation",
          ts: safeNow(),
          duration: nav.duration,
          label: nav.type,
        });
      }
    } catch {
      /* noop */
    }
  });

  // 3. Resource timing for JS chunks (script entries only)
  try {
    if (typeof PerformanceObserver !== "undefined") {
      const obs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          const r = e as PerformanceResourceTiming;
          if (r.initiatorType !== "script") continue;
          let host = "";
          let path = "";
          try {
            const u = new URL(r.name);
            host = u.host;
            path = u.pathname;
          } catch {
            path = String(r.name);
          }
          // chunk-ish only — keep buffer small
          if (!/\.(m?js)(\?|$)/.test(path)) continue;
          push({
            kind: "chunk",
            ts: safeNow(),
            duration: r.duration,
            // host + path only; never query string
            label: host ? `${host}${path}` : path,
          });
        }
      });
      obs.observe({ entryTypes: ["resource"] });
      cleanups.push(() => obs.disconnect());
    }
  } catch {
    /* noop */
  }

  // 4. Lifecycle
  const onVisibility = () => {
    push({
      kind: "visibility",
      ts: safeNow(),
      label: document.visibilityState,
    });
  };
  const onPageShow = (ev: PageTransitionEvent) => {
    push({
      kind: "pageshow",
      ts: safeNow(),
      label: ev.persisted ? "bfcache" : "load",
    });
  };
  const onPageHide = (ev: PageTransitionEvent) => {
    push({
      kind: "pagehide",
      ts: safeNow(),
      label: ev.persisted ? "bfcache" : "unload",
    });
  };

  try {
    document.addEventListener("visibilitychange", onVisibility, { passive: true });
    window.addEventListener("pageshow", onPageShow as EventListener, { passive: true });
    window.addEventListener("pagehide", onPageHide as EventListener, { passive: true });
    cleanups.push(() => document.removeEventListener("visibilitychange", onVisibility));
    cleanups.push(() => window.removeEventListener("pageshow", onPageShow as EventListener));
    cleanups.push(() => window.removeEventListener("pagehide", onPageHide as EventListener));
  } catch {
    /* noop */
  }

  return () => {
    for (const fn of cleanups) {
      try {
        fn();
      } catch {
        /* noop */
      }
    }
    cleanups.length = 0;
    installed = false;
    buildId = undefined;
  };
}

/** Test-only helper. Not part of the public runtime contract. */
export const __testing__ = {
  reset(): void {
    buffer.length = 0;
    installed = false;
    buildId = undefined;
  },
  isInstalled(): boolean {
    return installed;
  },
};
