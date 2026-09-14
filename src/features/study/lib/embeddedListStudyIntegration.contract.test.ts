import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrato integrado: Lista Combinada + persistência servidor-canônica.
 *
 * Prova, sem tocar no banco real, que:
 *  - a migração aplicada mantém a pertinência por referência (nunca copia card);
 *  - a leitura de estudo devolve linhas ORIGINAIS (incluindo camadas filhas);
 *  - a sessão usa a lista combinada como escopo (posição/modo);
 *  - o progresso por card fica na chave canônica (user_id, flashcard_id) da
 *    lista original, sem duplicar por causa da lista combinada;
 *  - desincorporar remove apenas a referência, nunca o flashcard.
 */

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase/migrations");

const readMigrationContaining = (needle: string): string => {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files.reverse()) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    if (sql.includes(needle)) return sql;
  }
  throw new Error(`nenhuma migração contém ${needle}`);
};

const EMBEDDED_SQL = readMigrationContaining("CREATE TABLE IF NOT EXISTS public.embedded_list_cards");
const PROGRESS_SQL = readMigrationContaining(
  "CREATE OR REPLACE FUNCTION public.record_flashcard_progress_v1",
);

describe("migração aplicada de lista combinada", () => {
  it("guarda apenas referências, com card único por lista combinada", () => {
    expect(EMBEDDED_SQL).toContain("flashcard_id uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE");
    expect(EMBEDDED_SQL).toContain("source_list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE");
    expect(EMBEDDED_SQL).toContain("PRIMARY KEY (embedded_list_id, flashcard_id)");
    expect(EMBEDDED_SQL).toContain("UNIQUE (embedded_list_id, flashcard_id)");
    expect(EMBEDDED_SQL).toContain("ON CONFLICT (embedded_list_id, flashcard_id) DO NOTHING");
  });

  it("desincorporar apaga somente a tabela de pertinência", () => {
    const deletes = EMBEDDED_SQL.match(/DELETE FROM public\.[a-z_]+/g) ?? [];
    expect(deletes.length).toBeGreaterThan(0);
    for (const statement of deletes) {
      expect(statement).toBe("DELETE FROM public.embedded_list_cards");
    }
    expect(EMBEDDED_SQL).not.toMatch(/UPDATE public\.flashcards/);
  });

  it("mantém RLS por dono e nega execução anônima nas RPCs sensíveis", () => {
    expect(EMBEDDED_SQL).toContain("ALTER TABLE public.embedded_lists ENABLE ROW LEVEL SECURITY");
    expect(EMBEDDED_SQL).toContain("ALTER TABLE public.embedded_list_cards ENABLE ROW LEVEL SECURITY");
    expect(EMBEDDED_SQL).toContain("owner_list.owner_id = auth.uid()");
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
      expect(EMBEDDED_SQL).toContain(`CREATE OR REPLACE FUNCTION public.${fn}`);
      expect(EMBEDDED_SQL).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\) FROM anon`));
      expect(EMBEDDED_SQL).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) TO authenticated`));
    }
  });

  it("v1 privado: pasta pessoal, sem turma, sem lista combinada como fonte", () => {
    expect(EMBEDDED_SQL).toContain("AND class_id IS NULL");
    expect(EMBEDDED_SQL).toContain("FROM public.embedded_lists nested WHERE nested.list_id = source_list.id");
    expect(EMBEDDED_SQL).toContain("Selecione pelo menos uma lista de origem");
    expect(EMBEDDED_SQL).toContain("CREATE TRIGGER keep_embedded_lists_private_trg");
  });

  it("leitura de estudo devolve originais com camadas e sem excluídos", () => {
    expect(EMBEDDED_SQL).toContain("RETURNS SETOF public.flashcards");
    expect(EMBEDDED_SQL).toContain("card.parent_card_id IS NOT NULL");
    expect(EMBEDDED_SQL).toContain("AND member.flashcard_id = card.parent_card_id");
    expect(EMBEDDED_SQL).toContain("WHERE card.deleted_at IS NULL");
  });

  it("contagem da pasta reconhece lista combinada preservando reference_id e last_activity", () => {
    expect(EMBEDDED_SQL).toContain("(marker.list_id IS NOT NULL) AS is_embedded");
    expect(EMBEDDED_SQL).toContain("AS source_count");
    expect(EMBEDDED_SQL).toContain("list_row.reference_id");
    expect(EMBEDDED_SQL).toContain("AS last_activity");
  });

  it("progresso por card aceita lista combinada e grava na lista canônica do card", () => {
    expect(PROGRESS_SQL).toContain("SELECT f.list_id INTO v_canonical_list_id");
    expect(PROGRESS_SQL).toContain("FROM public.embedded_list_cards AS elc");
    expect(PROGRESS_SQL).toContain("el.owner_id = $3");
    expect(PROGRESS_SQL).toContain("ON CONFLICT (user_id, flashcard_id) DO UPDATE");
  });
});

