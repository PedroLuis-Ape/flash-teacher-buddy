import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appBarSource = readFileSync(new URL("./ApeAppBar.tsx", import.meta.url), "utf8");
const tabBarSource = readFileSync(new URL("./ApeTabBar.tsx", import.meta.url), "utf8");
const indexCss = readFileSync(new URL("../../index.css", import.meta.url), "utf8");

describe("shared Piteco shell visual contract", () => {
  it("exposes the responsive primitives from the shared bars", () => {
    expect(appBarSource).toContain("ape-action-cluster");
    expect(appBarSource).toContain("ape-interactive-surface");
    expect(tabBarSource).toContain("ape-content-safe-bottom");
    expect(tabBarSource).toContain("ape-interactive-surface");
  });

  it("defines every shell primitive and opts them out under reduced motion", () => {
    for (const primitive of [
      "ape-content-safe-bottom",
      "ape-action-cluster",
      "ape-interactive-surface",
      "ape-overlay-scroll",
    ]) {
      expect(indexCss).toContain(`.${primitive}`);
    }

    const reducedMotionStart = indexCss.lastIndexOf("@media (prefers-reduced-motion: reduce)");
    expect(reducedMotionStart).toBeGreaterThan(-1);
    const reducedMotionCss = indexCss.slice(reducedMotionStart);

    for (const primitive of [
      "ape-action-cluster",
      "ape-interactive-surface",
      "ape-overlay-scroll",
    ]) {
      expect(reducedMotionCss).toContain(`.${primitive}`);
    }
  });
});
