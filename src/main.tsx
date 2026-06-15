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
import { runBootStability } from "./lib/bootStability";

try { bootPalette(); } catch { /* noop */ }
try { runBootStability(); } catch { /* noop */ }

const reportBoot = (value: number, label?: string) => {
  try { (window as any).__apeBootProgress?.(value, label); } catch { /* noop */ }
};
reportBoot(15, "Carregando módulos…");

const splashLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.debug("[StartupSplash]", ...args);
};
splashLog("mounted");

if ((window as any).__apeBootTimer) {
  clearTimeout((window as any).__apeBootTimer);
}

reportBoot(35, "Preparando interface…");

const configuredMin = Number((window as any).__APE_SPLASH_MIN_MS);
const configuredMax = Number(
  (window as any).__APE_SPLASH_MAX_MS_HARD ?? (window as any).__APE_SPLASH_MAX_MS,
);
const SPLASH_MIN_MS = Number.isFinite(configuredMin)
  ? Math.min(Math.max(configuredMin, 0), 800)
  : 500;
const SPLASH_MAX_MS = Number.isFinite(configuredMax)
  ? Math.min(Math.max(configuredMax, 1500), 9000)
  : 5000;
const startedAt: number = (window as any).__apeSplashStart || Date.now();

let appReady = false;
let minTimePassed = false;
let dismissed = false;
let progressInterval: number | null = null;

function startProgressTicker() {
  const tick = () => {
    if (dismissed) return;
    const elapsed = Date.now() - startedAt;
    let target: number;
    if (elapsed < SPLASH_MIN_MS) {
      target = Math.min(70, Math.round((elapsed / Math.max(SPLASH_MIN_MS, 1)) * 70));
    } else if (!appReady) {
      const overshoot = Math.min(1, (elapsed - SPLASH_MIN_MS) / 4000);
      target = 70 + Math.round(overshoot * 25);
    } else {
      target = 95;
    }
    reportBoot(target);
  };
  tick();
  progressInterval = window.setInterval(tick, 200);
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
  reportBoot(100, "Pronto!");
  setTimeout(() => {
    const el = document.getElementById("boot-loader");
    if (!el) return;
    el.classList.add("boot-loader--hide");
    splashLog("dismissed");
    setTimeout(() => el.remove(), 500);
  }, 80);
}

const elapsedAtBoot = Date.now() - startedAt;
const remainingMin = Math.max(0, SPLASH_MIN_MS - elapsedAtBoot);
setTimeout(() => {
  minTimePassed = true;
  splashLog("minimum time passed");
  tryDismiss();
}, remainingMin);

setTimeout(() => {
  if (dismissed) return;
  splashLog("max timeout reached");
  finishAndHide();
}, SPLASH_MAX_MS);

startProgressTicker();

reportBoot(40, "Inicializando interface…");
createRoot(document.getElementById("root")!).render(
  <SafeMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </SafeMode>
);

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    appReady = true;
    splashLog("app ready");
    tryDismiss();
  });
});
