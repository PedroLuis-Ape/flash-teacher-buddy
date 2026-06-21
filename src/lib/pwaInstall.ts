export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
}

export type PWAInstallResult = "accepted" | "dismissed" | "unavailable" | "installed";

export interface PWAInstallState {
  available: boolean;
  installed: boolean;
}

export interface RequestPWAInstallOptions {
  /**
   * Chromium may emit beforeinstallprompt shortly after React renders.
   * Waiting briefly prevents an early click from falling back to instructions.
   */
  waitForPromptMs?: number;
}

type Listener = (state: PWAInstallState) => void;
type PromptWaiter = (available: boolean) => void;

declare global {
  interface Window {
    __apeInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

const INSTALL_READY_EVENT = "ape:pwa-install-ready";
const listeners = new Set<Listener>();
const promptWaiters = new Set<PromptWaiter>();
let deferredPrompt: BeforeInstallPromptEvent | null =
  typeof window !== "undefined" ? window.__apeInstallPrompt ?? null : null;

function ensureInstallMetadata() {
  if (typeof document === "undefined") return;

  if (!document.querySelector('link[rel="manifest"]')) {
    const manifest = document.createElement("link");
    manifest.rel = "manifest";
    manifest.href = "/manifest.webmanifest?v=20260621-install2";
    document.head.appendChild(manifest);
  }

  const metas: Array<[string, string]> = [
    ["mobile-web-app-capable", "yes"],
    ["apple-mobile-web-app-capable", "yes"],
    ["apple-mobile-web-app-status-bar-style", "black-translucent"],
    ["apple-mobile-web-app-title", "APE"],
  ];

  metas.forEach(([name, content]) => {
    if (document.querySelector(`meta[name="${name}"]`)) return;
    const meta = document.createElement("meta");
    meta.name = name;
    meta.content = content;
    document.head.appendChild(meta);
  });
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

let state: PWAInstallState = {
  available: Boolean(deferredPrompt),
  installed: detectStandalone(),
};

function emit(next: Partial<PWAInstallState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener(state));
}

function resolvePromptWaiters(available: boolean) {
  promptWaiters.forEach((resolve) => resolve(available));
  promptWaiters.clear();
}

function capturePrompt(prompt: BeforeInstallPromptEvent) {
  prompt.preventDefault?.();
  deferredPrompt = prompt;
  if (typeof window !== "undefined") window.__apeInstallPrompt = prompt;
  emit({ available: true, installed: false });
  resolvePromptWaiters(true);
}

async function waitForInstallPrompt(timeoutMs: number): Promise<boolean> {
  if (deferredPrompt || (typeof window !== "undefined" && window.__apeInstallPrompt)) {
    deferredPrompt = deferredPrompt ?? window.__apeInstallPrompt ?? null;
    return Boolean(deferredPrompt);
  }

  if (timeoutMs <= 0 || typeof window === "undefined") return false;

  return new Promise<boolean>((resolve) => {
    let settled = false;

    const finish = (available: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener(INSTALL_READY_EVENT, handleReady);
      promptWaiters.delete(finish);
      resolve(available);
    };

    const handleReady = () => {
      deferredPrompt = deferredPrompt ?? window.__apeInstallPrompt ?? null;
      finish(Boolean(deferredPrompt));
    };

    const timer = window.setTimeout(() => finish(false), timeoutMs);
    promptWaiters.add(finish);
    window.addEventListener(INSTALL_READY_EVENT, handleReady, { once: true });
  });
}

if (typeof window !== "undefined") {
  ensureInstallMetadata();

  window.addEventListener("beforeinstallprompt", (event) => {
    capturePrompt(event as BeforeInstallPromptEvent);
  });

  window.addEventListener(INSTALL_READY_EVENT, () => {
    const prompt = window.__apeInstallPrompt;
    if (prompt) capturePrompt(prompt);
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.__apeInstallPrompt = null;
    emit({ available: false, installed: true });
    resolvePromptWaiters(false);
  });

  window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", () => {
    if (detectStandalone()) {
      deferredPrompt = null;
      window.__apeInstallPrompt = null;
      emit({ available: false, installed: true });
      resolvePromptWaiters(false);
    }
  });
}

export function getPWAInstallState(): PWAInstallState {
  return state;
}

export function subscribeToPWAInstall(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export async function requestPWAInstall(
  options: RequestPWAInstallOptions = {},
): Promise<PWAInstallResult> {
  if (state.installed || detectStandalone()) {
    emit({ available: false, installed: true });
    return "installed";
  }

  const hasPrompt = await waitForInstallPrompt(options.waitForPromptMs ?? 0);
  if (!hasPrompt || !deferredPrompt) return "unavailable";

  const prompt = deferredPrompt;
  deferredPrompt = null;
  if (typeof window !== "undefined") window.__apeInstallPrompt = null;
  emit({ available: false });

  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;

    if (choice.outcome === "accepted") {
      emit({ available: false, installed: true });
    }

    return choice.outcome;
  } catch (error) {
    console.warn("[PWA] Native install prompt could not be opened:", error);
    return "unavailable";
  }
}
