import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("flashcard editor persistence contract", () => {
  it("requires an authoritative row confirmation in list and study editors", () => {
    for (const path of ["src/pages/ListDetail.tsx", "src/pages/Study.tsx"]) {
      const source = read(path);
      expect(source).toContain('.select("id")');
      expect(source).toContain("if (!updatedCard?.id)");
    }
  });
});
