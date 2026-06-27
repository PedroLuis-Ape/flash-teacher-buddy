/**
 * APE – Apprentice Practice & Enhancement
 * © 2025 APE Education. Todos os direitos reservados.
 */

import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/store-package-avatar.css";
import "./lib/versionManager";
import "./lib/errorCapture";
import "./i18n/config";
import { SafeMode } from "./components/SafeMode";
import { HelmetProvider } from "react-helmet-async";
import { bootPalette } from "./lib/palettes";
import { runBootStability } from "./lib/bootStability";

const OFFICIAL_PROJECT_ID = "xrnfhhoxmmstagmelvyi";
const RUNTIME_CONFIG_URL =
  "https://xrnfhhoxmmstagmelvyi.supabase.co/functions/v1/app-public-config";

type RuntimeSupabaseConfig = {
  projectId: string;
  url: string;
  publishableKey: string;
};

const runtimeWindow = window as typeof window & {
  __APE_SUPABASE_CONFIG__?: RuntimeSupabaseConfig;
};

try { bootPalette(); } catch { /* noop */ }
try { runBootStability(); } catch { /* noop */ }

const reportBoot = (value: number, label?: string) => {
  try { (window as any).__apeBootProgress?.(value, label); } catch { /* noop */ }
};

const splashLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.debug("[StartupSplash]", ...args);
};

function validateRuntimeConfig(config: RuntimeSupabaseConfig) {
  const projectFromHost = new URL(config.url).hostname.split(".")[0];

  if (
    config.projectId !== OFFICIAL_PROJECT_ID ||
    projectFromHost !== OFFICIAL_PROJECT_ID ||
    !config.publishableKey
  ) {
    throw new Error("Runtime environment does not match the official project.");
  }

  return Object.freeze(config);
}

async function loadRuntimeConfig() {
  const envProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envPublicValue = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

  if (envProjectId && envUrl && envPublicValue) {
    runtimeWindow.__APE_SUPABASE_CONFIG__ = validateRuntimeConfig({
      projectId: envProjectId,
      url: envUrl,
      publishableKey: envPublicValue,
    });
    return;
  }

  const response = await fetch(RUNTIME_CONFIG_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Runtime config request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as Partial<RuntimeSupabaseConfig>;
  if (
    typeof payload.projectId !== "string" ||
    typeof payload.url !== "string" ||
    typeof payload.publishableKey !== "string"
  ) {
    throw new Error("Runtime config response is invalid.");
  }

  runtimeWindow.__APE_SUPABASE_CONFIG__ = validateRuntimeConfig({
    projectId: payload.projectId,
    url: payload.url,
    publishableKey: payload.publishableKey,
  });
}

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

function renderBootError(error: unknown) {
  console.error("[Bootstrap]", error);
  const root = document.getElementById("root");
  if (!root) return;

  const container = document.createElement("main");
  container.style.cssText =
    "min-height:100vh;display:grid;place-items:center;padding:24px;background:#09001f;color:#fff;font-family:Nunito,system-ui,sans-serif;text-align:center";
  const content = document.createElement("div");
  const title = document.createElement("h1");
  const message = document.createElement("p");
  title.textContent = "Não foi possível iniciar o App Piteco";
  message.textContent = "A configuração do ambiente está indisponível. Recarregue a página em alguns instantes.";
  content.append(title, message);
  container.append(content);
  root.replaceChildren(container);
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

async function mountApp() {
  try {
    reportBoot(62, "Conectando ao ambiente…");
    await loadRuntimeConfig();
    reportBoot(70, "Inicializando interface…");

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
    renderBootError(error);
    finishAndHide();
  }
}

void mountApp();
