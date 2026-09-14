import { describe, expect, it } from "vitest";
import {
  FOLDER_REFERENCE_ID_PATTERN,
  LIST_REFERENCE_ID_PATTERN,
  referenceIdKind,
  referenceSelector,
} from "../domain/referenceIds";

describe("Piteco reference id contract", () => {
  it("accepts the human-readable folder/list formats and rejects lookalikes", () => {
    expect(FOLDER_REFERENCE_ID_PATTERN.test("F-K7M2Q9")).toBe(true);
    expect(LIST_REFERENCE_ID_PATTERN.test("L-7M2Q9K")).toBe(true);
    expect(referenceIdKind("F-K7M2Q9")).toBe("folder");
    expect(referenceIdKind("L-7M2Q9K")).toBe("list");
    expect(referenceIdKind("F-000000")).toBeNull();
    expect(referenceIdKind("L-INVALID")).toBeNull();
  });

  it("normalizes a reference selector without treating it as authorization", () => {
    expect(referenceSelector(" l-7m2q9k ")).toEqual({ kind: "list", referenceId: "L-7M2Q9K" });
    expect(() => referenceSelector("not-an-id")).toThrowError(/referência/i);
  });
});
