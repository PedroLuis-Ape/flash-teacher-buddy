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

// ── Boot progress reporter ────────────────────────────────────────────
// The HTML inline script defines window.__apeBootProgress(value, label?)
// which drives the splash progress bar. We emit real milestones here so
// the bar reflects actual boot progress, not a fake animation.
const reportBoot = (value: number, label?: string) => {
  try { (window as any).__apeBootProgress?.(value, label); } catch { /* noop */ }
};
reportBoot(15, "Carregando módulos…");

// ── Always-on Service Worker neutralizer ──
// The app does NOT use a PWA / SW. Any SW found is a leftover from older
// builds (or a stale install on mobile) and MUST be unregistered every load
// to prevent the device from being stuck on an old shell/cache.
// IMPORTANT: do NOT auto-reload on `controllerchange`. In iframe/preview
// contexts (Lovable editor) this causes blank-screen reload loops that
// prevent the app from ever finishing boot — which also hides the
// version badge that lives in GlobalLayout.
try {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      if (regs.length > 0) {
        console.log("[PWA Cleanup] Unregistering", regs.length, "service worker(s)");
        regs.forEach((r) => r.unregister());
      }
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

reportBoot(35, "Preparando interface…");

// Remove the splash/boot loader, but enforce a minimum visible duration so
// the branding artwork is appreciated. Target window: 3s (min) — 5s (soft).
function dismissSplash() {
  const bootLoader = document.getElementById("boot-loader");
  if (!bootLoader) return;
  const startedAt = (window as any).__apeSplashStart || Date.now();
  const minMs = (window as any).__APE_SPLASH_MIN_MS ?? 3000;
  const elapsed = Date.now() - startedAt;
  const wait = Math.max(0, minMs - elapsed);
  // Drive the bar to 100% before fading out so the user sees completion.
  reportBoot(100, "Pronto!");
  setTimeout(() => {
    const el = document.getElementById("boot-loader");
    if (!el) return;
    el.classList.add("boot-loader--hide");
    // Match CSS transition duration before removing from DOM
    setTimeout(() => el.remove(), 550);
  }, wait);
}

createRoot(document.getElementById("root")!).render(
  <SafeMode>
    <App />
  </SafeMode>
);

// Wait for React to commit its first paint before dismissing the splash.
// This guarantees the app shell is actually ready behind the artwork.
reportBoot(70, "Inicializando sessão…");
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    reportBoot(90, "Quase lá…");
    // One more frame so the first React paint is fully committed.
    requestAnimationFrame(dismissSplash);
  });
});
