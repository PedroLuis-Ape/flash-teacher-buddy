import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  updates: [] as Array<{ table: string; payload: Record<string, unknown> }>,
  updateResult: { data: { id: "card-1" }, error: null } as { data: unknown; error: unknown },
  resolve: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      update: (payload: Record<string, unknown>) => {
        state.updates.push({ table, payload });
        const chain: Record<string, unknown> = {};
        chain.eq = () => chain;
        chain.select = () => chain;
        chain.maybeSingle = () => Promise.resolve(state.updateResult);
        return chain;
      },
    }),
  },
}));

vi.mock("./studyCardNotesTarget", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./studyCardNotesTarget")>();
  return { ...actual, resolveCurrentSourceCard: state.resolve };
});

import { saveInGameGlossaryNote } from "./glossaryNoteApi";
import { buildGlossaryNoteTarget } from "./glossaryNote";
import { READ_ONLY_CARD_MESSAGE } from "./studyCardNotesTarget";

const target = buildGlossaryNoteTarget(
  { text: "ratio", startIndex: 0, endIndex: 5, scope: "contextual" },
  "A",
  "relação; proporção",
);

function mockSourceCard(wordHints: unknown, userId = "user-1") {
  state.resolve.mockResolvedValue({
    visibleCard: { id: "card-1", term: "ratio", translation: "relação" },
    sourceCard: {
      id: "card-1",
      user_id: userId,
      term: "ratio",
      translation: "relação",
      word_hints: wordHints,
    },
  });
}

describe("saveInGameGlossaryNote", () => {
  beforeEach(() => {
    state.updates.length = 0;
    state.updateResult = { data: { id: "card-1" }, error: null };
    state.resolve.mockReset();
  });

  it("grava somente word_hints no card de origem, preservando as outras entradas", async () => {
    mockSourceCard([
      { text: "went", translation: "fui", startIndex: 2, endIndex: 6, side: "A" },
    ]);

    const result = await saveInGameGlossaryNote({
      userId: "user-1",
      pathname: "/list/list-1/study",
      target,
      note: "Usado como relação entre duas grandezas.",
    });

    expect(state.updates).toHaveLength(1);
    expect(Object.keys(state.updates[0].payload)).toEqual(["word_hints"]);
    expect(result.hints).toHaveLength(2);
    expect(result.hints[0]).toMatchObject({ text: "went", translation: "fui" });
    expect(result.hints[1]).toMatchObject({
      text: "ratio",
      translation: "relação; proporção",
      note: "Usado como relação entre duas grandezas.",
      side: "A",
    });
  });

  it("recusa material somente leitura sem escrever nada", async () => {
    mockSourceCard([], "outro-usuario");

    await expect(saveInGameGlossaryNote({
      userId: "user-1",
      pathname: "/portal/list/list-1/study",
      target,
      note: "nota",
    })).rejects.toThrow(READ_ONLY_CARD_MESSAGE);

    expect(state.updates).toHaveLength(0);
  });

  it("é idempotente: repetir a mesma anotação não escreve de novo", async () => {
    mockSourceCard([
      {
        text: "ratio",
        translation: "relação; proporção",
        note: "já salvo",
        startIndex: 0,
        endIndex: 5,
        side: "A",
        scope: "contextual",
      },
    ]);

    const result = await saveInGameGlossaryNote({
      userId: "user-1",
      pathname: "/list/list-1/study",
      target,
      note: "já salvo",
    });

    expect(state.updates).toHaveLength(0);
    expect(result.hints).toHaveLength(1);
  });

  it("remove a camada criada apenas para a anotação", async () => {
    mockSourceCard([
      {
        text: "ratio",
        translation: "relação; proporção",
        note: "nota antiga",
        startIndex: 0,
        endIndex: 5,
        side: "A",
        scope: "contextual",
        noteOnly: true,
      },
    ]);

    const result = await saveInGameGlossaryNote({
      userId: "user-1",
      pathname: "/list/list-1/study",
      target,
      note: "",
    });

    expect(state.updates).toHaveLength(1);
    expect(result.hints).toHaveLength(0);
  });

  it("propaga erro de gravação sem inventar sucesso", async () => {
    mockSourceCard([]);
    state.updateResult = { data: null, error: new Error("falha de rede") };

    await expect(saveInGameGlossaryNote({
      userId: "user-1",
      pathname: "/list/list-1/study",
      target,
      note: "nota",
    })).rejects.toThrow("falha de rede");
  });
});

