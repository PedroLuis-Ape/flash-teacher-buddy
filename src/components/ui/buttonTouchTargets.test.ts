import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const buttonSource = readFileSync(new URL("./button.tsx", import.meta.url), "utf8");
const studyDeckCss = readFileSync(
  new URL("../../features/study/components/studyCardDeck.css", import.meta.url),
  "utf8",
);

describe("button touch targets", () => {
  it("enforces a minimum 44px hit area for shared buttons", () => {
    expect(buttonSource).toContain("min-h-[44px]");
    expect(buttonSource).toContain("min-w-[44px]");
    expect(buttonSource).toContain("touch-manipulation");
  });

  it("provides explicit large icon and toolbar sizes", () => {
    expect(buttonSource).toContain('iconLg: "h-12 w-12');
    expect(buttonSource).toContain('toolbar: "h-14 min-w-14');
  });

  it("keeps study audio controls large and visually distinct", () => {
    expect(studyDeckCss).toContain("button:has(.lucide-volume-2)");
    expect(studyDeckCss).toContain("width: 3rem !important");
    expect(studyDeckCss).toContain("height: 3rem !important");
    expect(studyDeckCss).toContain("width: 1.25rem !important");
    expect(studyDeckCss).toContain("border: 1px solid hsl(var(--primary) / 0.28)");
  });

  it("uses a slightly lighter but still accessible mobile size", () => {
    expect(studyDeckCss).toContain("width: 2.875rem !important");
    expect(studyDeckCss).toContain("height: 2.875rem !important");
  });
});
