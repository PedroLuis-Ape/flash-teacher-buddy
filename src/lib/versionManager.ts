// Sistema de versionamento para forçar recarregamento limpo
export const APP_VERSION = "1.0.1 (lucy)"; // Incrementar quando houver atualizações
const VERSION_KEY = "app_version";

export function checkAndClearCache(): boolean {
  try {
    const storedVersion = localStorage.getItem(VERSION_KEY);
    
    if (storedVersion !== APP_VERSION) {
      console.log(`[VersionManager] Nova versão detectada: ${APP_VERSION}. Limpando cache...`);
      
      // Limpar service workers
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(registration => registration.unregister());
        });
      }
      
      // Limpar caches do navegador
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name));
        });
      }
      
      // Atualizar versão
      localStorage.setItem(VERSION_KEY, APP_VERSION);
      
      return true; // Nova versão detectada
    }
    
    return false; // Mesma versão
  } catch (error) {
    console.error("[VersionManager] Erro ao verificar versão:", error);
    return false;
  }
}

// Executar ao iniciar o app
checkAndClearCache();
