// Build identity injected by Vite at build time
declare const __BUILD_TIMESTAMP__: string;

const BUILD_ID: string =
  typeof __BUILD_TIMESTAMP__ !== "undefined"
    ? __BUILD_TIMESTAMP__
    : "dev";

const VERSION_KEY = "app_build_id";

// Versão Semântica que vai para a Interface do Usuário (Rodapé, etc)
export const APP_VERSION = "v2.5.0";

// Exported so other modules can read the current build fingerprint
export const APP_BUILD_ID = BUILD_ID;

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
      return true;
    }

    return false;
  } catch (error) {
    console.warn("[VersionManager] Falha ao verificar build:", error);
    return false;
  }
}

checkAppBuildVersion();
console.log("[APE BUILD]", APP_VERSION, APP_BUILD_ID);
