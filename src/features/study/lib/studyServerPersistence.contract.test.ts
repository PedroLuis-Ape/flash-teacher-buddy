/**
 * Contrato servidor-canônico da persistência de estudo.
 *
 * O servidor (Supabase) é a fonte de verdade: um cliente sem nenhum storage
 * local precisa reconstruir a sessão exata a partir do banco. Estes testes
 * usam um servidor em memória que replica a semântica do delta aplicado
 * (`claim_study_session_v1`, `persist_study_session_v1`,
 * `record_flashcard_progress_v1`), incluindo:
 *  - uma única sessão aberta por (user, list, mode, session_scope_key);
 *  - compare-and-set em `client_revision` (sem last-write-wins cego);
 *  - progresso por card idempotente por `operation_id` e sempre ancorado no
 *    card original, mesmo quando o deck vem de uma lista combinada.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  claimStudySession,
  persistStudySession,
  type StudySessionClient,
} from "./studySessionRepository";
import {
  recordStudyProgressAttempt,
  type StudyProgressClient,
} from "./studyProgressRepository";

const deltaSql = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260914215300_208b1682-63b5-4a84-9d90-20f5dc733492.sql",
    import.meta.url,
  ),
  "utf8",
);
const anonRevokeSql = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260914215331_6a623a96-7afd-4325-b3db-1e503af76ba5.sql",
    import.meta.url,
  ),
  "utf8",
);

interface ServerSession {
  id: string;
  user_id: string;
  list_id: string;
  mode: string;
  session_scope_key: string;
  current_index: number;
  cards_order: unknown[];
  settings_snapshot: unknown;
  session_snapshot: unknown;
  completed: boolean;
  client_revision: number;
}

/** Card original -> lista canônica (dona do card). */
const CARD_OWNER_LIST: Record<string, string> = {
  "card-1": "list-a",
  "card-2": "list-a",
};
/** Membros de uma lista combinada: referências, nunca cópias. */
const EMBEDDED_MEMBERS: Record<string, string[]> = {
  "embedded-1": ["card-1", "card-2"],
};

