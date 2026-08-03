import { beforeEach, describe, expect, it } from "vitest";
import {
  clearStudyResumePointerForSession,
  markStudySessionCompleted,
  readStudyResumePointer,
  writeStudyResumePointer,
} from "./studyResumePointer";
import { DEFAULT_STUDY_SETTINGS_SNAPSHOT } from "./studySettingsSnapshotV2";

const base = {
  userId: "user-1",
  sessionId: "session-1",
  resourceKind: "list" as const,
  resourceId: "list-1",
  gameMode: "write",
  institutionId: null,
  path: "/list/list-1/study?mode=write",
  settingsSummary: { ...DEFAULT_STUDY_SETTINGS_SNAPSHOT, writeActivityMode: "rewrite" as const },
  currentIndex: 7,
  currentCardId: "card-9",
  layerIndex: 2,
};

function createStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
  };
}

let storage = createStorage();

describe("study resume pointer v2", () => {
  beforeEach(() => { storage = createStorage(); });

  it("guarda a sessão exata com card, camada e configurações", () => {
    writeStudyResumePointer(base, storage);
    const read = readStudyResumePointer("user-1", storage);
    expect(read).toMatchObject({
      sessionId: "session-1",
      currentIndex: 7,
      currentCardId: "card-9",
      layerIndex: 2,
    });
    expect(read?.settingsSummary.writeActivityMode).toBe("rewrite");
  });

  it("recusa paths inseguros", () => {
    expect(writeStudyResumePointer({ ...base, path: "https://evil.test" }, storage)).toBeNull();
  });

  it("desaparece quando a sessão apontada foi concluída", () => {
    writeStudyResumePointer(base, storage);
    markStudySessionCompleted("user-1", "session-1", storage);
    expect(readStudyResumePointer("user-1", storage)).toBeNull();
  });

  it("limpa apenas o ponteiro da própria sessão", () => {
    writeStudyResumePointer(base, storage);
    expect(clearStudyResumePointerForSession("user-1", "outra-sessao", storage)).toBe(false);
    expect(readStudyResumePointer("user-1", storage)).not.toBeNull();
    expect(clearStudyResumePointerForSession("user-1", "session-1", storage)).toBe(true);
    expect(readStudyResumePointer("user-1", storage)).toBeNull();
  });

  it("não vaza o ponteiro para outro usuário", () => {
    writeStudyResumePointer(base, storage);
    expect(readStudyResumePointer("user-2", storage)).toBeNull();
  });
});
