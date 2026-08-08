import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./WriteActivitySettings.tsx", import.meta.url),
  "utf8",
);

describe("write activity settings", () => {
  it("keeps write activity controls available in adaptive mixed mode", () => {
    expect(source).toContain('mode !== "write" && mode !== "mixed"');
    expect(source).toContain("useWriteStudyPreferences");
  });
});
