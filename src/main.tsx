/**
 * APE – Apprentice Practice & Enhancement
 * © 2025 APE Education. Todos os direitos reservados.
 */

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/versionManager"; // Verificar versão e limpar cache
import "./lib/errorCapture"; // Global error/rejection capture (must be early)
import "./i18n/config"; // i18n initialization
import { SafeMode } from "./components/SafeMode";
import { HelmetProvider } from "react-helmet-async";
import { bootPalette } from "./lib/palettes";

// Apply user's saved palette BEFORE first paint to avoid a color flash.
// The boot splash also covers the moment of palette/theme switch.
try { bootPalette(); } catch { /* noop */ }

// ── Boot progress reporter ────────────────────────────────────────────
// The HTML inline script defines window.__apeBootProgress(value, label?)
// which drives the splash progress bar. We emit real milestones here so
// the bar reflects actual boot progress, not a fake animation.
const reportBoot = (value: number, label?: string) => {
  try { (window as any).__apeBootProgress?.(value, label); } catch { /* noop */ }
};
reportBoot(15, "Carregando módulos…");

const splashLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.debug("[StartupSplash]", ...args);
};
splashLog("mounted");

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

// ── Splash lifecycle ───────────────────────────────────────────────────
// The splash is a visual MASK over the app while it boots in background.
// The <App/> mounts immediately; the splash overlay sits above it (z-index
// 99999 in index.html) and is dismissed when:
//   (minimum time elapsed) AND (app is ready)
//   OR maximum timeout reached (safety release).
const SPLASH_MIN_MS = (window as any).__APE_SPLASH_MIN_MS ?? 3000;
const SPLASH_MAX_MS = (window as any).__APE_SPLASH_MAX_MS_HARD ?? 9000;
const startedAt: number = (window as any).__apeSplashStart || Date.now();

let appReady = false;
let minTimePassed = false;
let dismissed = false;
let progressInterval: number | null = null;

function startProgressTicker() {
  // 0% → 70% during the minimum window, 70% → 95% while waiting for appReady.
  const tick = () => {
    if (dismissed) return;
    const elapsed = Date.now() - startedAt;
    let target: number;
    if (elapsed < SPLASH_MIN_MS) {
      target = Math.min(70, Math.round((elapsed / SPLASH_MIN_MS) * 70));
    } else if (!appReady) {
      const overshoot = Math.min(1, (elapsed - SPLASH_MIN_MS) / 4000);
      target = 70 + Math.round(overshoot * 25); // 70 → 95
    } else {
      target = 95;
    }
    reportBoot(target);
  };
  tick();
  progressInterval = window.setInterval(tick, 150);
}

function tryDismiss() {
  if (dismissed) return;
  if (!minTimePassed || !appReady) return;
  finishAndHide();
}

function finishAndHide() {
  if (dismissed) return;
  dismissed = true;
  if (progressInterval !== null) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  // Drive the bar to 100% so the user sees real completion.
  reportBoot(100, "Pronto!");
  // Small grace delay (200ms) for the bar to visibly land on 100%.
  setTimeout(() => {
    const el = document.getElementById("boot-loader");
    if (!el) return;
    el.classList.add("boot-loader--hide");
    splashLog("dismissed");
    // Match CSS transition duration before removing from DOM.
    setTimeout(() => el.remove(), 550);
  }, 200);
}

// Schedule the minimum-time gate.
const elapsedAtBoot = Date.now() - startedAt;
const remainingMin = Math.max(0, SPLASH_MIN_MS - elapsedAtBoot);
setTimeout(() => {
  minTimePassed = true;
  splashLog("minimum time passed");
  tryDismiss();
}, remainingMin);

// Schedule the hard safety timeout — splash MUST go away even if app stalls.
setTimeout(() => {
  if (dismissed) return;
  splashLog("max timeout reached");
  finishAndHide();
}, SPLASH_MAX_MS);

startProgressTicker();

// Mount the app IMMEDIATELY in parallel with the splash. The splash sits
// outside #root and overlays the app while it boots in background.
reportBoot(40, "Inicializando interface…");
createRoot(document.getElementById("root")!).render(
  <SafeMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </SafeMode>
);

// Mark the app as "ready" once React has committed its first paint.
// Two rAFs guarantee layout + paint are flushed.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    appReady = true;
    splashLog("app ready");
    tryDismiss();
  });
});
