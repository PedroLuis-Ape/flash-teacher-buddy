import { describe, expect, it } from "vitest";
import { assertScopeAccessible, isUuid, listAccessibleScopes, PERSONAL_SCOPE, requireUuid, scopeName } from "../domain/scope";
import { INSTITUTION_A, INSTITUTION_B, USER_A, createHarness } from "./fixtures";

describe("library scope", () => {
  it("describes the personal scope and every institution the account owns", async () => {
    const { db } = createHarness();
    const scopes = await listAccessibleScopes(db);
    expect(scopes).toEqual([
      { kind: "personal", role: "owner" },
      { kind: "institution", institution_id: INSTITUTION_A, name: "Colégio Alfa", role: "owner" },
    ]);
    expect(scopes.some((scope) => scope.institution_id === INSTITUTION_B)).toBe(false);
  });

  it("accepts an owned institution and refuses a foreign one", async () => {
    const { db } = createHarness();
    await expect(assertScopeAccessible(db, PERSONAL_SCOPE)).resolves.toBeUndefined();
    await expect(
      assertScopeAccessible(db, { kind: "institution", institutionId: INSTITUTION_A }),
    ).resolves.toBeUndefined();
    await expect(
      assertScopeAccessible(db, { kind: "institution", institutionId: INSTITUTION_B }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("refuses a malformed institution id before querying", async () => {
    const { db, calls } = createHarness();
    await expect(
      assertScopeAccessible(db, { kind: "institution", institutionId: "not-a-uuid" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    expect(calls.length).toBe(0);
  });

  it("validates uuid inputs", () => {
    expect(isUuid(INSTITUTION_A)).toBe(true);
    expect(isUuid("123")).toBe(false);
    expect(requireUuid(INSTITUTION_A.toUpperCase(), "institution_id")).toBe(INSTITUTION_A);
    expect(() => requireUuid("nope", "list_id")).toThrowError(/list_id/);
  });

  it("labels scopes", () => {
    expect(scopeName(PERSONAL_SCOPE)).toBe("personal");
    expect(scopeName({ kind: "institution", institutionId: INSTITUTION_A })).toBe("institution");
  });
});