function createServer() {
  const sessions: ServerSession[] = [];
  const events = new Set<string>();
  const progress = new Map<string, { correct: number; incorrect: number; list_id: string }>();
  let authUid: string | null = "user-1";
  let sequence = 0;

  function ok(data: unknown) {
    const request = Promise.resolve({ data, error: null }) as never;
    return Object.assign(request as object, { abortSignal: () => request }) as never;
  }
  function fail(message: string) {
    const request = Promise.resolve({ data: null, error: { message } }) as never;
    return Object.assign(request as object, { abortSignal: () => request }) as never;
  }

  const rpc = (name: string, args: Record<string, any>) => {
    if (!authUid) return fail("not_authenticated");

    if (name === "claim_study_session_v1") {
      const existing = sessions.find(
        (row) =>
          row.user_id === authUid &&
          row.list_id === args.p_list_id &&
          row.mode === args.p_mode &&
          row.session_scope_key === args.p_session_scope_key &&
          !row.completed,
      );
      if (existing) return ok({ created: false, session: { ...existing } });
      sequence += 1;
      const created: ServerSession = {
        id: `session-${sequence}`,
        user_id: authUid,
        list_id: args.p_list_id,
        mode: args.p_mode,
        session_scope_key: args.p_session_scope_key,
        current_index: args.p_current_index,
        cards_order: args.p_cards_order,
        settings_snapshot: args.p_settings_snapshot,
        session_snapshot: args.p_session_snapshot,
        completed: false,
        client_revision: 0,
      };
      sessions.push(created);
      return ok({ created: true, session: { ...created } });
    }

    if (name === "persist_study_session_v1") {
      const row = sessions.find((item) => item.id === args.p_session_id && item.user_id === authUid);
      if (!row) return fail("study_session_not_found");
      // Compare-and-set: uma revisão antiga nunca sobrescreve a mais nova.
      if (args.p_revision <= row.client_revision) {
        return ok({ accepted: false, revision: row.client_revision });
      }
      const payload = args.p_payload as Record<string, unknown>;
      if ("current_index" in payload) row.current_index = Number(payload.current_index);
      if ("cards_order" in payload) row.cards_order = payload.cards_order as unknown[];
      if ("session_snapshot" in payload) row.session_snapshot = payload.session_snapshot;
      if ("settings_snapshot" in payload) row.settings_snapshot = payload.settings_snapshot;
      if ("completed" in payload) row.completed = payload.completed === true;
      row.client_revision = args.p_revision;
      return ok({ accepted: true, revision: row.client_revision });
    }

    if (name === "record_flashcard_progress_v1") {
      const cardId = args.p_flashcard_id as string;
      const canonicalListId = CARD_OWNER_LIST[cardId];
      if (!canonicalListId) return fail("study_access_denied");
      const requested = args.p_list_id as string;
      const allowed =
        requested === canonicalListId ||
        (EMBEDDED_MEMBERS[requested]?.includes(cardId) ?? false);
      if (!allowed) return fail("study_access_denied");

      const eventKey = `${authUid}:${args.p_operation_id}`;
      if (events.has(eventKey)) return ok({ applied: false, duplicate: true });
      events.add(eventKey);

      const progressKey = `${authUid}:${cardId}`;
      const current = progress.get(progressKey) ?? { correct: 0, incorrect: 0, list_id: canonicalListId };
      // Progresso sempre no card original e na lista canônica dele.
      progress.set(progressKey, {
        correct: current.correct + (args.p_correct ? 1 : 0),
        incorrect: current.incorrect + (args.p_correct ? 0 : 1),
        list_id: canonicalListId,
      });
      return ok({ applied: true, duplicate: false });
    }

    return fail(`unexpected rpc ${name}`);
  };

  const client = { rpc, from: () => { throw new Error("fallback-direct-table-access"); } };

  return {
    client: client as unknown as StudySessionClient & StudyProgressClient,
    sessions,
    progress,
    signInAs(userId: string | null) { authUid = userId; },
  };
}

const scope = (listId: string, mode: string, settings: string) =>
  `study-session-v2:${listId}:${mode}:${settings}`;

async function claim(server: ReturnType<typeof createServer>, listId: string, mode: string, settings = "all") {
  return claimStudySession({
    userId: "user-1",
    listId,
    mode,
    sessionScopeKey: scope(listId, mode, settings),
    currentIndex: 0,
    cardsOrder: ["card-1", "card-2"],
    settingsSnapshot: { settings },
    sessionSnapshot: { currentIndex: 0 },
  }, server.client);
}

