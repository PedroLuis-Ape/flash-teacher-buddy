import {
  applyVisualPreferences,
  normalizeVisualPreferences,
  persistVisualPreferences,
  type Appearance,
  type PaletteId,
  type VisualStyle,
} from "@/lib/visualPreferences";

const params = new URLSearchParams(window.location.search);
const requestedStyle = params.get("style");
const requestedAppearance = params.get("appearance");
const requestedTarget = params.get("target");

const visualStyle: VisualStyle =
  requestedStyle === "playful" || requestedStyle === "galaxy"
    ? requestedStyle
    : "classic";
const appearance: Appearance =
  requestedAppearance === "light" ||
  requestedAppearance === "system"
    ? requestedAppearance
    : "dark";
const palette: PaletteId =
  visualStyle === "galaxy" ? "galaxy" : "black";
const target =
  requestedTarget?.startsWith("/") && !requestedTarget.startsWith("//")
    ? requestedTarget
    : "/";

const preferences = normalizeVisualPreferences({
  version: 1,
  appearance,
  visualStyle,
  palette,
});

applyVisualPreferences(preferences);
persistVisualPreferences(preferences);
window.location.replace(target);
