import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./components/GlobalImportValidationPreview.tsx", import.meta.url),
  "utf8",
);

describe("global import validation rollout", () => {
  it("uses the controlled rollout instead of the owner email", () => {
    expect(source).toContain("isSuperImportTestRolloutEnabled");
    expect(source).toContain("const testRollout");
    expect(source).not.toContain("VITE_OWNER_EMAIL");
    expect(source).not.toContain("useAuth");
  });
});
