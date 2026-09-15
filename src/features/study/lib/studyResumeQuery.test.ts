import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLatestStudyResume, type StudyResumeQueryClient } from "./studyResumeQuery";
import {
  markStudySessionCompleted,
  readStudyResumePointer,
  studyResumePointerKey,
  writeStudyResumePointer,
} from "./studyResumePointer";

const BASE = Date.parse("2026-09-13T10:00:00.000Z");
const MINUTE = 60_000;
const iso = (offsetMinutes: number) => new Date(BASE + offsetMinutes * MINUTE).toISOString();

type Row = Record<string, any>;

function sessionRow(input: {
  sessionId: string;
  listId: string;
  title: string;
  mode?: string;
  updatedOffsetMinutes: number;
  completed?: boolean;
  cards?: string[];
  answered?: number;
}): Row {
  const cards = input.cards ?? ["c1", "c2", "c3", "c4", "c5"];
  const answered = input.answered ?? 0;
  return {
    id: input.sessionId,
    user_id: "u1",
    list_id: input.listId,
    mode: input.mode ?? "flip",
    session_scope_key: `study-session-v3:${input.mode ?? "flip"}:all:continuous`,
    current_index: answered,
    cards_order: cards,
    settings_snapshot: {
      version: 1,
      mode: input.mode ?? "flip",
      subset: "all",
      order: "sequential",
      redFocus: false,
      fastMode: false,
      direction: "any",
      studyFlowMode: "continuous",
    },
    session_snapshot: { results: cards.slice(0, answered).map((flashcardId) => ({ flashcardId })) },
    updated_at: iso(input.updatedOffsetMinutes),
    completed: input.completed === true,
    lists: {
      id: input.listId,
      title: input.title,
      institution_id: null,
      deleted_at: null,
    },
  };
}

interface RecordedQuery {
  table: string;
  filters: Array<[string, unknown]>;
  limit: number | null;
  single: boolean;
}

function createClient(rows: Row[], options: { failSingle?: boolean; failList?: boolean } = {}) {
  const queries: RecordedQuery[] = [];

  function from(table: string) {
    const filters: Array<[string, unknown]> = [];
    let limit: number | null = null;
    const matches = () => rows.filter((row) =>
      filters.every(([column, value]) => (row as Record<string, unknown>)[column] === value));

    const query: any = {
      select: () => query,
      eq: (column: string, value: unknown) => { filters.push([column, value]); return query; },
      order: () => query,
      limit: (count: number) => { limit = count; return query; },
      maybeSingle: () => {
        queries.push({ table, filters: [...filters], limit, single: true });
        if (options.failSingle) return Promise.resolve({ data: null, error: { message: "network" } });
        return Promise.resolve({ data: matches()[0] ?? null, error: null });
      },
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
        queries.push({ table, filters: [...filters], limit, single: false });
        if (options.failList) {
          return Promise.resolve({ data: null, error: { message: "network" } }).then(onFulfilled, onRejected);
        }
        const found = matches();
        const data = limit === null ? found : found.slice(0, limit);
        return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
      },
    };
    return query;
  }

  return {
    client: { from } as unknown as StudyResumeQueryClient,
    queries,
  };
}

function createStorage() {
  const map = new Map<string, string>();
  return {
    map,
    get length() { return map.size; },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
  };
}

function writePointer(
  storage: ReturnType<typeof createStorage>,
  input: { userId: string; sessionId: string; resourceId: string; gameMode?: string; offsetMinutes: number; path?: string },
) {
  const written = writeStudyResumePointer({
    userId: input.userId,
    sessionId: input.sessionId,
    resourceKind: "list",
    resourceId: input.resourceId,
    gameMode: input.gameMode ?? "flip",
    institutionId: null,
    path: input.path ?? `/list/${input.resourceId}/study?mode=${input.gameMode ?? "flip"}` ,
    settingsSummary: undefined as any,
    currentIndex: 0,
    currentCardId: null,
    layerIndex: null,
  }, storage);
  if (!written) throw new Error("pointer-not-written");
  // A linha do tempo do teste é explícita: fixamos quando o ponteiro foi escrito.
  storage.setItem(studyResumePointerKey(input.userId), JSON.stringify({
    ...written,
    updatedAt: BASE + input.offsetMinutes * MINUTE,
  }));
  return readStudyResumePointer(input.userId, storage, BASE + 1000 * MINUTE)!;
}

/** Move também o relógio do aparelho: a republicação do ponteiro usa Date.now(). */
function at(minutes: number): number {
  vi.setSystemTime(BASE + minutes * MINUTE);
  return BASE + minutes * MINUTE;
}

