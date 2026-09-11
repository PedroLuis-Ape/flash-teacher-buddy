import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appBarSource = readFileSync(new URL("./ApeAppBar.tsx", import.meta.url), "utf8");
const tabBarSource = readFileSync(new URL("./ApeTabBar.tsx", import.meta.url), "utf8");
const privateShellSource = readFileSync(new URL("../layout/PrivateShell.tsx", import.meta.url), "utf8");
const indexCss = readFileSync(new URL("../../index.css", import.meta.url), "utf8");

describe("shared Piteco shell visual contract", () => {
  it("exposes the responsive primitives from the shared bars", () => {
    expect(appBarSource).toContain("ape-action-cluster");
    expect(appBarSource).toContain("ape-interactive-surface");
    expect(tabBarSource).toContain("ape-interactive-surface");
    expect(tabBarSource).toContain("safe-area-pb");
    expect(tabBarSource).not.toMatch(/<nav[\s\S]*ape-content-safe-bottom/);
    expect(privateShellSource).toMatch(/space-ui-footer-wrap[^\"]*ape-content-safe-bottom/);
  });

  it("defines the shell declarations and opts every primitive out under reduced motion", () => {
    for (const primitive of [
      "ape-content-safe-bottom",
      "ape-action-cluster",
      "ape-interactive-surface",
      "ape-overlay-scroll",
    ]) {
      expect(indexCss).toContain(`.${primitive}`);
    }

    expect(indexCss).toContain(
      "padding-bottom: max(6rem, calc(var(--ape-tab-bar-height) + env(safe-area-inset-bottom, 0px))) !important;",
    );
    expect(indexCss).toContain(
      "padding-bottom: max(5rem, calc(var(--ape-tab-bar-height) + env(safe-area-inset-bottom, 0px))) !important;",
    );
    expect(indexCss).toContain("padding-bottom: env(safe-area-inset-bottom, 0px);");
    expect(indexCss).toContain("scrollbar-gutter: stable;");

    const reducedMotionStart = indexCss.lastIndexOf("@media (prefers-reduced-motion: reduce)");
    expect(reducedMotionStart).toBeGreaterThan(-1);
    const reducedMotionCss = indexCss.slice(reducedMotionStart);

    for (const primitive of [
      "ape-content-safe-bottom",
      "ape-action-cluster",
      "ape-interactive-surface",
      "ape-overlay-scroll",
    ]) {
      expect(reducedMotionCss).toContain(`.${primitive}`);
    }
  });
});
