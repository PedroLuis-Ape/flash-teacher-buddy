import { describe, expect, it } from "vitest";
import {
  clearStudyResume,
  describeStudyResume,
  isSafeStudyResumePath,
  readStudyResume,
  studyResumeMatchesInstitution,
  studyResumeStorageKey,
  writeStudyResume,
} from "./studyResume";

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("studyResume", () => {
  it("aceita apenas rotas privadas de estudo", () => {
    expect(isSafeStudyResumePath("/list/abc-123/study?mode=flip")).toBe(true);
    expect(isSafeStudyResumePath("/collection/abc_123/study?mode=write")).toBe(true);
    expect(isSafeStudyResumePath("/portal/list/abc/study")).toBe(false);
    expect(isSafeStudyResumePath("https://example.com/list/abc/study")).toBe(false);
    expect(isSafeStudyResumePath("/auth")).toBe(false);
  });

  it("isola o snapshot por usuário e preserva a instituição", () => {
    const storage = createMemoryStorage();
    const snapshot = writeStudyResume(
      "user-a",
      "/list/list-1/study?mode=flip&favorites=true&dir=b-a",
      "institution-1",
      storage,
    );

    expect(snapshot?.institutionId).toBe("institution-1");
    expect(readStudyResume("user-a", storage)?.path).toContain("favorites=true");
    expect(readStudyResume("user-b", storage)).toBeNull();
    expect(storage.getItem(studyResumeStorageKey("user-a"))).not.toBeNull();
  });

  it("remove snapshots expirados ou inválidos", () => {
    const storage = createMemoryStorage();
    const key = studyResumeStorageKey("user-a");
    storage.setItem(key, JSON.stringify({
      version: 1,
      path: "/list/list-1/study",
      institutionId: null,
      updatedAt: 1,
    }));

    expect(readStudyResume("user-a", storage, 100 * 24 * 60 * 60 * 1000)).toBeNull();
    expect(storage.getItem(key)).toBeNull();
  });

  it("respeita o escopo da instituição e permite descarte", () => {
    const storage = createMemoryStorage();
    const snapshot = writeStudyResume("user-a", "/list/list-1/study", null, storage)!;

    expect(studyResumeMatchesInstitution(snapshot, null)).toBe(true);
    expect(studyResumeMatchesInstitution(snapshot, "institution-1")).toBe(false);

    clearStudyResume("user-a", storage);
    expect(readStudyResume("user-a", storage)).toBeNull();
  });

  it("gera uma descrição curta das configurações salvas", () => {
    expect(
      describeStudyResume("/list/list-1/study?mode=multiple-choice&favorites=true&dir=a-b"),
    ).toBe("Múltipla escolha • favoritos • Lado A → B");
  });
});
