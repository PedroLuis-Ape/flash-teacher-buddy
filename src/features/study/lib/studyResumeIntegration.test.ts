import { describe, expect, it, vi } from "vitest";
import {
  RESUME_SESSION_PARAM,
  buildStudyPathFromRemoteSession,
  buildStudyResumeRoute,
  parseRequestedResumeSessionId,
} from "./studyResumeRoute";
import {
  deriveStudyResumeProgress,
  resumableFromPointer,
  resumableFromRemoteSession,
} from "./resumableStudySession";
import { fetchRequestedStudySession } from "./requestedStudySession";
import { DEFAULT_STUDY_SETTINGS_SNAPSHOT } from "./studySettingsSnapshotV2";
import type { StudyResumeSnapshotV2 } from "./studyResumePointer";

const SESSION_ID = "11111111-2222-3333-4444-555555555555";

const pointer: StudyResumeSnapshotV2 = {
  version: 2,
  userId: "user-1",
  sessionId: SESSION_ID,
  resourceKind: "list",
  resourceId: "list-1",
  gameMode: "write",
  institutionId: null,
  path: "/list/list-1/study?mode=write&favorites=true",
  settingsSummary: { ...DEFAULT_STUDY_SETTINGS_SNAPSHOT, scope: "favorites", writeActivityMode: "rewrite" },
  currentIndex: 13,
  currentCardId: "card-13",
  layerIndex: 2,
  updatedAt: Date.now(),
};

describe("buildStudyResumeRoute", () => {
  it("inclui resume_session e nunca navega para o hub de jogos", () => {
    const route = buildStudyResumeRoute({ path: pointer.path, sessionId: SESSION_ID })!;
    expect(route).toContain(`${RESUME_SESSION_PARAM}=${SESSION_ID}`);
    expect(route.startsWith("/list/list-1/study")).toBe(true);
    expect(route).not.toContain("/games");
    expect(route).toContain("mode=write");
    expect(route).toContain("favorites=true");
  });

  it("recusa paths inseguros e sessionId inválida", () => {
    expect(buildStudyResumeRoute({ path: "https://evil.test", sessionId: SESSION_ID })).toBeNull();
    expect(buildStudyResumeRoute({ path: pointer.path, sessionId: "x" })).toBeNull();
  });

  it("lê a sessão pedida da query string", () => {
    expect(parseRequestedResumeSessionId(`?mode=write&${RESUME_SESSION_PARAM}=${SESSION_ID}`)).toBe(SESSION_ID);
    expect(parseRequestedResumeSessionId("?mode=write")).toBeNull();
  });

  it("reconstrói o path a partir da sessão remota", () => {
    const path = buildStudyPathFromRemoteSession({
      listId: "list-9",
      mode: "write",
      settings: { ...DEFAULT_STUDY_SETTINGS_SNAPSHOT, scope: "favorites", direction: "b-a", order: "sequential" },
    })!;
    expect(path).toBe("/list/list-9/study?mode=write&dir=b-a&order=sequential&favorites=true");
  });
});

describe("modelo único de retomada", () => {
  it("usa o ponteiro v2 como fonte da sessão exata", () => {
    const resume = resumableFromPointer(pointer, { title: "Avançado 003", totalCards: 100, progressCount: 14 });
    expect(resume).toMatchObject({
      source: "local-pointer",
      sessionId: SESSION_ID,
      currentCardId: "card-13",
      layerIndex: 2,
      totalCards: 100,
      progressCount: 14,
    });
    expect(resume.settings.scope).toBe("favorites");
    expect(resume.settings.writeActivityMode).toBe("rewrite");
  });

  it("reconstrói a retomada a partir da sessão remota aberta", () => {
    const resume = resumableFromRemoteSession({
      id: SESSION_ID,
      list_id: "list-1",
      mode: "write",
      current_index: 5,
      cards_order: ["a", "b", "c"],
      settings_snapshot: { version: 1, subset: "favorites", direction: "b-a" },
      session_snapshot: { version: 2, results: [{ flashcardId: "a" }, { flashcardId: "b" }] },
      updated_at: "2026-08-01T10:00:00.000Z",
      completed: false,
      lists: { title: "Avançado 003", institution_id: null },
    })!;
    expect(resume.source).toBe("remote-session");
    expect(resume.path).toContain("favorites=true");
    expect(resume.settings.scope).toBe("favorites");
    expect(resume.title).toBe("Avançado 003");
  });

  it("recusa sessão concluída", () => {
    expect(resumableFromRemoteSession({ id: SESSION_ID, list_id: "l", mode: "write", completed: true })).toBeNull();
  });

  it("conta dominados no gamificado e respondidos no extenso", () => {
    expect(deriveStudyResumeProgress({
      sessionSnapshot: { version: 2, masteredIds: ["a", "b"], totalEligible: 100 },
    })).toEqual({ progressCount: 2, totalCards: 100, progressUnit: "dominados" });

    expect(deriveStudyResumeProgress({
      sessionSnapshot: { results: [{ flashcardId: "a" }, { flashcardId: "a" }] },
      cardsOrder: ["a", "b", "c"],
      currentIndex: 9,
    })).toEqual({ progressCount: 1, totalCards: 3, progressUnit: "respondidos" });
  });
});

function createClient(row: unknown) {
  const calls: Array<[string, unknown]> = [];
  const query: any = {
    select: () => query,
    eq: (column: string, value: unknown) => { calls.push([column, value]); return query; },
    abortSignal: () => query,
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
  };
  return { client: { from: vi.fn(() => query) }, calls };
}

describe("consulta direta da sessão pedida", () => {
  it("filtra por id, usuário, lista, modo e completed=false", async () => {
    const { client, calls } = createClient({ id: SESSION_ID });
    const row = await fetchRequestedStudySession({
      client: client as any,
      sessionId: SESSION_ID,
      userId: "user-1",
      listId: "list-1",
      mode: "write",
    });
    expect(row).toEqual({ id: SESSION_ID });
    expect(calls).toEqual([
      ["id", SESSION_ID],
      ["user_id", "user-1"],
      ["list_id", "list-1"],
      ["mode", "write"],
      ["completed", false],
    ]);
  });

  it("devolve null quando a sessão não existe — sem abrir outra aleatoriamente", async () => {
    const { client } = createClient(null);
    await expect(fetchRequestedStudySession({
      client: client as any,
      sessionId: SESSION_ID,
      userId: "user-1",
      listId: "list-1",
      mode: "write",
    })).resolves.toBeNull();
  });

  it("não consulta nada sem sessionId", async () => {
    const { client } = createClient({ id: SESSION_ID });
    await expect(fetchRequestedStudySession({
      client: client as any,
      sessionId: null,
      userId: "user-1",
      listId: "list-1",
      mode: "write",
    })).resolves.toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });
});
