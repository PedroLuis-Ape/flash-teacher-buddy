/**
 * APE – Apprentice Practice & Enhancement
 * © 2025 APE Education. Todos os direitos reservados.
 */

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/store-package-avatar.css";
import "./lib/versionManager";
import "./lib/errorCapture";
import "./i18n/config";
import { SafeMode } from "./components/SafeMode";
import { HelmetProvider } from "react-helmet-async";
import { bootPalette } from "./lib/palettes";
import { runBootStability } from "./lib/bootStability";

try { bootPalette(); } catch { /* noop */ }
try { runBootStability(); } catch { /* noop */ }

const reportBoot = (value: number, label?: string) => {
  try { (window as any).__apeBootProgress?.(value, label); } catch { /* noop */ }
};

const splashLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.debug("[StartupSplash]", ...args);
};

splashLog("mounted");
reportBoot(20, "Carregando módulos…");

if ((window as any).__apeBootTimer) {
  clearTimeout((window as any).__apeBootTimer);
  (window as any).__apeBootTimer = null;
}

reportBoot(55, "Preparando interface…");

const configuredMin = Number((window as any).__APE_SPLASH_MIN_MS);
const configuredMax = Number(
  (window as any).__APE_SPLASH_MAX_MS_HARD ?? (window as any).__APE_SPLASH_MAX_MS,
);
const SPLASH_MIN_MS = Number.isFinite(configuredMin)
  ? Math.min(Math.max(configuredMin, 0), 1200)
  : 350;
const SPLASH_MAX_MS = Number.isFinite(configuredMax)
  ? Math.min(Math.max(configuredMax, 1500), 9000)
  : 5000;
const startedAt: number = (window as any).__apeSplashStart || Date.now();

let appReady = false;
let minTimePassed = false;
let dismissed = false;

function tryDismiss() {
  if (dismissed || !minTimePassed || !appReady) return;
  finishAndHide();
}

function finishAndHide() {
  if (dismissed) return;
  dismissed = true;

  const statusTimer = (window as any).__apeBootStatusTimer;
  if (statusTimer) {
    clearTimeout(statusTimer);
    (window as any).__apeBootStatusTimer = null;
  }

  const loader = document.getElementById("boot-loader");
  if (!loader) return;

  document.getElementById("boot-status")?.classList.remove("boot-status--visible");
  loader.classList.add("boot-loader--hide");
  splashLog("dismissed");
  window.setTimeout(() => loader.remove(), 320);
}

const elapsedAtBoot = Date.now() - startedAt;
const remainingMin = Math.max(0, SPLASH_MIN_MS - elapsedAtBoot);
window.setTimeout(() => {
  minTimePassed = true;
  splashLog("minimum time passed");
  tryDismiss();
}, remainingMin);

window.setTimeout(() => {
  if (dismissed) return;
  splashLog("max timeout reached");
  finishAndHide();
}, SPLASH_MAX_MS);

reportBoot(70, "Inicializando interface…");
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
