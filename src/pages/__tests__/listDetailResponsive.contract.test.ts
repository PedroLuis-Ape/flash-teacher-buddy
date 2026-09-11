import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../ListDetail.tsx", import.meta.url), "utf8");

describe("ListDetail responsive visual contract", () => {
  it("keeps the list shell and actions safe on narrow screens", () => {
    expect(source).toContain("ape-content-safe-bottom");
    expect(source).toContain("ape-action-cluster");
    expect(source).toContain('aria-label="Mais ações da lista"');
    expect(source).toContain("touch-manipulation");
  });

  it("gives settings and export dialogs a bounded scroll owner", () => {
    expect(source).toContain("max-h-[min(90dvh,calc(100svh-1rem))]");
    expect(source).toContain("min-h-0 flex-1 overflow-y-auto");
    expect(source).toContain("ape-overlay-scroll");
  });
});
