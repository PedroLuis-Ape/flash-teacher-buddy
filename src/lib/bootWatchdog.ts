const WATCHDOG_MS = 9000;
const RECOVERY_VERSION = "2026-06-27-installed-pwa-reset-2";
const RECOVERY_KEY = "ape_boot_recovery_version";

type BootWindow = Window & {
  __apeBootComplete?: boolean;
  __apeBootWatchdog?: number | null;
};

const bootWindow = window as BootWindow;

function isPreviewContext() {
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }

  const host = window.location.hostname;
  return (
    host.includes("preview") ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovableproject-dev.com") ||
    host.endsWith(".lovable.dev")
  );
}

function removeSplashImmediately() {
  const loader = document.getElementById("boot-loader");
  if (!loader) return;
  loader.style.pointerEvents = "none";
  loader.style.opacity = "0";
  window.setTimeout(() => loader.remove(), 280);
}

function showStartupTimeout() {
  const root = document.getElementById("root");
  if (!root || root.childElementCount > 0) return;

  const container = document.createElement("main");
  container.style.cssText =
    "min-height:100vh;display:grid;place-items:center;padding:24px;background:#09001f;color:#fff;font-family:Nunito,system-ui,sans-serif";

  const card = document.createElement("section");
  card.style.cssText =
    "width:min(460px,100%);border:1px solid rgba(181,91,255,.45);border-radius:18px;background:#100526;padding:24px;text-align:center";

  const title = document.createElement("h1");
  title.textContent = "O App Piteco demorou para iniciar";
  title.style.cssText = "font-size:20px;margin:0 0 10px";

  const text = document.createElement("p");
  text.textContent = "Feche e abra o aplicativo novamente para carregar a versão mais recente.";
  text.style.cssText = "font-size:14px;line-height:1.5;color:#c9bed8;margin:0 0 18px";

  const reload = document.createElement("button");
  reload.type = "button";
  reload.textContent = "Recarregar agora";
  reload.style.cssText =
    "border:0;border-radius:12px;padding:12px 18px;background:#7c3aed;color:#fff;font-weight:700;cursor:pointer";
  reload.addEventListener("click", () => window.location.reload());

  card.append(title, text, reload);
  container.append(card);
  root.replaceChildren(container);
}

async function cleanLegacyRuntimeOnce() {
  if (isPreviewContext()) return;

  try {
    if (window.localStorage.getItem(RECOVERY_KEY) === RECOVERY_VERSION) return;
    window.localStorage.setItem(RECOVERY_KEY, RECOVERY_VERSION);
  } catch {
    // Continue with best-effort cleanup when storage is unavailable.
  }

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map((registration) => registration.unregister()));
    }
  } catch (error) {
    console.warn("[BootWatchdog] Service worker cleanup failed.", error);
  }

  try {
    if ("caches" in window) {
      const names = await window.caches.keys();
      await Promise.allSettled(names.map((name) => window.caches.delete(name)));
    }
  } catch (error) {
    console.warn("[BootWatchdog] Cache cleanup failed.", error);
  }
}

void cleanLegacyRuntimeOnce();

bootWindow.__apeBootWatchdog = window.setTimeout(() => {
  if (bootWindow.__apeBootComplete) return;
  bootWindow.__apeBootComplete = true;
  console.error("[BootWatchdog] Startup exceeded the maximum wait time.");
  removeSplashImmediately();
  showStartupTimeout();
}, WATCHDOG_MS);
