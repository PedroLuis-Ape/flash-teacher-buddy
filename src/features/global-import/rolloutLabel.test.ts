import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const screen = readFileSync(new URL("./SuperGlobalImportScreen.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./superImportTestRollout.css", import.meta.url), "utf8");

describe("Super Importador rollout label", () => {
  it("marks the guided flow as a test rollout", () => {
    expect(screen).toContain('data-super-import-test-rollout="true"');
    expect(styles).toContain('content: "Rollout de teste"');
    expect(styles).not.toContain("proprietário");
  });
});
