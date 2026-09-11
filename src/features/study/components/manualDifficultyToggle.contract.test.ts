import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./StudyToolsMenu.tsx", import.meta.url), "utf8");
const study = readFileSync(new URL("../../../pages/Study.tsx", import.meta.url), "utf8");

describe("manual in-game difficulty toggle", () => {
  it("exposes an independent reinforcement action in the shared card tools", () => {
    expect(source).toContain("onToggleDifficulty?: () => void");
    expect(source).toContain("Marcar como difícil");
    expect(source).not.toContain("!isFavorite) onToggleDifficulty");
  });

  it("uses the existing persistent reinforcement mutation", () => {
    expect(study).toContain("onToggleDifficulty={userId && canToggleReinforcement ? handleToggleReinforcement : undefined}");
    expect(study).toContain("difficultyPending={reinforcementMutation.isPending}");
  });
});