import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/versionManager"; // Verificar versão e limpar cache

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('[PWA] Service Worker registrado com sucesso:', registration.scope);
      
      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available, could show a toast here
              console.log('[PWA] Nova versão disponível. Recarregue para atualizar.');
            }
          });
        }
      });

      // Check for waiting worker
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }).catch(error => {
      console.error('[PWA] Erro ao registrar Service Worker:', error);
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
