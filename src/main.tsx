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
const RUNTIME_CONFIG_CACHE_KEY = "ape_runtime_config_v1";
const BOOT_RECOVERY_KEY = "ape_boot_recovery_v1";

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

function cacheRuntimeConfig(config: RuntimeSupabaseConfig) {
  try {
    window.localStorage.setItem(RUNTIME_CONFIG_CACHE_KEY, JSON.stringify(config));
  } catch {
    // Runtime configuration remains available in memory.
  }
}

function readCachedRuntimeConfig() {
  try {
    const raw = window.localStorage.getItem(RUNTIME_CONFIG_CACHE_KEY);
    if (!raw) return null;
    return validateRuntimeConfig(JSON.parse(raw) as RuntimeSupabaseConfig);
  } catch {
    try { window.localStorage.removeItem(RUNTIME_CONFIG_CACHE_KEY); } catch { /* noop */ }
    return null;
  }
}

async function fetchRuntimeConfig() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);

  try {
    // Keep this request simple; the function is public and CORS-enabled.
    const response = await fetch(RUNTIME_CONFIG_URL, { signal: controller.signal });

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

    return validateRuntimeConfig({
      projectId: payload.projectId,
      url: payload.url,
      publishableKey: payload.publishableKey,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function loadRuntimeConfig() {
  const envProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envPublicValue = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

  if (envProjectId && envUrl && envPublicValue) {
    const config = validateRuntimeConfig({
      projectId: envProjectId,
      url: envUrl,
      publishableKey: envPublicValue,
    });
    runtimeWindow.__APE_SUPABASE_CONFIG__ = config;
    cacheRuntimeConfig(config);
    return;
  }

  try {
    const config = await fetchRuntimeConfig();
    runtimeWindow.__APE_SUPABASE_CONFIG__ = config;
    cacheRuntimeConfig(config);
  } catch (error) {
    const cached = readCachedRuntimeConfig();
    if (!cached) throw error;
    console.warn("[Bootstrap] Using cached public runtime configuration after fetch failure.", error);
    runtimeWindow.__APE_SUPABASE_CONFIG__ = cached;
  }
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

async function attemptAutomaticRecovery(error: unknown) {
  try {
    if (window.sessionStorage.getItem(BOOT_RECOVERY_KEY) === "1") return false;
    window.sessionStorage.setItem(BOOT_RECOVERY_KEY, "1");

    console.warn("[Bootstrap] Attempting one automatic cache recovery.", error);

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const cacheNames = await window.caches.keys();
      await Promise.allSettled(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
    }

    const recoveryUrl = new URL(window.location.href);
    recoveryUrl.searchParams.set("_ape_recover", Date.now().toString());
    window.location.replace(recoveryUrl.toString());
    return true;
  } catch (recoveryError) {
    console.error("[Bootstrap] Automatic recovery failed.", recoveryError);
    return false;
  }
}

function renderBootError(error: unknown) {
  console.error("[Bootstrap]", error);
  const root = document.getElementById("root");
  if (!root) return;

  const container = document.createElement("main");
  container.style.cssText =
    "min-height:100vh;display:grid;place-items:center;padding:24px;background:#09001f;color:#fff;font-family:Nunito,system-ui,sans-serif;text-align:center";
  const content = document.createElement("div");
  content.style.cssText = "max-width:560px";
  const title = document.createElement("h1");
  const message = document.createElement("p");
  const detail = document.createElement("p");
  const reload = document.createElement("button");

  title.textContent = "Não foi possível iniciar o App Piteco";
  message.textContent = "O aplicativo tentou se recuperar automaticamente, mas a inicialização ainda falhou.";
  detail.textContent = error instanceof Error ? error.message : "Erro de inicialização desconhecido.";
  detail.style.cssText = "opacity:.72;font-size:13px;word-break:break-word";
  reload.textContent = "Recarregar novamente";
  reload.style.cssText =
    "margin-top:16px;padding:12px 18px;border:0;border-radius:10px;background:#f2c94c;color:#19072d;font-weight:800;cursor:pointer";
  reload.addEventListener("click", () => {
    window.sessionStorage.removeItem(BOOT_RECOVERY_KEY);
    window.location.reload();
  });

  content.append(title, message, detail, reload);
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
        try { window.sessionStorage.removeItem(BOOT_RECOVERY_KEY); } catch { /* noop */ }
        splashLog("app ready");
        tryDismiss();
      });
    });
  } catch (error) {
    const recovering = await attemptAutomaticRecovery(error);
    if (recovering) return;
    renderBootError(error);
    finishAndHide();
  }
}

void mountApp();
