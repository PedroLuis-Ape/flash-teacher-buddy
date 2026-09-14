/**
 * Fonte de dados em memoria dos testes do motor linguistico.
 *
 * Implementa a MESMA interface usada em producao (VocabularyDataSource) e
 * registra cada consulta, o que permite provar duas coisas de uma vez:
 *   - o motor e testavel sem rede;
 *   - o numero de round-trips e limitado e nao cresce com o numero de listas.
 */

import type { InventoryFilter, VocabularyCardRow, VocabularyDataSource } from "../../learning/types";

export interface FixtureQuery {
  kind: "countLists" | "resolveListIds" | "countCards" | "readCardPage";
  filter?: InventoryFilter;
  limit?: number;
  offset?: number;
}

export interface FixtureSource extends VocabularyDataSource {
  rows: VocabularyCardRow[];
  queries: FixtureQuery[];
  lists: number;
  folderByList: Map<string, string>;
}

function byCreatedThenId(left: VocabularyCardRow, right: VocabularyCardRow): number {
  const leftCreated = String(left.created_at ?? "");
  const rightCreated = String(right.created_at ?? "");
  if (leftCreated !== rightCreated) return leftCreated < rightCreated ? -1 : 1;
  const leftId = String(left.id);
  const rightId = String(right.id);
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

export interface FixtureSourceOptions {
  rows: VocabularyCardRow[];
  lists?: number;
  folderByList?: Record<string, string>;
}

export function createFixtureVocabularySource(options: FixtureSourceOptions): FixtureSource {
  const rows = options.rows;
  const queries: FixtureQuery[] = [];
  const folderByList = new Map(Object.entries(options.folderByList ?? {}));
  // Ordenacao memoizada: um backend real devolve as paginas ja ordenadas, e o
  // teste de escala deve medir o motor, nao o fake.
  let sortedCache: VocabularyCardRow[] = [];
  let sortedLength = -1;
  const sortedRows = (): VocabularyCardRow[] => {
    if (sortedLength !== rows.length) {
      sortedCache = [...rows].sort(byCreatedThenId);
      sortedLength = rows.length;
    }
    return sortedCache;
  };

  const matches = (row: VocabularyCardRow, filter: InventoryFilter): boolean => {
    if (filter.listIds?.length) {
      const listId = String(row.list_id ?? "");
      if (!filter.listIds.map((value) => value.toLowerCase()).includes(listId.toLowerCase())) return false;
    }
    if (filter.folderIds?.length) {
      const folder = folderByList.get(String(row.list_id ?? ""));
      if (!folder) return false;
      if (!filter.folderIds.map((value) => value.toLowerCase()).includes(folder.toLowerCase())) return false;
    }
    return true;
  };

  return {
    rows,
    queries,
    folderByList,
    lists: options.lists ?? 1,

    async countLists(): Promise<number | null> {
      queries.push({ kind: "countLists" });
      return options.lists ?? 1;
    },

    async resolveListIds(listIds: string[]): Promise<{ accessible: string[]; missing: string[] }> {
      queries.push({ kind: "resolveListIds", filter: { listIds } });
      const known = new Set(
        rows.map((row) => String(row.list_id ?? "").toLowerCase()).filter((value) => value.length > 0),
      );
      const accessible = listIds.filter((value) => known.has(value.toLowerCase()));
      return { accessible, missing: listIds.filter((value) => !known.has(value.toLowerCase())) };
    },

    async countCards(filter: InventoryFilter): Promise<number | null> {
      queries.push({ kind: "countCards", filter });
      return rows.filter((row) => matches(row, filter)).length;
    },

    async readCardPage(
      filter: InventoryFilter,
      page: { limit: number; offset: number },
    ): Promise<VocabularyCardRow[]> {
      queries.push({ kind: "readCardPage", filter, limit: page.limit, offset: page.offset });
      const filtered = sortedRows().filter((row) => matches(row, filter));
      return filtered.slice(page.offset, page.offset + page.limit);
    },

    queryCount(): number {
      return queries.length;
    },
  };
}