let storage: ReturnType<typeof createStorage>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(BASE);
  storage = createStorage();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("card 'Voltar para onde parou' — última sessão real", () => {
  const listA = sessionRow({ sessionId: "s-a", listId: "lista-a", title: "Verbos frasais", updatedOffsetMinutes: 20, answered: 14, cards: Array.from({ length: 15 }, (_, index) => `a${index}`) });
  const listB = sessionRow({ sessionId: "s-b", listId: "lista-b", title: "Business English", updatedOffsetMinutes: 60, answered: 3, cards: Array.from({ length: 12 }, (_, index) => `b${index}`) });
  const listC = sessionRow({ sessionId: "s-c", listId: "lista-c", title: "Present Perfect", updatedOffsetMinutes: 120, answered: 12, cards: Array.from({ length: 20 }, (_, index) => `c${index}`) });

  it("TESTE B: estudar a lista B depois de A move o card para B e realinha o ponteiro do aparelho", async () => {
    at(30);
    writePointer(storage, { userId: "u1", sessionId: "s-a", resourceId: "lista-a", offsetMinutes: 30 });
    const { client } = createClient([listA, listB]);

    const resume = await fetchLatestStudyResume({
      userId: "u1",
      institutionId: null,
      client,
      storage,
      now: at(90),
    });

    expect(resume?.sessionId).toBe("s-b");
    expect(resume?.title).toBe("Business English");
    expect(resume?.path).toContain("/list/lista-b/study");

    const pointer = readStudyResumePointer("u1", storage, BASE + 90 * MINUTE);
    expect(pointer?.sessionId).toBe("s-b");
    expect(pointer?.resourceId).toBe("lista-b");
  });

  it("TESTE C: A → B → C mantém sempre a última lista estudada", async () => {
    at(30);
    writePointer(storage, { userId: "u1", sessionId: "s-a", resourceId: "lista-a", offsetMinutes: 30 });

    const ab = createClient([listA, listB]);
    const first = await fetchLatestStudyResume({ userId: "u1", institutionId: null, client: ab.client, storage, now: at(90) });
    expect(first?.sessionId).toBe("s-b");

    const abc = createClient([listA, listB, listC]);
    const second = await fetchLatestStudyResume({ userId: "u1", institutionId: null, client: abc.client, storage, now: at(150) });
    expect(second?.sessionId).toBe("s-c");
    expect(second?.title).toBe("Present Perfect");

    const third = await fetchLatestStudyResume({ userId: "u1", institutionId: null, client: abc.client, storage, now: at(151) });
    expect(third?.sessionId).toBe("s-c");
  });

  it("TESTE E: o destino Continuar aponta para a mesma sessão exibida no card", async () => {
    at(30);
    writePointer(storage, { userId: "u1", sessionId: "s-a", resourceId: "lista-a", offsetMinutes: 30 });
    const { client } = createClient([listA, listC]);
    const resume = await fetchLatestStudyResume({ userId: "u1", institutionId: null, client, storage, now: at(150) });
    const pointer = readStudyResumePointer("u1", storage, BASE + 150 * MINUTE);

    expect(resume).not.toBeNull();
    expect(pointer?.sessionId).toBe(resume!.sessionId);
    expect(pointer?.resourceId).toBe(resume!.resourceId);
    expect(pointer?.path).toBe(resume!.path);
  });

  it("sessão da Prática Mista também assume o card e é retomada na superfície mista", async () => {
    const mixed = sessionRow({
      sessionId: "s-mixed",
      listId: "lista-mixed",
      title: "Phrasal Verbs",
      mode: "mixed-adaptive",
      updatedOffsetMinutes: 90,
      answered: 2,
    });
    at(30);
    writePointer(storage, { userId: "u1", sessionId: "s-a", resourceId: "lista-a", offsetMinutes: 30 });
    const { client } = createClient([listA, mixed]);

    const resume = await fetchLatestStudyResume({ userId: "u1", institutionId: null, client, storage, now: at(120) });

    expect(resume?.sessionId).toBe("s-mixed");
    expect(resume?.title).toBe("Phrasal Verbs");
    expect(resume?.path).toContain("/list/lista-mixed/mixed-study");
    expect(resume?.path).toContain("mode=mixed");
    expect(resume?.path).not.toContain("mixed-adaptive");

    const pointer = readStudyResumePointer("u1", storage, BASE + 120 * MINUTE);
    expect(pointer?.sessionId).toBe("s-mixed");
    expect(pointer?.gameMode).toBe("mixed-adaptive");
    expect(pointer?.path).toContain("/list/lista-mixed/mixed-study");
  });

  it("sessão concluída não volta para o card", async () => {
    at(30);
    writePointer(storage, { userId: "u1", sessionId: "s-a", resourceId: "lista-a", offsetMinutes: 30 });
    const { client } = createClient([
      listA,
      sessionRow({ sessionId: "s-b", listId: "lista-b", title: "Business English", updatedOffsetMinutes: 60, completed: true }),
    ]);

    const resume = await fetchLatestStudyResume({ userId: "u1", institutionId: null, client, storage, now: at(90) });
    expect(resume?.sessionId).toBe("s-a");
  });

  it("marca local de conclusão também esconde a sessão até o remoto confirmar", async () => {
    at(30);
    writePointer(storage, { userId: "u1", sessionId: "s-a", resourceId: "lista-a", offsetMinutes: 30 });
    markStudySessionCompleted("u1", "s-b", storage);
    const { client } = createClient([listA, listB]);

    const resume = await fetchLatestStudyResume({ userId: "u1", institutionId: null, client, storage, now: at(90) });
    expect(resume?.sessionId).toBe("s-a");
  });

  it("sessão de outro escopo (anon) nunca vira o card do usuário logado", async () => {
    at(30);
    writePointer(storage, { userId: "anon", sessionId: "s-anon", resourceId: "lista-b", offsetMinutes: 120 });
    const { client } = createClient([listA]);

    const resume = await fetchLatestStudyResume({ userId: "u1", institutionId: null, client, storage, now: at(150) });

    expect(resume?.sessionId).toBe("s-a");
    // O escopo visitante não é consumido nem sobrescrito pela sessão do usuário.
    expect(storage.getItem(studyResumePointerKey("anon"))).not.toBeNull();
    expect(readStudyResumePointer("u1", storage, BASE + 150 * MINUTE)?.sessionId ?? "s-a").toBe("s-a");
  });

  it("título, progresso e destino sempre pertencem à mesma lista", async () => {
    at(150);
    const { client } = createClient([listC]);
    const resume = await fetchLatestStudyResume({ userId: "u1", institutionId: null, client, storage, now: at(150) });

    expect(resume).toMatchObject({
      sessionId: "s-c",
      resourceId: "lista-c",
      title: "Present Perfect",
      progressCount: 12,
      totalCards: 20,
      progressUnit: "respondidos",
    });
    expect(resume?.path).toContain("/list/lista-c/study");
  });

  it("TESTE H: usuário sem sessão anterior continua sem card, sem erro", async () => {
    const { client } = createClient([]);
    await expect(fetchLatestStudyResume({ userId: "u1", institutionId: null, client, storage, now: at(0) })).resolves.toBeNull();
  });

  it("consulta sempre no escopo do usuário autenticado", async () => {
    at(30);
    writePointer(storage, { userId: "u1", sessionId: "s-a", resourceId: "lista-a", offsetMinutes: 30 });
    const { client, queries } = createClient([listA, listB]);
    await fetchLatestStudyResume({ userId: "u1", institutionId: null, client, storage, now: at(90) });

    // ponteiro + atividade real + fallback legado
    expect(queries.length).toBe(3);
    for (const query of queries) {
      expect(query.table).toBe("study_sessions");
      expect(query.filters).toContainEqual(["user_id", "u1"]);
    }
    // A consulta de atividade real NÃO pode filtrar `completed`: uma sessão
    // concluída pode ser a última atividade e nesse caso o card fica vazio.
    expect(queries.filter((query) => query.filters.some(([column]) => column === "completed")).length).toBe(2);
  });

  it("degrada sem mentir: falha na lista remota mantém a sessão do aparelho", async () => {
    at(30);
    writePointer(storage, { userId: "u1", sessionId: "s-a", resourceId: "lista-a", offsetMinutes: 30 });
    const { client } = createClient([listA, listB], { failList: true });

    const resume = await fetchLatestStudyResume({ userId: "u1", institutionId: null, client, storage, now: at(90) });
    expect(resume?.sessionId).toBe("s-a");
  });

  it("degrada sem mentir: falha ao validar o ponteiro ainda aproveita a sessão remota mais recente", async () => {
    at(30);
    writePointer(storage, { userId: "u1", sessionId: "s-a", resourceId: "lista-a", offsetMinutes: 30 });
    const { client } = createClient([listA, listB], { failSingle: true });

    const resume = await fetchLatestStudyResume({ userId: "u1", institutionId: null, client, storage, now: at(90) });
    expect(resume?.sessionId).toBe("s-b");
  });
});
