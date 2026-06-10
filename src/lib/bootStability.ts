/**
 * Boot stability — centralized, idempotent, safe boot routines.
 *
 * Replaces the scattered cleanup in `main.tsx` and `versionManager.ts`.
 * Goals:
 *   - Run legacy service-worker / cache cleanup at most ONCE per build,
 *     gated by localStorage, so normal boots are cheap.
 *   - Never reload the page automatically. We may unregister a worker or
 *     clear caches, but the user (or next natural navigation) drives reload.
 *   - Skip everything inside iframes / Lovable preview contexts to avoid
 *     boot-blank reload loops.
 *   - Emit useful, low-noise logs so we can diagnose issues without spam.
 */

import { APP_BUILD_ID } from "./versionManager";

const CLEANUP_GUARD_KEY = "ape_boot_cleanup_build";

export function isPreviewContext(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.self !== window.top) return true;
  } catch {
    // Cross-origin iframe — also a preview-like context.
    return true;
  }
  const host = window.location.hostname;
  if (!host) return false;
  return (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  );
}

async function cleanupLegacyServiceWorkers(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length === 0) return;
    console.log("[BootStability] Unregistering", regs.length, "legacy service worker(s)");
    await Promise.allSettled(regs.map((r) => r.unregister()));
  } catch (err) {
    console.warn("[BootStability] SW cleanup failed:", err);
  }
}

async function cleanupLegacyCaches(): Promise<void> {
  try {
    if (!("caches" in window)) return;
    const names = await caches.keys();
    if (names.length === 0) return;
    console.log("[BootStability] Deleting", names.length, "stale cache(s)");
    await Promise.allSettled(names.map((n) => caches.delete(n)));
  } catch (err) {
    console.warn("[BootStability] Cache cleanup failed:", err);
  }
}

let bootRan = false;

/**
 * Run boot stability checks. Idempotent — calling more than once is a no-op.
 * Never throws. Never reloads.
 */
export function runBootStability(): void {
  if (bootRan) return;
  bootRan = true;

  // In preview/iframe contexts, do NOT touch service workers or caches —
  // it has caused boot loops in the Lovable editor preview.
  if (isPreviewContext()) {
    console.log("[BootStability] Preview/iframe context — skipping cleanup");
    return;
  }

  // Gate cleanup by build id so it runs at most once per deployed build.
  let alreadyCleaned = false;
  try {
    alreadyCleaned = localStorage.getItem(CLEANUP_GUARD_KEY) === APP_BUILD_ID;
  } catch {
    alreadyCleaned = false;
  }

  if (alreadyCleaned) {
    return;
  }

  // Mark as cleaned BEFORE the async work, so a concurrent reload during
  // cleanup cannot loop us back into another cleanup attempt.
  try {
    localStorage.setItem(CLEANUP_GUARD_KEY, APP_BUILD_ID);
  } catch { /* best-effort */ }

  // Fire-and-forget; we never await these in boot.
  void cleanupLegacyServiceWorkers();
  void cleanupLegacyCaches();
}