// Build identity injected by Vite at build time
declare const __BUILD_TIMESTAMP__: string;

const BUILD_ID: string =
  typeof __BUILD_TIMESTAMP__ !== "undefined"
    ? __BUILD_TIMESTAMP__
    : "dev";

const VERSION_KEY = "app_build_id";
const RELOAD_GUARD_KEY = "app_build_reload_guard";

/**
 * Single source of truth for the app's semantic version.
 * IMPORTANT: store WITHOUT the "v" prefix. The UI is responsible for adding it.
 */
export const APP_VERSION = "1.5";

/** Full build fingerprint (timestamp injected at build time, or "dev" locally). */
export const APP_BUILD_ID = BUILD_ID;

/** Short build fingerprint suitable for compact UI badges (last 6 chars). */
export const APP_BUILD_SHORT = String(BUILD_ID).slice(-6);

/**
 * Canonical label for the version badge.
 * Format: "v2.5.5 · 832129" (or "v2.5.5 · dev" in local dev).
 * Use this everywhere the badge/watermark is rendered.
 */
export function formatVersionLabel(): string {
  return `v${APP_VERSION}`;
}

/** Short label used on minimal surfaces (e.g. login screen). */
export function formatVersionShort(): string {
  return `v${APP_VERSION}`;
}

/**
 * Pure check: did the build id change since the last time we recorded it?
 * Side-effect free except for updating the stored build id. NEVER reloads.
 * Real cleanup is owned by `src/lib/bootStability.ts`.
 */
export function checkAppBuildVersion(): boolean {
  try {
    const stored = localStorage.getItem(VERSION_KEY);
    if (stored === BUILD_ID) return false;
    localStorage.setItem(VERSION_KEY, BUILD_ID);
    if (stored) {
      console.log(`[VersionManager] Nova build detectada: ${BUILD_ID} (era ${stored})`);
    }
    // Touch the reload guard key purely for diagnostics — no behavior here.
    try { sessionStorage.setItem(RELOAD_GUARD_KEY, BUILD_ID); } catch { /* noop */ }
    return true;
  } catch (error) {
    console.warn("[VersionManager] Falha ao verificar build:", error);
    return false;
  }
}

console.log("[APE BUILD]", formatVersionLabel());
