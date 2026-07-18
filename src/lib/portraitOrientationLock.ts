type PortraitOrientation = "portrait-primary";

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: PortraitOrientation) => Promise<void>;
};

type StandaloneNavigator = Navigator & {
  standalone?: boolean;
};

const INSTALLED_DISPLAY_MODES = [
  "standalone",
  "fullscreen",
  "minimal-ui",
  "window-controls-overlay",
] as const;

function isInstalledAppWindow(): boolean {
  const matchesInstalledDisplayMode =
    typeof window.matchMedia === "function" &&
    INSTALLED_DISPLAY_MODES.some((mode) =>
      window.matchMedia(`(display-mode: ${mode})`).matches
    );

  const iosStandalone =
    (window.navigator as StandaloneNavigator).standalone === true;

  return matchesInstalledDisplayMode || iosStandalone;
}

/**
 * Reinforces the portrait-only manifest setting at runtime.
 *
 * Some installed browsers keep an older manifest snapshot for a while. The
 * runtime lock makes the current session request portrait immediately and
 * retries after resume, rotation and the first user interaction.
 */
export function installPortraitOrientationGuard(): () => void {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    !isInstalledAppWindow()
  ) {
    return () => undefined;
  }

  const orientation = window.screen?.orientation as
    | LockableScreenOrientation
    | undefined;

  if (!orientation || typeof orientation.lock !== "function") {
    return () => undefined;
  }

  let disposed = false;

  const lockPortrait = () => {
    if (disposed || document.hidden) return;

    try {
      const request = orientation.lock?.("portrait-primary");
      request?.catch(() => undefined);
    } catch {
      // Unsupported or temporarily disallowed by the browser. A later retry may work.
    }
  };

  const handleVisibilityChange = () => {
    if (!document.hidden) lockPortrait();
  };

  lockPortrait();

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pageshow", lockPortrait);
  window.addEventListener("orientationchange", lockPortrait);
  window.addEventListener("pointerdown", lockPortrait, {
    once: true,
    passive: true,
  });
  window.addEventListener("keydown", lockPortrait, { once: true });
  orientation.addEventListener("change", lockPortrait);

  return () => {
    disposed = true;
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("pageshow", lockPortrait);
    window.removeEventListener("orientationchange", lockPortrait);
    window.removeEventListener("pointerdown", lockPortrait);
    window.removeEventListener("keydown", lockPortrait);
    orientation.removeEventListener("change", lockPortrait);
  };
}
