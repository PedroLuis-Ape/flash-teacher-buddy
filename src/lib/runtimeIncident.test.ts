import { describe, expect, it } from "vitest";
import { createTechnicalIncident } from "./runtimeIncident";

describe("technical incident metadata", () => {
  it("keeps error details out of the persisted incident shape", () => {
    const incident = createTechnicalIncident(new Error("private token must not persist"), "\n in ImportScreen");

    expect(incident.id).toMatch(/^APE-/);
    expect(incident.route).not.toContain("?");
    expect(incident.errorName).toBe("Error");
    expect(incident.domain).toBe("ImportScreen");
    expect(incident).not.toHaveProperty("message");
    expect(incident).not.toHaveProperty("stack");
  });
});