describe("study persistence is server-canonical", () => {
  it("mantém sessões separadas por lista e retoma A exatamente onde parou", async () => {
    const server = createServer();

    const a = await claim(server, "list-a", "write");
    await persistStudySession({
      sessionId: a.id, userId: "user-1", listId: "list-a", mode: "write", revision: 1,
      payload: { current_index: 7, cards_order: ["card-1", "card-2"], session_snapshot: { currentIndex: 7 } },
    }, server.client);

    const b = await claim(server, "list-b", "write");
    expect(b.id).not.toBe(a.id);
    await persistStudySession({
      sessionId: b.id, userId: "user-1", listId: "list-b", mode: "write", revision: 1,
      payload: { current_index: 2, cards_order: ["card-1"], session_snapshot: { currentIndex: 2 } },
    }, server.client);

    // Volta para A/write: mesma sessão, mesmo ponto.
    const backToA = await claim(server, "list-a", "write");
    expect(backToA).toEqual({ id: a.id, created: false, usedRpc: true });
    expect(server.sessions.find((row) => row.id === a.id)?.current_index).toBe(7);
    expect(server.sessions.find((row) => row.id === b.id)?.current_index).toBe(2);
  });

  it("mantém sessões separadas por modo na mesma lista", async () => {
    const server = createServer();
    const choice = await claim(server, "list-a", "multiple-choice");
    await persistStudySession({
      sessionId: choice.id, userId: "user-1", listId: "list-a", mode: "multiple-choice", revision: 1,
      payload: { current_index: 5, cards_order: ["card-1", "card-2"] },
    }, server.client);

    const write = await claim(server, "list-a", "write");
    expect(write.id).not.toBe(choice.id);

    const backToChoice = await claim(server, "list-a", "multiple-choice");
    expect(backToChoice.id).toBe(choice.id);
    expect(server.sessions.find((row) => row.id === choice.id)?.current_index).toBe(5);
    expect(server.sessions).toHaveLength(2);
  });

  it("trata configuração relevante como outro escopo, sem sobrescrever o anterior", async () => {
    const server = createServer();
    const all = await claim(server, "list-a", "write", "all");
    const favorites = await claim(server, "list-a", "write", "favorites");
    expect(favorites.id).not.toBe(all.id);
    expect(server.sessions).toHaveLength(2);
  });

  it("cliente novo sem storage local hidrata a mesma sessão do servidor (cross-device)", async () => {
    const server = createServer();
    const first = await claim(server, "list-a", "flip");
    await persistStudySession({
      sessionId: first.id, userId: "user-1", listId: "list-a", mode: "flip", revision: 4,
      payload: { current_index: 11, cards_order: ["card-1", "card-2"], session_snapshot: { currentIndex: 11 } },
    }, server.client);

    // Segundo aparelho: nenhum storage local é consultado, só o servidor.
    const second = await claim(server, "list-a", "flip");
    expect(second).toEqual({ id: first.id, created: false, usedRpc: true });
    const row = server.sessions.find((item) => item.id === first.id);
    expect(row?.current_index).toBe(11);
    expect(row?.session_snapshot).toEqual({ currentIndex: 11 });
  });

  it("revisão antiga não regride o avanço mais novo", async () => {
    const server = createServer();
    const session = await claim(server, "list-a", "write");

    const newer = await persistStudySession({
      sessionId: session.id, userId: "user-1", listId: "list-a", mode: "write", revision: 9,
      payload: { current_index: 20, cards_order: ["card-1", "card-2"] },
    }, server.client);
    expect(newer.accepted).toBe(true);

    const stale = await persistStudySession({
      sessionId: session.id, userId: "user-1", listId: "list-a", mode: "write", revision: 3,
      payload: { current_index: 1, cards_order: ["card-1"] },
    }, server.client);
    expect(stale.accepted).toBe(false);
    expect(stale.revision).toBe(9);
    expect(server.sessions[0].current_index).toBe(20);
  });

  it("progresso por card é idempotente por operação", async () => {
    const server = createServer();
    const first = await recordStudyProgressAttempt({
      userId: "user-1", flashcardId: "card-1", listId: "list-a", correct: true, operationId: "op-1",
    }, server.client);
    const replay = await recordStudyProgressAttempt({
      userId: "user-1", flashcardId: "card-1", listId: "list-a", correct: true, operationId: "op-1",
    }, server.client);

    expect(first).toMatchObject({ applied: true, duplicate: false, usedRpc: true });
    expect(replay).toMatchObject({ applied: false, duplicate: true });
    expect(server.progress.get("user-1:card-1")).toEqual({ correct: 1, incorrect: 0, list_id: "list-a" });
  });

  it("lista combinada grava progresso no card original, sem duplicar por lista", async () => {
    const server = createServer();
    await recordStudyProgressAttempt({
      userId: "user-1", flashcardId: "card-1", listId: "embedded-1", correct: true, operationId: "op-embedded",
    }, server.client);

    expect(server.progress.size).toBe(1);
    expect(server.progress.get("user-1:card-1")).toEqual({ correct: 1, incorrect: 0, list_id: "list-a" });
  });

  it("recusa card que não pertence à lista informada", async () => {
    const server = createServer();
    await expect(recordStudyProgressAttempt({
      userId: "user-1", flashcardId: "card-1", listId: "list-b", correct: true, operationId: "op-x",
    }, server.client)).rejects.toBeTruthy();
  });

  it("sem sessão autenticada o servidor recusa e nada é gravado", async () => {
    const server = createServer();
    server.signInAs(null);
    await expect(claim(server, "list-a", "write")).rejects.toBeTruthy();
    expect(server.sessions).toHaveLength(0);
  });

  it("troca de conta no mesmo aparelho não reaproveita a sessão do usuário anterior", async () => {
    const server = createServer();
    const first = await claim(server, "list-a", "write");
    server.signInAs("user-2");
    const second = await claim(server, "list-a", "write");
    expect(second.id).not.toBe(first.id);
    expect(server.sessions.filter((row) => row.user_id === "user-2")).toHaveLength(1);
  });
});

