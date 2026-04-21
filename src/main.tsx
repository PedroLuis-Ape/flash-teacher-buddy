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

// ── Always-on Service Worker neutralizer ──
// The app does NOT use a PWA / SW. Any SW found is a leftover from older
// builds (or a stale install on mobile) and MUST be unregistered every load
// to prevent the device from being stuck on an old shell/cache.
try {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      if (regs.length > 0) {
        console.log("[PWA Cleanup] Unregistering", regs.length, "service worker(s)");
        regs.forEach((r) => r.unregister());
      }
    });
    // If a SW is currently controlling the page and then gets replaced/removed,
    // reload once so the new build's assets take effect immediately on mobile.
    let didReloadForSwChange = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (didReloadForSwChange) return;
      didReloadForSwChange = true;
      console.log("[PWA Cleanup] Service worker controller changed — reloading once");
      window.location.reload();
    });
  }
  if ("caches" in window) {
    caches.keys().then((names) => {
      if (names.length > 0) {
        console.log("[PWA Cleanup] Deleting", names.length, "stale cache(s)");
        names.forEach((n) => caches.delete(n));
      }
    });
  }
} catch { /* best-effort */ }

// Clear boot timeout — app JS loaded successfully
if ((window as any).__apeBootTimer) {
  clearTimeout((window as any).__apeBootTimer);
}

// Remove boot loader so it doesn't flash under React
const bootLoader = document.getElementById("boot-loader");
if (bootLoader) bootLoader.remove();

createRoot(document.getElementById("root")!).render(
  <SafeMode>
    <App />
  </SafeMode>
);
