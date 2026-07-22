import { describe, expect, it } from "vitest";
import { classGlossaryStorageFolderId } from "./classGlossary";

describe("classGlossaryStorageFolderId", () => {
  it("creates a stable private storage id from the class id", () => {
    expect(classGlossaryStorageFolderId("00000000-0000-0000-0000-000000000001"))
      .toBe("a5c1f09e-7b2d-4a8c-9e3f-16b405d27c80");
  });

  it("keeps different classes isolated", () => {
    const first = classGlossaryStorageFolderId("00000000-0000-0000-0000-000000000001");
    const second = classGlossaryStorageFolderId("123e4567-e89b-12d3-a456-426614174000");

    expect(second).toBe("b7ffb5f9-93b6-585f-3a69-54d211c53c81");
    expect(second).not.toBe(first);
  });

  it("rejects an invalid class id before querying storage", () => {
    expect(() => classGlossaryStorageFolderId("not-a-class-id"))
      .toThrow("ID da turma inválido para o glossário.");
  });
});
