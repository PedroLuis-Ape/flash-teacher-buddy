import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/index.css", "utf8");
const component = readFileSync("src/components/ape/GameCardMotion.tsx", "utf8");

describe("GameCardMotion contract", () => {
  it("uses shared motion tokens and transform-only interaction", () => {
    expect(css).toContain("--ape-motion-fast");
    expect(css).toContain(".ape-game-card-motion");
    expect(css).toContain("transform:");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).not.toContain("transition: width");
    expect(css).not.toContain("transition: height");
  });

  it("keeps the surface keyboard and coarse-pointer safe", () => {
    expect(component).toContain("forwardRef");
    expect(component).toContain("usePointerTilt");
    expect(component).toContain('type="button"');
    expect(component).toContain('data-motion-surface="game-card"');
    expect(css).toContain("pointer: fine");
    expect(css).toContain("focus-visible");
  });
});
