// Build identity injected by Vite at build time — unique per build
declare const __BUILD_TIMESTAMP__: string;

const BUILD_ID: string = typeof __BUILD_TIMESTAMP__ !== 'undefined'
  ? __BUILD_TIMESTAMP__
  : 'dev';

const VERSION_KEY = "app_build_id";

export const APP_VERSION = BUILD_ID; // kept for backward compat

export function checkAndClearCache(): boolean {
  try {
    const stored = localStorage.getItem(VERSION_KEY);

    if (stored !== BUILD_ID) {
      console.log(`[VersionManager] New build detected: ${BUILD_ID}. Clearing caches…`);

      // Unregister service workers so new SW takes over
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs =>
          regs.forEach(r => r.unregister())
        );
      }

      // Purge browser Cache Storage
      if ('caches' in window) {
        caches.keys().then(names =>
          names.forEach(name => caches.delete(name))
        );
      }

      localStorage.setItem(VERSION_KEY, BUILD_ID);
      return true;
    }

    return false;
  } catch (error) {
    console.error("[VersionManager] Error:", error);
    return false;
  }
}

// Run on import
checkAndClearCache();
