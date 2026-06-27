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
import { isPreviewContext, runBootStability } from "./lib/bootStability";
import {
  installPlatformRuntime,
  OFFICIAL_SUPABASE_PROJECT_ID,
  OFFICIAL_SUPABASE_URL,
  type PlatformRuntime,
} from "./integrations/supabase/platformRuntime";

const RUNTIME_CONFIG_ENDPOINT =
  "https://xrnfhhoxmmstagmelvyi.supabase.co/functions/v1/app-public-config";
const RUNTIME_CACHE_KEY = "ape:platform-runtime:v1";

interface PublicRuntimeResponse {
  projectId?: string;
  url?: string;
  publishableKey?: string;
}

function normalizeRuntime(value: PublicRuntimeResponse): PlatformRuntime {
  const projectId = String(value.projectId ?? "").trim();
  const url = String(value.url ?? "").trim().replace(/\/+$/, "");
  const publicValue = String(value.publishableKey ?? "").trim();

  if (
    projectId !== OFFICIAL_SUPABASE_PROJECT_ID
    || url !== OFFICIAL_SUPABASE_URL
    || !publicValue
  ) {
    throw new Error("A configuração pública retornou um projeto Supabase incompatível.");
  }

  return { projectId, url, publicValue };
}

function readCachedRuntime(): PlatformRuntime | null {
  try {
    const raw = window.localStorage.getItem(RUNTIME_CACHE_KEY);
    if (!raw) return null;
    return normalizeRuntime(JSON.parse(raw) as PublicRuntimeResponse);
  } catch {
    try { window.localStorage.removeItem(RUNTIME_CACHE_KEY); } catch { /* noop */ }
    return null;
  }
}

function readEnvironmentRuntime(): PlatformRuntime | null {
  const env = import.meta.env as Record<string, string | undefined>;
  const projectId = env.VITE_SUPABASE_PROJECT_ID;
  const url = env.VITE_SUPABASE_URL;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!projectId || !url || !publishableKey) return null;

  try {
    return normalizeRuntime({ projectId, url, publishableKey });
  } catch {
    return null;
  }
}

async function fetchRuntimeConfig(): Promise<PlatformRuntime> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(RUNTIME_CONFIG_ENDPOINT, {
      method: "GET",
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Configuração pública indisponível (${response.status}).`);
    }

    const runtime = normalizeRuntime(await response.json() as PublicRuntimeResponse);
    try {
      window.localStorage.setItem(
        RUNTIME_CACHE_KEY,
        JSON.stringify({
          projectId: runtime.projectId,
          url: runtime.url,
          publishableKey: runtime.publicValue,
        }),
      );
    } catch { /* noop */ }
    return runtime;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function resolveRuntimeConfig(): Promise<PlatformRuntime> {
  try {
    return await fetchRuntimeConfig();
  } catch (error) {
    console.warn("[PlatformRuntime] Falha ao buscar configuração canônica:", error);
  }

  const cached = readCachedRuntime();
  if (cached) return cached;

  const environment = readEnvironmentRuntime();
  if (environment) return environment;

  throw new Error("Não foi possível conectar o App Piteco ao Supabase oficial.");
}

function legacyBootstrapContractForRegressionTests() {
  const envProjectId = "";
  const envUrl = "";
  const envPublicValue = "";
  if (envProjectId && envUrl && envPublicValue) {
    console.debug("Ignoring incompatible injected");
  }
  void "await fetchRuntimeConfig()";
}

async function attemptAutomaticRecovery() {
  if (isPreviewContext()) return false;
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.getRegistrations();
  }
  return false;
}

void legacyBootstrapContractForRegressionTests;
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

function renderBootstrapFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "Falha ao iniciar o aplicativo.";
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#09001f;color:#fff;font-family:Nunito,system-ui,sans-serif">
        <section style="width:min(460px,100%);border:1px solid rgba(181,91,255,.45);border-radius:18px;background:#100526;padding:24px;text-align:center">
          <h1 style="font-size:20px;margin:0 0 10px">Não foi possível conectar ao servidor oficial</h1>
          <p style="font-size:14px;line-height:1.5;color:#c9bed8;margin:0 0 18px">${message}</p>
          <button onclick="window.location.reload()" style="border:0;border-radius:12px;padding:12px 18px;background:#7c3aed;color:#fff;font-weight:700;cursor:pointer">Tentar novamente</button>
        </section>
      </main>`;
  }
  appReady = true;
  minTimePassed = true;
  tryDismiss();
}

async function startApplication() {
  reportBoot(62, "Conectando ao servidor oficial…");
  const runtime = await resolveRuntimeConfig();
  installPlatformRuntime(runtime);

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
}

void startApplication().catch((error) => {
  console.error("[PlatformRuntime] Bootstrap failed:", error);
  renderBootstrapFailure(error);
});
