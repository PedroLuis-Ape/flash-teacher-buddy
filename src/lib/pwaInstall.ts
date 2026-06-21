export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
}

export type PWAInstallResult = "accepted" | "dismissed" | "unavailable" | "installed";

export interface PWAInstallState {
  available: boolean;
  installed: boolean;
}

type Listener = (state: PWAInstallState) => void;

const listeners = new Set<Listener>();
let deferredPrompt: BeforeInstallPromptEvent | null = null;

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

let state: PWAInstallState = {
  available: false,
  installed: detectStandalone(),
};

function emit(next: Partial<PWAInstallState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener(state));
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit({ available: true, installed: false });
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    emit({ available: false, installed: true });
  });

  window.matchMedia("(display-mode: standalone)").addEventListener?.("change", () => {
    if (detectStandalone()) emit({ available: false, installed: true });
  });
}

export function getPWAInstallState(): PWAInstallState {
  return state;
}

export function subscribeToPWAInstall(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function requestPWAInstall(): Promise<PWAInstallResult> {
  if (state.installed || detectStandalone()) {
    emit({ available: false, installed: true });
    return "installed";
  }

  if (!deferredPrompt) return "unavailable";

  const prompt = deferredPrompt;
  deferredPrompt = null;
  emit({ available: false });

  await prompt.prompt();
  const choice = await prompt.userChoice;

  if (choice.outcome === "accepted") {
    emit({ available: false, installed: true });
  }

  return choice.outcome;
}
