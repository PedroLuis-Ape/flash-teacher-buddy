// Build identity injected by Vite at build time
declare const __BUILD_TIMESTAMP__: string;

const BUILD_ID: string = typeof __BUILD_TIMESTAMP__ !== 'undefined'
  ? __BUILD_TIMESTAMP__
  : 'dev';

const VERSION_KEY = "app_build_id";

// Versão Semântica que vai para a Interface do Usuário (Rodapé, etc)
export const APP_VERSION = "v2.5.0";

export function checkAndClearCache(): boolean {
  try {
    const stored = localStorage.getItem(VERSION_KEY);

    if (stored && stored !== BUILD_ID) {
      console.log(`[VersionManager] Nova build detectada: ${BUILD_ID}. Atualizando...`);

      // Salva antes de recarregar para evitar loop
      localStorage.setItem(VERSION_KEY, BUILD_ID);

      // Desregistra o Service Worker velho (o VitePWA limpa o cache automaticamente)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          regs.forEach(r => r.unregister());
          window.location.reload();
        });
      } else {
        window.location.reload();
      }

      return true;
    } else if (!stored) {
      localStorage.setItem(VERSION_KEY, BUILD_ID);
    }

    return false;
  } catch (error) {
    console.error("[VersionManager] Error:", error);
    return false;
  }
}

// Run on import
checkAndClearCache();
