/**
 * APE – Apprentice Practice & Enhancement
 * © 2025 Pedro Luis de Oliveira Silva. Todos os direitos reservados.
 * Este software é de uso exclusivo do autor e de seus alunos autorizados.
 * É proibida a cópia, redistribuição ou utilização comercial sem autorização por escrito.
 */

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/versionManager"; // Verificar versão e limpar cache
import "./lib/errorCapture"; // Global error/rejection capture (must be early)
import "./i18n/config"; // i18n initialization
import { SafeMode } from "./components/SafeMode";
import { registerSW } from "virtual:pwa-register";

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    try {
      const buildId =
        typeof __BUILD_TIMESTAMP__ !== "undefined"
          ? __BUILD_TIMESTAMP__
          : "dev";
      const RELOAD_KEY = `ape_pwa_update_reload_done_${buildId}`;
      const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY);

      if (!alreadyReloaded) {
        sessionStorage.setItem(RELOAD_KEY, "true");
        console.log("[PWA] Nova versão encontrada. Aplicando atualização...");
        updateSW(true);
      } else {
        console.warn("[PWA] Atualização já tentou reload para esta build. Evitando loop.");
      }
    } catch (error) {
      console.warn("[PWA] Falha ao aplicar atualização automática:", error);
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log("[PWA] App pronto para uso offline.");
  },
  onRegisteredSW(swUrl, registration) {
    console.log("[PWA] Service Worker registrado:", swUrl);

    if (registration) {
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
    }
  },
  onRegisterError(error) {
    console.error("[PWA] Erro ao registrar Service Worker:", error);
  },
});

// Clear boot timeout — app JS loaded successfully
if ((window as any).__apeBootTimer) {
  clearTimeout((window as any).__apeBootTimer);
}

// Unregister service workers inside iframes or preview hosts to prevent stale cache
try {
  const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
  const isPreviewHost = window.location.hostname.includes("id-preview--") || window.location.hostname.includes("lovableproject.com");
  if ((isInIframe || isPreviewHost) && "serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
  }
} catch { /* best-effort */ }

// Remove boot loader so it doesn't flash under React
const bootLoader = document.getElementById("boot-loader");
if (bootLoader) bootLoader.remove();

createRoot(document.getElementById("root")!).render(
  <SafeMode>
    <App />
  </SafeMode>
);
