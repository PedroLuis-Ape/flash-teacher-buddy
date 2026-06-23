import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./MultipleChoiceStudyView.impl.tsx", import.meta.url), "utf8");

describe("multiple choice navigation", () => {
  it("waits for an explicit next action", () => {
    expect(source).not.toContain("AUTO_ADVANCE_DELAY_MS");
    expect(source).not.toContain("scheduleAutoAdvance");
    expect(source).not.toContain("automaticamente em");
    expect(source).toContain('actionLabel="Próximo card"');
  });
});