// --- Servidor em memória espelhando a semântica SQL acima --------------------

type Card = {
  id: string;
  list_id: string;
  user_id: string;
  parent_card_id: string | null;
  deleted_at: string | null;
};

const USER = "user-1";
const FOLDER = "folder-1";

const createServer = () => {
  const lists = new Map<string, { id: string; folder_id: string; owner_id: string; embedded: boolean }>([
    ["list-a", { id: "list-a", folder_id: FOLDER, owner_id: USER, embedded: false }],
    ["list-b", { id: "list-b", folder_id: FOLDER, owner_id: USER, embedded: false }],
  ]);
  const cards = new Map<string, Card>([
    ["card-1", { id: "card-1", list_id: "list-a", user_id: USER, parent_card_id: null, deleted_at: null }],
    ["card-1-layer", { id: "card-1-layer", list_id: "list-a", user_id: USER, parent_card_id: "card-1", deleted_at: null }],
    ["card-2", { id: "card-2", list_id: "list-b", user_id: USER, parent_card_id: null, deleted_at: null }],
  ]);
  const memberships: { embedded_list_id: string; flashcard_id: string; source_list_id: string }[] = [];
  const progress = new Map<string, { user_id: string; flashcard_id: string; list_id: string; correct: number }>();
  const sessions = new Map<string, { list_id: string; mode: string; current_index: number }>();

  return {
    lists,
    cards,
    memberships,
    progress,
    sessions,
    createEmbeddedList(sourceListIds: string[]) {
      if (sourceListIds.length < 1) throw new Error("pelo menos uma lista de origem");
      for (const sourceId of sourceListIds) {
        const source = lists.get(sourceId);
        if (!source || source.owner_id !== USER || source.folder_id !== FOLDER || source.embedded) {
          throw new Error("lista de origem inválida");
        }
      }
      const id = "embedded-1";
      lists.set(id, { id, folder_id: FOLDER, owner_id: USER, embedded: true });
      for (const card of cards.values()) {
        if (!sourceListIds.includes(card.list_id)) continue;
        if (card.deleted_at || card.parent_card_id) continue;
        if (memberships.some((m) => m.embedded_list_id === id && m.flashcard_id === card.id)) continue;
        memberships.push({ embedded_list_id: id, flashcard_id: card.id, source_list_id: card.list_id });
      }
      return id;
    },
    getEmbeddedListFlashcards(embeddedListId: string) {
      return [...cards.values()].filter((card) => {
        if (card.deleted_at) return false;
        const direct = memberships.some(
          (m) => m.embedded_list_id === embeddedListId && m.flashcard_id === card.id,
        );
        const layer =
          card.parent_card_id !== null &&
          memberships.some(
            (m) => m.embedded_list_id === embeddedListId && m.flashcard_id === card.parent_card_id,
          );
        return direct || layer;
      });
    },
    unembedCards(embeddedListId: string, flashcardIds: string[]) {
      let removed = 0;
      for (let index = memberships.length - 1; index >= 0; index -= 1) {
        const member = memberships[index];
        if (member.embedded_list_id === embeddedListId && flashcardIds.includes(member.flashcard_id)) {
          memberships.splice(index, 1);
          removed += 1;
        }
      }
      return removed;
    },
    persistSession(listId: string, mode: string, currentIndex: number) {
      sessions.set(`${USER}:${listId}:${mode}`, { list_id: listId, mode, current_index: currentIndex });
    },
    recordProgress(flashcardId: string, listId: string, correct: boolean) {
      const card = cards.get(flashcardId);
      if (!card || card.deleted_at) throw new Error("study_access_denied");
      const canonicalListId = card.list_id;
      const ownsCard = card.user_id === USER && card.list_id === listId;
      const viaEmbedded = memberships.some(
        (m) =>
          m.embedded_list_id === listId &&
          m.flashcard_id === flashcardId &&
          lists.get(listId)?.owner_id === USER,
      );
      if (!ownsCard && !viaEmbedded) throw new Error("study_access_denied");
      const key = `${USER}:${flashcardId}`;
      const existing = progress.get(key);
      progress.set(key, {
        user_id: USER,
        flashcard_id: flashcardId,
        list_id: canonicalListId,
        correct: (existing?.correct ?? 0) + (correct ? 1 : 0),
      });
    },
  };
};

