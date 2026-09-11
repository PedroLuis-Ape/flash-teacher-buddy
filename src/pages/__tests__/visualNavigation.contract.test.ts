import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(new URL("../Index.tsx", import.meta.url), "utf8");
const librarySource = readFileSync(
  new URL("../../features/library/FoldersOptimized.tsx", import.meta.url),
  "utf8",
);
const folderSource = readFileSync(new URL("../Folder.tsx", import.meta.url), "utf8");

describe("responsive home and library navigation contract", () => {
  it("keeps reinforcement visible and reserves space below fixed navigation", () => {
    expect(homeSource).toContain("ape-content-safe-bottom");
    expect(homeSource).toContain("aria-label=\"Abrir Reforço\"");
    expect(librarySource).toContain("ape-content-safe-bottom");
    expect(librarySource).toContain("ape-action-cluster");
    expect(folderSource).toContain("ape-content-safe-bottom");
    expect(folderSource).toContain("ape-action-cluster");
  });

  it("keeps the small-screen action menu contract explicit", () => {
    expect(librarySource).toContain("Ações da pasta");
    expect(librarySource).toContain("sm:hidden");
    expect(folderSource).toContain("flex-wrap");
  });
});
