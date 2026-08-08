import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("study flow mode transition contract", () => {
  it("allows the active surface to close the old journey before the preference changes", () => {
    const settings = read("src/features/study/components/GameSettingsModal.impl.tsx");
    const study = read("src/pages/Study.tsx");
    const mixed = read("src/pages/MixedStudy.tsx");

    expect(settings).toContain("await onFlowModeChange?.(next)");
    expect(study).toContain("await discardSession();");
    expect(mixed).toContain("A sessão anterior do Misto não foi confirmada pelo banco");
    expect(mixed).toContain("mixed.clearPersistedJourney();");
  });
});
