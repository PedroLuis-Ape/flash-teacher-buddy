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
