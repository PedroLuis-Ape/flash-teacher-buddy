/**
 * Boot stability — centralized, idempotent, safe boot routines.
 *
 * Replaces the scattered cleanup in `main.tsx` and `versionManager.ts`.
 * Goals:
 *   - Run legacy service-worker / cache cleanup at most ONCE per build,
 *     gated by localStorage, so normal boots are cheap.
 *   - Never reload the page automatically.
 *   - Skip everything inside iframes / Lovable preview contexts.
 *   - Remove only app-owned legacy caches and workers.
 */

import {
  cleanupAppOwnedCaches,
  unregisterLegacyAppServiceWorkers,
} from "./appCacheCleanup";
import { APP_BUILD_ID } from "./versionManager";

const CLEANUP_GUARD_KEY = "ape_boot_cleanup_build";

export function isPreviewContext(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.self !== window.top) return true;
  } catch {
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
    const removed = await unregisterLegacyAppServiceWorkers();
    if (removed.length > 0) {
      console.log("[BootStability] Unregistered", removed.length, "legacy app worker(s)");
    }
  } catch (err) {
    console.warn("[BootStability] SW cleanup failed:", err);
  }
}

async function cleanupLegacyCaches(): Promise<void> {
  try {
    const removed = await cleanupAppOwnedCaches();
    if (removed.length > 0) {
      console.log("[BootStability] Deleted", removed.length, "legacy app cache(s)");
    }
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

  if (isPreviewContext()) {
    console.log("[BootStability] Preview/iframe context — skipping cleanup");
    return;
  }

  let alreadyCleaned = false;
  try {
    alreadyCleaned = localStorage.getItem(CLEANUP_GUARD_KEY) === APP_BUILD_ID;
  } catch {
    alreadyCleaned = false;
  }

  if (alreadyCleaned) return;

  try {
    localStorage.setItem(CLEANUP_GUARD_KEY, APP_BUILD_ID);
  } catch {
    // best-effort
  }

  void cleanupLegacyServiceWorkers();
  void cleanupLegacyCaches();
}
