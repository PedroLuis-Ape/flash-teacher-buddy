import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./WriteStudyView.tsx", import.meta.url), "utf8");

describe("write mode stability", () => {
  it("guards duplicate submit and navigation events", () => {
    expect(source).toContain("submitLockedRef");
    expect(source).toContain("navigationLockedRef");
    expect(source).toContain("onKeyDownCapture");
    expect(source).toContain("event.stopPropagation()");
  });
});
