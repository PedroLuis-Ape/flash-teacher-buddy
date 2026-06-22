import { lazy, Suspense } from "react";
import { usePalette } from "@/hooks/usePalette";

const GalaxyVisualLayer = lazy(() =>
  import("@/components/layout/GalaxyVisualLayer").then((module) => ({
    default: module.GalaxyVisualLayer,
  })),
);

/**
 * Keeps the complete Galaxy experience out of the default private shell bundle.
 * The visual layer and its Galaxy-only CSS are downloaded only while the
 * Galaxy palette is active. No visual feature is removed or downgraded.
 */
export function PrivateGalaxyGate() {
  const { palette } = usePalette();

  if (palette !== "galaxy") return null;

  return (
    <Suspense fallback={null}>
      <GalaxyVisualLayer />
    </Suspense>
  );
}
