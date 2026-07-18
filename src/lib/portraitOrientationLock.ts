type PortraitOrientation = "portrait" | "portrait-primary";

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: PortraitOrientation) => Promise<void>;
};

type LegacyLockableScreen = Screen & {
  lockOrientation?: (orientation: PortraitOrientation) => boolean;
  mozLockOrientation?: (orientation: PortraitOrientation) => boolean;
  msLockOrientation?: (orientation: PortraitOrientation) => boolean;
};

const HANDHELD_QUERY = "(pointer: coarse)";
const LOCK_CANDIDATES: PortraitOrientation[] = ["portrait", "portrait-primary"];

function isLikelyHandheld(): boolean {
  if (typeof window === "undefined") return false;

  const coarsePointer =
    typeof window.matchMedia === "function" &&
    window.matchMedia(HANDHELD_QUERY).matches;

  return coarsePointer || window.navigator.maxTouchPoints > 0;
}

function setLockState(state: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.orientationLock = state;
}

function getErrorName(error: unknown): string {
  return error instanceof DOMException ? error.name : "error";
}

/**
 * Requests portrait orientation without assuming that the app is running in a
 * specific display mode. Some Android shortcuts and WebAPK/TWA windows do not
 * report `display-mode: standalone` consistently, even though orientation
 * locking is available.
 */
export async function requestPortraitOrientationLock(): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    document.hidden ||
    !isLikelyHandheld()
  ) {
    return false;
  }

  const orientation = window.screen?.orientation as
    | LockableScreenOrientation
    | undefined;

  if (orientation && typeof orientation.lock === "function") {
    let lastError = "denied";

    for (const candidate of LOCK_CANDIDATES) {
      try {
        await orientation.lock(candidate);
        setLockState("locked");
        return true;
      } catch (error) {
        lastError = getErrorName(error);
      }
    }

    setLockState(`rejected:${lastError}`);
  }

  const legacyScreen = window.screen as LegacyLockableScreen;
  const legacyLock =
    legacyScreen.lockOrientation ||
    legacyScreen.mozLockOrientation ||
    legacyScreen.msLockOrientation;

  if (typeof legacyLock === "function") {
    try {
      const locked =
        legacyLock.call(legacyScreen, "portrait") ||
        legacyLock.call(legacyScreen, "portrait-primary");

      if (locked) {
        setLockState("locked:legacy");
        return true;
      }
    } catch {
      setLockState("rejected:legacy");
      return false;
    }
  }

  if (!orientation || typeof orientation.lock !== "function") {
    setLockState("unsupported");
  }

  return false;
}

/**
 * Keeps retrying the portrait request when the browser regains focus, rotates,
 * or receives a real user gesture. The calls are harmless on browsers that do
 * not support orientation locking; the landscape route guard remains the final
 * deterministic fallback for game screens.
 */
export function installPortraitOrientationGuard(): () => void {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    !isLikelyHandheld()
  ) {
    return () => undefined;
  }

  let disposed = false;
  let pending = false;

  const lockPortrait = () => {
    if (disposed || pending || document.hidden) return;

    pending = true;
    void requestPortraitOrientationLock().finally(() => {
      pending = false;
    });
  };

  const handleVisibilityChange = () => {
    if (!document.hidden) lockPortrait();
  };

  lockPortrait();

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pageshow", lockPortrait);
  window.addEventListener("orientationchange", lockPortrait);
  window.addEventListener("resize", lockPortrait);
  window.addEventListener("pointerdown", lockPortrait, { passive: true });
  window.addEventListener("keydown", lockPortrait);
  window.screen?.orientation?.addEventListener("change", lockPortrait);

  return () => {
    disposed = true;
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("pageshow", lockPortrait);
    window.removeEventListener("orientationchange", lockPortrait);
    window.removeEventListener("resize", lockPortrait);
    window.removeEventListener("pointerdown", lockPortrait);
    window.removeEventListener("keydown", lockPortrait);
    window.screen?.orientation?.removeEventListener("change", lockPortrait);
  };
}
