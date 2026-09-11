import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hubSource = readFileSync(new URL("../GamesHub.tsx", import.meta.url), "utf8");
const visualsSource = readFileSync(
  new URL("../../features/study/lib/gameModeVisuals.ts", import.meta.url),
  "utf8",
);

describe("GamesHub visual hierarchy contract", () => {
  it("gives every mode a semantic description in the existing visual token map", () => {
    expect(visualsSource).toContain("description: string;");
    expect(visualsSource.match(/description: "/g)).toHaveLength(6);
    expect(hubSource).toContain("aria-label={`${title}: ${visual.description}`}");
    expect(hubSource).toContain("{visual.description}");
  });

  it("makes recommended and configured states explicit beyond color", () => {
    expect(hubSource).toContain("RECOMENDADO");
    expect(hubSource).toContain("CONFIGURADO");
    expect(hubSource).toContain('data-recommended={recommended ? "true" : undefined}');
    expect(hubSource).toContain('data-configured={isConfigured ? "true" : undefined}');
    expect(hubSource).toContain("aria-pressed={isConfigured}");
  });

  it("uses a lower-density mobile grid and restores columns progressively", () => {
    expect(hubSource).toContain("grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6");
    expect(hubSource).toContain("sm:flex-col");
    expect(hubSource).toContain("sm:min-h-[136px]");
    expect(hubSource).toContain("gap-3 sm:gap-4");
    expect(hubSource).toContain("ape-content-safe-bottom");
  });

  it("keeps the existing launch and preference contracts in the visual tile", () => {
    expect(hubSource).toContain("onClick={() => startGame(mode)}");
    expect(hubSource).toContain("const visibleScope: \"all\" | \"favorites\"");
    expect(hubSource).toContain("{ scope: launchScope }");
    expect(hubSource).toContain("updateForCurrentScope({ direction: normalizeDirection(value) })");
  });
});
