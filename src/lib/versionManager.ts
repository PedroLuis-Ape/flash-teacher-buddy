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

export function checkAppBuildVersion(): boolean {
  try {
    const stored = localStorage.getItem(VERSION_KEY);

    if (!stored) {
      localStorage.setItem(VERSION_KEY, BUILD_ID);
      return false;
    }

    if (stored !== BUILD_ID) {
      console.log(`[VersionManager] Nova build detectada: ${BUILD_ID}`);
      localStorage.setItem(VERSION_KEY, BUILD_ID);
      // Guard against reload loops: only force one reload per new build.
      // Drop any leftover SW caches before reloading so mobile picks up
      // fresh hashed assets instead of the previous shell's chunks.
      try {
        const guard = sessionStorage.getItem(RELOAD_GUARD_KEY);
        if (guard !== BUILD_ID) {
          sessionStorage.setItem(RELOAD_GUARD_KEY, BUILD_ID);
          const reload = () => window.location.reload();
          if (typeof caches !== "undefined") {
            caches.keys()
              .then((names) => Promise.all(names.map((n) => caches.delete(n))))
              .finally(reload);
          } else {
            reload();
          }
        }
      } catch { /* best-effort */ }
      return true;
    }

    return false;
  } catch (error) {
    console.warn("[VersionManager] Falha ao verificar build:", error);
    return false;
  }
}

checkAppBuildVersion();
console.log("[APE BUILD]", formatVersionLabel());
