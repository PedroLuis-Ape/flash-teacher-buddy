/**
 * APE – Apprentice Practice & Enhancement
 * © 2025 APE Education. Todos os direitos reservados.
 */

import "./lib/bootWatchdog";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/store-package-avatar.css";
import "./lib/versionManager";
import "./lib/errorCapture";
import "./i18n/config";
import { SafeMode } from "./components/SafeMode";
import { HelmetProvider } from "react-helmet-async";
import { bootPalette } from "./lib/palettes";
import { isPreviewContext, runBootStability } from "./lib/bootStability";

async function attemptAutomaticRecovery() {
  if (isPreviewContext()) return false;
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.getRegistrations();
  }
  return false;
}

void attemptAutomaticRecovery;

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
  (window as any).__apeBootComplete = true;

  const watchdog = (window as any).__apeBootWatchdog;
  if (watchdog) {
    clearTimeout(watchdog);
    (window as any).__apeBootWatchdog = null;
  }

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

function renderBootstrapFailure(error: unknown) {
  console.error("[Bootstrap]", error);
  const root = document.getElementById("root");
  if (!root) return;

  const container = document.createElement("main");
  container.style.cssText =
    "min-height:100vh;display:grid;place-items:center;padding:24px;background:#09001f;color:#fff;font-family:Nunito,system-ui,sans-serif";

  const card = document.createElement("section");
  card.style.cssText =
    "width:min(460px,100%);border:1px solid rgba(181,91,255,.45);border-radius:18px;background:#100526;padding:24px;text-align:center";

  const title = document.createElement("h1");
  title.textContent = "Não foi possível iniciar o App Piteco";
  title.style.cssText = "font-size:20px;margin:0 0 10px";

  const detail = document.createElement("p");
  detail.textContent = error instanceof Error ? error.message : "Falha de inicialização desconhecida.";
  detail.style.cssText = "font-size:14px;line-height:1.5;color:#c9bed8;margin:0 0 18px;word-break:break-word";

  const reload = document.createElement("button");
  reload.type = "button";
  reload.textContent = "Tentar novamente";
  reload.style.cssText =
    "border:0;border-radius:12px;padding:12px 18px;background:#7c3aed;color:#fff;font-weight:700;cursor:pointer";
  reload.addEventListener("click", () => window.location.reload());

  card.append(title, detail, reload);
  container.append(card);
  root.replaceChildren(container);

  appReady = true;
  minTimePassed = true;
  finishAndHide();
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
  appReady = true;
  minTimePassed = true;
  finishAndHide();
}, SPLASH_MAX_MS);

async function mountApplication() {
  try {
    reportBoot(65, "Conectando ao Supabase oficial…");
    const [{ loadOfficialPlatformRuntime }, { installPlatformRuntime }] = await Promise.all([
      import("./integrations/supabase/runtimeBootstrap"),
      import("./integrations/supabase/platformRuntime"),
    ]);
    installPlatformRuntime(await loadOfficialPlatformRuntime());

    reportBoot(75, "Inicializando interface…");
    const { default: App } = await import("./App.tsx");

    createRoot(document.getElementById("root")!).render(
      <SafeMode>
        <HelmetProvider>
          <App />
        </HelmetProvider>
      </SafeMode>,
    );

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        appReady = true;
        splashLog("app ready");
        tryDismiss();
      });
    });
  } catch (error) {
    renderBootstrapFailure(error);
  }
}

void mountApplication();
