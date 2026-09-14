import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(new URL("../Index.tsx", import.meta.url), "utf8");
const librarySource = readFileSync(
  new URL("../../features/library/FoldersOptimized.tsx", import.meta.url),
  "utf8",
);
const libraryResponsiveCss = readFileSync(
  new URL("../../styles/library-responsive.css", import.meta.url),
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

  it("keeps folder grid cards full width instead of squeezing them between desktop actions", () => {
    expect(libraryResponsiveCss).toContain("display: block;");
    expect(libraryResponsiveCss).toContain('button[title="Ações da pasta"]');
    expect(libraryResponsiveCss).toContain('button:not([title="Ações da pasta"])');
    expect(libraryResponsiveCss).toContain("display: none !important;");
    expect(libraryResponsiveCss).toContain("display: inline-flex !important;");
    expect(libraryResponsiveCss).toContain("width: 100%;");
  });

  it("keeps grid cards reachable without a pointer", () => {
    expect(folderSource).toContain('role="button"');
    expect(folderSource).toContain("tabIndex={0}");
    expect(folderSource).toContain("event.key === \"Enter\"");
    expect(folderSource).toContain("event.key === \" \"");
  });
});
