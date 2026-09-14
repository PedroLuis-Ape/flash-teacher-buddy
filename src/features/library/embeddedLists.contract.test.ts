import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
}));

import {
  clearEmbeddedList,
  clearEmbeddedListStateCache,
  createEmbeddedList,
  resolveListEmbeddedState,
  unembedCards,
  unembedSourceList,
} from "./embeddedLists";

const SQL = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260914200000_embedded_lists_v1.sql"),
  "utf8",
);


describe("embedded lists SQL contract", () => {
  it("keeps membership reference-based with a unique card per embedded list", () => {
    expect(SQL).toContain("CREATE TABLE IF NOT EXISTS public.embedded_list_cards");
    expect(SQL).toContain("PRIMARY KEY (embedded_list_id, flashcard_id)");
    expect(SQL).toContain("UNIQUE (embedded_list_id, flashcard_id)");
    expect(SQL).toContain("ON CONFLICT (embedded_list_id, flashcard_id) DO NOTHING");
  });

  it("never deletes or mutates flashcards when unembedding", () => {
    const unembedStatements = SQL.match(/DELETE FROM public\.[a-z_]+/g) ?? [];
    expect(unembedStatements.length).toBeGreaterThan(0);
    for (const statement of unembedStatements) {
      expect(statement).toBe("DELETE FROM public.embedded_list_cards");
    }
    expect(SQL).not.toContain("UPDATE public.flashcards");
    expect(SQL).not.toContain("INSERT INTO public.flashcards");
  });

  it("authorizes every mutation server-side instead of trusting the client", () => {
    expect(SQL).toContain("ALTER TABLE public.embedded_lists ENABLE ROW LEVEL SECURITY");
    expect(SQL).toContain("ALTER TABLE public.embedded_list_cards ENABLE ROW LEVEL SECURITY");
    expect(SQL).toContain("public.assert_owned_embedded_list");
    expect(SQL).toContain("owner_list.owner_id = auth.uid()");
    for (const fn of [
      "create_embedded_list",
      "embed_source_lists",
      "embed_cards",
      "unembed_cards",
      "unembed_source_list",
      "clear_embedded_list",
      "get_embedded_list_members",
      "get_embedded_list_flashcards",
      "get_embedded_list_card_count",
    ]) {
      expect(SQL).toContain(`public.${fn}`);
      expect(SQL).toContain(`GRANT EXECUTE ON FUNCTION public.${fn}`);
    }
    expect(SQL).not.toContain("GRANT INSERT ON public.embedded_list_cards TO authenticated");
    expect(SQL).not.toContain("TO anon");
  });

  it("only accepts source lists from the same folder", () => {
    expect(SQL).toContain("source_list.folder_id = v_folder_id");
    expect(SQL).toContain("RAISE EXCEPTION 'Lista de origem inválida");
  });

  it("cascades membership when a source list row is hard-deleted", () => {
    expect(SQL).toContain("source_list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE");
  });

  it("rejects embedded lists as sources in both embed paths", () => {
    const nestedGuards = SQL.match(
      /SELECT 1 FROM public\.embedded_lists nested WHERE nested\.list_id = source_list\.id/g,
    ) ?? [];
    expect(nestedGuards.length).toBeGreaterThanOrEqual(2);
  });

  it("requires at least one source list and rejects class folders on creation", () => {
    expect(SQL).toContain("RAISE EXCEPTION 'Selecione pelo menos uma lista de origem");
    expect(SQL).toContain("AND class_id IS NULL;");
    expect(SQL).toContain("RAISE EXCEPTION 'Pasta inexistente, de turma ou sem permissão.'");
  });

  it("keeps embedded lists private even under bulk folder sharing", () => {
    expect(SQL).toContain("CREATE OR REPLACE FUNCTION public.keep_embedded_lists_private()");
    expect(SQL).toContain("BEFORE UPDATE OF visibility, class_id ON public.lists");
    expect(SQL).toContain("DROP TRIGGER IF EXISTS keep_embedded_lists_private_trg ON public.lists");
    expect(SQL).toContain("NEW.visibility := 'private'");
    expect(SQL).toContain("NEW.class_id := NULL");
  });


  it("returns the original flashcard rows for study reads", () => {
    expect(SQL).toContain("RETURNS SETOF public.flashcards");
    expect(SQL).toContain("is_embedded");
    expect(SQL).toContain("source_count");
  });
});

describe("embedded lists client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearEmbeddedListStateCache();
  });

  it("classifies a list as embedded only from the marker table", async () => {
    const builder: any = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => ({ data: { list_id: "list-1" }, error: null })),
    };
    mocks.from.mockReturnValue(builder);

    await expect(resolveListEmbeddedState("list-1")).resolves.toBe("embedded");
    expect(mocks.from).toHaveBeenCalledWith("embedded_lists");
  });

  it("never turns a marker read failure into a normal list", async () => {
    const builder: any = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => ({ data: null, error: { code: "42501" } })),
    };
    mocks.from.mockReturnValue(builder);

    await expect(resolveListEmbeddedState("list-2")).resolves.toBe("unknown");
  });

  it("routes every mutation through the validated RPCs", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ requested: 2, removed: 2 }], error: null });
    await unembedCards("embedded-1", ["card-a", "card-b"]);
    expect(mocks.rpc).toHaveBeenCalledWith("unembed_cards", {
      _embedded_list_id: "embedded-1",
      _flashcard_ids: ["card-a", "card-b"],
    });

    mocks.rpc.mockResolvedValue({ data: [{ removed: 5 }], error: null });
    await unembedSourceList("embedded-1", "source-1");
    expect(mocks.rpc).toHaveBeenCalledWith("unembed_source_list", {
      _embedded_list_id: "embedded-1",
      _source_list_id: "source-1",
    });

    mocks.rpc.mockResolvedValue({ data: [{ removed: 7 }], error: null });
    await clearEmbeddedList("embedded-1");
    expect(mocks.rpc).toHaveBeenCalledWith("clear_embedded_list", {
      _embedded_list_id: "embedded-1",
    });

    expect(mocks.from).not.toHaveBeenCalledWith("flashcards");
  });

  it("reports truthful backend counts when creating", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ list_id: "new-list", requested: 10, added: 8, already_present: 2 }],
      error: null,
    });

    await expect(
      createEmbeddedList({
        folderId: "folder-1",
        title: "Revisão geral",
        sourceListIds: ["source-1"],
      }),
    ).resolves.toEqual({
      list_id: "new-list",
      requested: 10,
      added: 8,
      already_present: 2,
    });
  });
});
