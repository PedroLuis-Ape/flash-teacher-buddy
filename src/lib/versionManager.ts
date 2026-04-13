// Build identity injected by Vite at build time — unique per build
declare const __BUILD_TIMESTAMP__: string;

export const BUILD_ID: string =
  typeof __BUILD_TIMESTAMP__ !== "undefined"
    ? __BUILD_TIMESTAMP__
    : "dev";

// Versão humana exibida ao usuário
export const APP_VERSION = "2.5.0";

const VERSION_KEY = "app_build_id";

export function checkAndClearCache(): boolean {
  try {
    const stored = localStorage.getItem(VERSION_KEY);

    if (stored !== BUILD_ID) {
      console.log(`[VersionManager] New build detected: ${BUILD_ID}. Clearing caches…`);

      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) =>
          regs.forEach((r) => r.unregister())
        );
      }

      if ("caches" in window) {
        caches.keys().then((names) =>
          names.forEach((name) => caches.delete(name))
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
