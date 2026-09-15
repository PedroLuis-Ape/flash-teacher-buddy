/**
 * Contrato P0 (2026-09-15): "Voltar para onde parou" segue a ÚLTIMA INTERAÇÃO
 * REAL do usuário, nunca `updated_at` técnico e nunca uma sessão velha ainda
 * aberta.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { selectStudyResumeByActivity } from "./studyResumeSelection";
import { buildStudySessionActivityParams } from "./studySessionActivity";
import { resumableFromRemoteSession, type RemoteStudySessionRow } from "./resumableStudySession";
import type { ResumableStudySession } from "./resumableStudySession";
import { DEFAULT_STUDY_SETTINGS_SNAPSHOT } from "./studySettingsSnapshotV3";

const T0 = Date.UTC(2026, 8, 15, 12, 0, 0);

function session(input: {
  id: string;
  resourceId?: string;
  updatedAt: number;
  lastActivityAt?: number | null;
  completed?: boolean;
  source?: ResumableStudySession["source"];
  currentIndex?: number;
  currentCardId?: string | null;
  layerIndex?: number | null;
}): ResumableStudySession {
  const resourceId = input.resourceId ?? input.id;
  return {
    sessionId: input.id,
    resourceKind: "list",
    resourceId,
    title: resourceId,
    gameMode: "flip",
    path: `/list/${resourceId}/study?mode=flip`,
    currentIndex: input.currentIndex ?? 0,
    totalCards: 20,
    progressCount: input.currentIndex ?? 0,
    progressUnit: "respondidos",
    currentCardId: input.currentCardId ?? null,
    layerIndex: input.layerIndex ?? null,
    settings: DEFAULT_STUDY_SETTINGS_SNAPSHOT,
    institutionId: null,
    updatedAt: input.updatedAt,
    source: input.source ?? "remote-session",
    lastActivityAt: input.lastActivityAt === undefined ? null : input.lastActivityAt,
    activityRevision: input.lastActivityAt ? input.lastActivityAt : 0,
    completed: input.completed === true,
  };
}

const pick = (remote: ResumableStudySession[], pointer: ResumableStudySession | null = null) =>
  selectStudyResumeByActivity({ pointer, remote, institutionId: null });

describe("retomada pela última interação real", () => {
  it("1. persist/outbox tardio que muda updated_at de A não devolve o card para A", () => {
    const a = session({ id: "s-a", updatedAt: T0 + 60_000, lastActivityAt: T0 });
    const b = session({ id: "s-b", updatedAt: T0 + 10_000, lastActivityAt: T0 + 30_000 });
    expect(pick([a, b]).resume?.sessionId).toBe("s-b");
  });

  it("2. A -> B -> C sempre devolve a última interação real", () => {
    const a = session({ id: "s-a", updatedAt: T0 + 90_000, lastActivityAt: T0 });
    const b = session({ id: "s-b", updatedAt: T0 + 90_000, lastActivityAt: T0 + 10_000 });
    const c = session({ id: "s-c", updatedAt: T0, lastActivityAt: T0 + 20_000 });
    expect(pick([a, b, c]).resume?.sessionId).toBe("s-c");
  });

  it("3. B concluída depois de ser a última atividade não ressuscita A antiga", () => {
    const a = session({ id: "s-a", updatedAt: T0 + 99_000, lastActivityAt: T0 });
    const b = session({ id: "s-b", updatedAt: T0 + 10_000, lastActivityAt: T0 + 30_000, completed: true });
    const selection = pick([a, b]);
    expect(selection.resume).toBeNull();
    expect(selection.latestActivity?.sessionId).toBe("s-b");
  });

  it("4. atividade posterior em C assume normalmente depois da conclusão de B", () => {
    const a = session({ id: "s-a", updatedAt: T0 + 99_000, lastActivityAt: T0 });
    const b = session({ id: "s-b", updatedAt: T0 + 10_000, lastActivityAt: T0 + 30_000, completed: true });
    const c = session({ id: "s-c", updatedAt: T0, lastActivityAt: T0 + 40_000 });
    expect(pick([a, b, c]).resume?.sessionId).toBe("s-c");
  });

  it("5. ponteiro local mais novo responde antes do touch remoto terminar", () => {
    const remoteB = session({ id: "s-b", updatedAt: T0, lastActivityAt: T0 + 10_000, currentIndex: 3 });
    const pointer = session({
      id: "s-b",
      updatedAt: T0 + 20_000,
      lastActivityAt: T0 + 20_000,
      currentIndex: 7,
      currentCardId: "card-7",
      layerIndex: 2,
      source: "local-pointer",
    });
    const resume = pick([remoteB], pointer).resume;
    expect(resume?.sessionId).toBe("s-b");
    expect(resume?.currentIndex).toBe(7);
    expect(resume?.currentCardId).toBe("card-7");
    expect(resume?.layerIndex).toBe(2);
  });

  it("5b. ponteiro local não pode retomar sessão já concluída no servidor", () => {
    const remoteB = session({ id: "s-b", updatedAt: T0, lastActivityAt: T0 + 10_000, completed: true });
    const pointer = session({ id: "s-b", updatedAt: T0 + 20_000, lastActivityAt: T0 + 20_000, source: "local-pointer" });
    expect(pick([remoteB], pointer).resume).toBeNull();
  });

  it("6. outro dispositivo sem localStorage recebe a mesma sessão/card pelo servidor", () => {
    const row: RemoteStudySessionRow = {
      id: "s-b",
      list_id: "lista-b",
      collection_id: null,
      mode: "flip",
      current_index: 1,
      total_cards: 20,
      settings: null,
      institution_id: null,
      updated_at: new Date(T0).toISOString(),
      completed: false,
      last_activity_at: new Date(T0 + 30_000).toISOString(),
      last_activity_revision: T0 + 30_000,
      last_activity_card_id: "card-9",
      last_activity_index: 9,
      last_activity_layer_index: 1,
    } as unknown as RemoteStudySessionRow;
    const remote = resumableFromRemoteSession(row, { titles: { "lista-b": "Lista B" } } as never);
    expect(remote?.currentIndex).toBe(9);
    expect(remote?.currentCardId).toBe("card-9");
    expect(remote?.layerIndex).toBe(1);
    expect(pick([remote as ResumableStudySession]).resume?.sessionId).toBe("s-b");
  });

  it("7. lista combinada retoma a lista/sessão jogada, não a lista canônica do card", () => {
    const embedded = session({ id: "s-emb", resourceId: "lista-combinada", updatedAt: T0, lastActivityAt: T0 + 5_000 });
    const canonical = session({ id: "s-orig", resourceId: "lista-original", updatedAt: T0 + 60_000, lastActivityAt: T0 });
    const resume = pick([embedded, canonical]).resume;
    expect(resume?.resourceId).toBe("lista-combinada");
    expect(resume?.path).toContain("/list/lista-combinada/study");
  });

  it("8. retry/sync de snapshot antigo não muda a atividade (revisão inválida é rejeitada)", () => {
    expect(buildStudySessionActivityParams({ sessionId: "não-uuid", revision: T0 })).toBeNull();
    expect(buildStudySessionActivityParams({ sessionId: "11111111-2222-3333-4444-555555555555", revision: 0 })).toBeNull();
    const params = buildStudySessionActivityParams({
      sessionId: "11111111-2222-3333-4444-555555555555",
      revision: T0,
      cardId: "22222222-3333-4444-5555-666666666666",
      cardIndex: 4,
      layerIndex: 1,
    });
    expect(params).toMatchObject({ p_revision: T0, p_card_index: 4, p_layer_index: 1 });
  });

  it("compatibilidade: usuário sem nenhuma atividade rastreada mantém o caminho legado", () => {
    const legacy = session({ id: "s-legacy", updatedAt: T0 + 1_000, lastActivityAt: null });
    const selection = pick([legacy]);
    expect(selection.contract).toBe("legacy");
    expect(selection.resume?.sessionId).toBe("s-legacy");
  });

  it("compatibilidade: com atividade rastreada, sessão legada por updated_at não vence", () => {
    const legacy = session({ id: "s-legacy", updatedAt: T0 + 999_000, lastActivityAt: null });
    const tracked = session({ id: "s-new", updatedAt: T0, lastActivityAt: T0 + 1_000 });
    const selection = pick([legacy, tracked]);
    expect(selection.contract).toBe("activity");
    expect(selection.resume?.sessionId).toBe("s-new");
  });

  it("10. o hook real da Home fornece o armazenamento local e o publisher marca atividade remota", () => {
    const hook = readFileSync(new URL("../../../hooks/useLatestStudyResume.ts", import.meta.url), "utf8");
    expect(hook).toContain("storage: resolveResumeStorage()");
    const publisher = readFileSync(new URL("../hooks/useStudyResumePublisher.ts", import.meta.url), "utf8");
    expect(publisher).toContain("touchStudySessionActivity");
    expect(publisher).toContain("activityRevision: revision");
  });
});