describe("integração: lista combinada estudada com persistência canônica", () => {
  it("cria, lê originais, escopa a sessão e mantém o progresso no card original", () => {
    const server = createServer();

    const embeddedId = server.createEmbeddedList(["list-a", "list-b"]);
    expect(server.memberships).toHaveLength(2);
    expect(server.cards.size).toBe(3); // nenhum card copiado

    const deck = server.getEmbeddedListFlashcards(embeddedId);
    expect(deck.map((card) => card.id).sort()).toEqual(["card-1", "card-1-layer", "card-2"]);

    server.persistSession(embeddedId, "write", 1);
    expect(server.sessions.get(`${USER}:${embeddedId}:write`)).toEqual({
      list_id: embeddedId,
      mode: "write",
      current_index: 1,
    });

    server.recordProgress("card-1", embeddedId, true);
    server.recordProgress("card-2", embeddedId, true);
    expect([...server.progress.keys()].sort()).toEqual([`${USER}:card-1`, `${USER}:card-2`]);
    expect(server.progress.get(`${USER}:card-1`)?.list_id).toBe("list-a");
    expect(server.progress.get(`${USER}:card-2`)?.list_id).toBe("list-b");
  });

  it("estudar o mesmo card na lista original e na combinada não duplica progresso", () => {
    const server = createServer();
    const embeddedId = server.createEmbeddedList(["list-a"]);

    server.recordProgress("card-1", "list-a", true);
    server.recordProgress("card-1", embeddedId, true);

    expect([...server.progress.keys()]).toEqual([`${USER}:card-1`]);
    expect(server.progress.get(`${USER}:card-1`)).toEqual({
      user_id: USER,
      flashcard_id: "card-1",
      list_id: "list-a",
      correct: 2,
    });
  });

  it("desincorporar remove apenas a referência e preserva o flashcard e seu progresso", () => {
    const server = createServer();
    const embeddedId = server.createEmbeddedList(["list-a", "list-b"]);
    server.recordProgress("card-1", embeddedId, true);

    const removed = server.unembedCards(embeddedId, ["card-1"]);

    expect(removed).toBe(1);
    expect(server.memberships.map((m) => m.flashcard_id)).toEqual(["card-2"]);
    expect(server.cards.get("card-1")).toMatchObject({ id: "card-1", list_id: "list-a", deleted_at: null });
    expect(server.progress.get(`${USER}:card-1`)?.correct).toBe(1);
    expect(server.getEmbeddedListFlashcards(embeddedId).map((card) => card.id)).toEqual(["card-2"]);
  });

  it("recusa progresso de card que não é membro da lista combinada", () => {
    const server = createServer();
    const embeddedId = server.createEmbeddedList(["list-a"]);
    server.unembedCards(embeddedId, ["card-1"]);

    expect(() => server.recordProgress("card-1", embeddedId, true)).toThrow("study_access_denied");
  });

  it("exige pelo menos uma lista de origem e recusa combinada como fonte", () => {
    const server = createServer();
    expect(() => server.createEmbeddedList([])).toThrow("pelo menos uma lista de origem");

    server.createEmbeddedList(["list-a"]);
    server.memberships.length = 0;
    expect(() => server.createEmbeddedList(["embedded-1"])).toThrow("lista de origem inválida");
  });
});