describe("study persistence delta migration", () => {
  it("adiciona apenas o que faltava, de forma idempotente", () => {
    expect(deltaSql).toContain("ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1");
    expect(deltaSql).toContain("ADD COLUMN IF NOT EXISTS client_revision bigint NOT NULL DEFAULT 0");
    expect(deltaSql).toContain("CREATE TABLE IF NOT EXISTS public.study_progress_events");
    expect(deltaSql).toContain("study_sessions_mode_check_v1");
  });

  it("nunca destrói dados de usuário", () => {
    for (const forbidden of [
      "DROP TABLE",
      "TRUNCATE",
      "DELETE FROM public.study_sessions",
      "DELETE FROM public.flashcard_progress",
      "DROP COLUMN",
      "DROP SCHEMA",
    ]) {
      expect(deltaSql).not.toContain(forbidden);
    }
  });

  it("garante uma única sessão aberta por escopo lógico", () => {
    expect(deltaSql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS study_sessions_active_scope_unique_v1");
    expect(deltaSql).toContain("ON public.study_sessions(user_id, list_id, mode, session_scope_key)");
    expect(deltaSql).toContain("WHERE completed = false AND session_scope_key IS NOT NULL");
    expect(deltaSql).toContain("pg_advisory_xact_lock");
  });

  it("resolve conflito por client_revision em vez de last-write-wins", () => {
    expect(deltaSql).toContain("AND p_revision > s.client_revision");
    expect(deltaSql).toContain("'accepted', v_accepted");
  });

  it("ancora o progresso no card original e aceita lista combinada do próprio usuário", () => {
    expect(deltaSql).toContain("SELECT f.list_id INTO v_canonical_list_id");
    expect(deltaSql).toContain("public.embedded_list_cards");
    expect(deltaSql).toContain("el.owner_id = v_user_id");
    expect(deltaSql).toContain("ON CONFLICT (user_id, operation_id) DO NOTHING");
    expect(deltaSql).toContain("ON CONFLICT (user_id, flashcard_id) DO UPDATE");
  });

  it("preserva o limite de acesso de listas públicas e de turma", () => {
    expect(deltaSql).toContain("public.is_turma_owner");
    expect(deltaSql).toContain("public.is_turma_member");
    expect(deltaSql).toContain("study_access_denied");
    expect(deltaSql).toContain("not_authenticated");
  });

  it("expõe as RPCs somente para usuários autenticados", () => {
    for (const fn of [
      "public.claim_study_session_v1",
      "public.persist_study_session_v1",
      "public.record_flashcard_progress_v1",
    ]) {
      expect(deltaSql).toContain(`GRANT EXECUTE ON FUNCTION ${fn}`);
      expect(anonRevokeSql).toContain(`REVOKE EXECUTE ON FUNCTION ${fn}`);
      expect(anonRevokeSql).toContain("FROM anon");
    }
  });
});
