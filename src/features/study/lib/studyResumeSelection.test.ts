import { describe, expect, it } from "vitest";
import {
  STUDY_RESUME_RECENCY_TOLERANCE_MS,
  selectLatestStudyResume,
} from "./studyResumeSelection";
import type { ResumableStudySession } from "./resumableStudySession";
import { DEFAULT_STUDY_SETTINGS_SNAPSHOT } from "./studySettingsSnapshotV3";

function session(input: {
  sessionId: string;
  resourceId?: string;
  title?: string;
  updatedAt: number;
  institutionId?: string | null;
  source?: ResumableStudySession["source"];
  lastActivityAt?: number | null;
  activityRevision?: number;
  completed?: boolean;
}): ResumableStudySession {
  const resourceId = input.resourceId ?? input.sessionId;
  return {
    sessionId: input.sessionId,
    resourceKind: "list",
    resourceId,
    title: input.title ?? resourceId,
    gameMode: "flip",
    path: `/list/${resourceId}/study?mode=flip`,
    currentIndex: 0,
    totalCards: 10,
    progressCount: 0,
    progressUnit: "respondidos",
    currentCardId: null,
    layerIndex: null,
    settings: DEFAULT_STUDY_SETTINGS_SNAPSHOT,
    institutionId: input.institutionId ?? null,
    updatedAt: input.updatedAt,
    source: input.source ?? "remote-session",
    lastActivityAt: input.lastActivityAt ?? null,
    activityRevision: input.activityRevision ?? 0,
    completed: input.completed === true,
  };
}

describe("seleção da sessão de retomada da Home", () => {
  it("escolhe a lista mais recente mesmo quando o ponteiro do aparelho aponta para outra lista", () => {
    const pointer = session({ sessionId: "s-a", resourceId: "lista-a", title: "Verbos frasais", updatedAt: 1_000, source: "local-pointer" });
    const remote = [session({ sessionId: "s-b", resourceId: "lista-b", title: "Business English", updatedAt: 60_000 })];

    expect(selectLatestStudyResume({ pointer, remote, institutionId: null })?.sessionId).toBe("s-b");
  });

  it("não regride para uma lista antiga quando a sessão do aparelho é a mais recente", () => {
    const pointer = session({ sessionId: "s-b", resourceId: "lista-b", updatedAt: 90_000, source: "local-pointer" });
    const remote = [session({ sessionId: "s-a", resourceId: "lista-a", updatedAt: 60_000 })];

    expect(selectLatestStudyResume({ pointer, remote, institutionId: null })?.sessionId).toBe("s-b");
  });

  it("empate fica com o ponteiro (identidade exata do aparelho)", () => {
    const pointer = session({ sessionId: "s-a", updatedAt: 5_000, source: "local-pointer" });
    const remote = [session({ sessionId: "s-b", updatedAt: 5_000 })];

    expect(selectLatestStudyResume({ pointer, remote, institutionId: null })?.sessionId).toBe("s-a");
  });

  it("absorve diferença pequena de relógio entre aparelho e servidor", () => {
    const pointer = session({ sessionId: "s-a", updatedAt: 5_000, source: "local-pointer" });
    const remote = [session({ sessionId: "s-b", updatedAt: 5_000 + STUDY_RESUME_RECENCY_TOLERANCE_MS - 1 })];
    expect(selectLatestStudyResume({ pointer, remote, institutionId: null })?.sessionId).toBe("s-a");

    const clearlyNewer = [session({ sessionId: "s-c", updatedAt: 5_000 + STUDY_RESUME_RECENCY_TOLERANCE_MS + 1 })];
    expect(selectLatestStudyResume({ pointer, remote: clearlyNewer, institutionId: null })?.sessionId).toBe("s-c");
  });

  it("só disputa sessões do escopo de instituição selecionado", () => {
    const pointer = session({ sessionId: "s-a", updatedAt: 1_000, institutionId: "inst-1", source: "local-pointer" });
    const remote = [
      session({ sessionId: "s-outra-inst", updatedAt: 90_000, institutionId: "inst-2" }),
      session({ sessionId: "s-geral", updatedAt: 50_000, institutionId: null }),
    ];

    expect(selectLatestStudyResume({ pointer, remote, institutionId: "inst-1" })?.sessionId).toBe("s-a");
    expect(selectLatestStudyResume({ pointer, remote, institutionId: null })?.sessionId).toBe("s-geral");
  });

  it("sem candidatos devolve null (fallback da Home preservado)", () => {
    expect(selectLatestStudyResume({ pointer: null, remote: [], institutionId: null })).toBeNull();
    expect(selectLatestStudyResume({ pointer: null, remote: null, institutionId: null })).toBeNull();
  });
});
