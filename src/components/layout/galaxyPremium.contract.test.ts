import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const layer = read("src/components/layout/GalaxyVisualLayer.tsx");
const canvas = read("src/components/layout/GalaxyDepthCanvas.tsx");
const publicGate = read("src/components/layout/PublicGalaxyGate.tsx");
const premiumStyles = read("src/styles/space-galaxy-premium.css");
const nebula = read("public/assets/galaxy/galaxy-nebula-arm.svg");
const dust = read("public/assets/galaxy/galaxy-nebula-dust.svg");
const spiral = read("public/assets/galaxy/galaxy-spiral-main.svg");

describe("premium galaxy visual contract", () => {
  it("preserves the existing Galaxy layer and adds a dedicated depth canvas", () => {
    expect(layer).toContain("GalaxyDepthCanvas");
    expect(layer).toContain("getGalaxyCometPlan");
    expect(layer).toContain("getGalaxyScenePlan");
    expect(layer).toContain("space-galaxy-effects--landing");
    expect(layer).toContain("space-galaxy-readability-field");
  });

  it("caps DPR intelligently instead of rendering at unbounded devicePixelRatio", () => {
    expect(canvas).toContain("window.devicePixelRatio || 1");
    expect(canvas).toContain("Math.min(device, 1.15)");
    expect(canvas).toContain('quality === "high" ? 1.55 : 1.4');
    expect(canvas).toContain('quality === "high" ? 2 : 1.75');
  });

  it("uses three visual depth planes with restrained pointer and scroll parallax", () => {
    expect(canvas).toContain("type StarDepth = 0 | 1 | 2");
    expect(canvas).toContain("DEPTH_PARALLAX");
    expect(canvas).toContain("DEPTH_SCROLL");
    expect(canvas).toContain("window.scrollY");
    expect(canvas).toContain('(pointer: fine)');
    expect(canvas).not.toContain('addEventListener("scroll"');
  });

  it("keeps animation budgets adaptive by tier and quality", () => {
    expect(canvas).toContain("1000 / 40");
    expect(canvas).toContain("1000 / 32");
    expect(canvas).toContain("1000 / 24");
    expect(canvas).toContain("tierCap");
    expect(canvas).toContain("getPixelRatio");
  });

  it("provides a polished static fallback for mobile and reduced motion", () => {
    expect(publicGate).toContain("space-galaxy-effects--static-fallback");
    expect(premiumStyles).toContain("@media (max-width: 767px), (update: slow)");
    expect(premiumStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(premiumStyles).toContain("space-galaxy-effects--static-fallback");
  });

  it("reduces the old baked-in blur while adding finer nebula structure", () => {
    expect(nebula).not.toContain('stdDeviation="34"');
    expect(dust).not.toContain('stdDeviation="42"');
    expect(spiral).not.toContain('stdDeviation="18"');
    expect(nebula).toContain('stdDeviation="18"');
    expect(nebula).toContain('stdDeviation="7"');
    expect(dust).toContain('stdDeviation="24"');
    expect(spiral).toContain('stdDeviation="10"');
  });

  it("keeps the landing copy side calmer than the product side", () => {
    expect(canvas).toContain("x < width * 0.54");
    expect(premiumStyles).toContain("Landing composition: richer around the product demo, calmer behind the copy");
    expect(premiumStyles).toContain("space-galaxy-readability-field");
  });
});
