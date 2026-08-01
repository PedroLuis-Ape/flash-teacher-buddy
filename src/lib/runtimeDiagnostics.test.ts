import { describe, expect, it } from "vitest";
import { diagnoseRuntimeConfig } from "./runtimeDiagnostics";

const expectedProject = "xrnfhhoxmmstagmelvyi";
const validInput = {
  projectId: expectedProject,
  url: `https://${expectedProject}.supabase.co`,
  publicValue: "sb_publishable_example",
};

describe("runtime diagnostics", () => {
  it("uses the safe built-in runtime when no public override exists", () => {
    const diagnostic = diagnoseRuntimeConfig({}, expectedProject);

    expect(diagnostic.status).toBe("warning");
    expect(diagnostic.code).toBe("BUILT_IN_RUNTIME");
    expect(diagnostic.message).not.toContain(expectedProject);
    expect(diagnostic.message).not.toMatch(/eyJ|sb_publishable_/);
  });

  it("rejects partial public configuration", () => {
    const diagnostic = diagnoseRuntimeConfig({ projectId: expectedProject }, expectedProject);

    expect(diagnostic.status).toBe("error");
    expect(diagnostic.code).toBe("CONFIG_INCOMPLETE");
  });

  it("rejects a project or endpoint outside the canonical runtime", () => {
    const diagnostic = diagnoseRuntimeConfig({
      ...validInput,
      projectId: "wrong-project",
      url: "https://wrong-project.supabase.co",
    }, expectedProject);

    expect(diagnostic.status).toBe("error");
    expect(diagnostic.code).toBe("CONFIG_INVALID");
    expect(diagnostic.message).not.toContain("wrong-project");
  });

  it("accepts the canonical HTTPS public runtime", () => {
    const diagnostic = diagnoseRuntimeConfig(validInput, expectedProject);

    expect(diagnostic.status).toBe("ok");
    expect(diagnostic.code).toBe("CONFIG_VALID");
    expect(diagnostic.message).not.toContain(validInput.publicValue);
  });
});
