import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const privateShell = read("src/components/layout/PrivateShell.tsx");
const home = read("src/pages/Index.tsx");
const library = read("src/features/library/FoldersOptimized.tsx");
const privateCss = read("src/styles/piteco-play-private.css");
const qaHtml = read("tools/visual-qa/private-experience.html");

describe("Piteco Play authenticated shell contract", () => {
  it("keeps one static private tree and every legacy boundary", () => {
    expect(privateShell).toContain(
      '"ape-private-shell space-ui space-ui-shell min-h-screen flex flex-col"',
    );
    expect(privateShell).toContain("<EconomyProvider>");
    expect(privateShell).toContain("<InstitutionProvider>");
    expect(privateShell).toContain("<PrivateGalaxyGate />");
    expect(privateShell).not.toContain("useVisualPreferences");
    expect(privateShell).not.toContain('visualStyle === "playful"');
  });

  it("limits page markers to dashboard and library", () => {
    expect(home).toContain("ape-private-home");
    expect(home).toContain("ape-private-home-content");
    expect(library).toContain("ape-private-library");
    expect(library).toContain("ape-private-library-content");
    expect(privateShell).toContain('isHome && "space-ui-home-route"');
  });

  it("does not change the existing remote-state contracts", () => {
    expect(home).toContain("useHomeData()");
    expect(home).toContain("useAuthUser()");
    expect(library).toContain("fetchLibrarySnapshot(userId!, institutionId)");
    expect(library).toContain("placeholderData: keepPreviousData");
    expect(library).toContain("queryClient.setQueryData<LibrarySnapshot>");
    expect(library).toContain('supabase.rpc("soft_delete_folder"');
  });

  it("keeps every style doubly scoped and additive", () => {
    expect(privateCss).toContain(
      'html[data-visual-style="playful"] .ape-private-shell',
    );
    expect(privateCss).not.toMatch(/(^|\n)\.ape-/);
    expect(privateCss).not.toContain("!important");
    expect(privateCss).not.toContain(".ape-private-shell .bg-card");
    expect(privateCss).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("preserves focus and mobile touch contracts", () => {
    expect(privateCss).toContain("outline: 3px solid");
    expect(privateCss).toContain("outline-offset: 3px");
    expect(privateCss).toContain("min-height: 44px");
  });

  it("keeps the private visual fixture local and out of production entry points", () => {
    expect(qaHtml).toContain('name="robots" content="noindex,nofollow"');
    expect(qaHtml).toContain("/src/visual-qa/private-experience.ts");
    expect(privateShell).not.toContain("private-experience.html");
    expect(home).not.toContain("private-experience.html");
    expect(library).not.toContain("private-experience.html");
  });
});
