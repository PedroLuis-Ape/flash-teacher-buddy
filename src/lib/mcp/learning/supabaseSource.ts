/**
 * Fonte de dados de producao do inventario de vocabulario.
 *
 * Reutiliza a camada de dominio do MCP em vez de abrir um caminho paralelo:
 * o client ja vem scoped ao bearer token do usuario (domain/client), o escopo e
 * validado por assertScopeAccessible (domain/scope), a projecao de card e a
 * mesma de domain/flashcards (CARD_SELECT + teto de texto) e qualquer erro do
 * provider e traduzido por toMcpDomainError (domain/errors).
 *
 * O que o dominio ainda NAO oferece e uma varredura de cards por biblioteca
 * inteira: readCardPage exige list_id e limita a 100 itens. O inventario
 * precisa exatamente disso (milhares de cards, poucas requests), entao a
 * varredura vive aqui, com o MESMO formato de filtros aninhados que
 * domain/search.ts ja usa (flashcards -> lists!inner -> folders!inner).
 * Promover isso para domain/flashcards.ts e o proximo passo natural de evolucao.
 */

import type { UserScopedDb } from "../domain/client";
import { toMcpDomainError } from "../domain/errors";
import { CARD_SELECT, MAX_CARD_TEXT_LENGTH } from "../domain/flashcards";
import { asRow, asRows, num, str, truncatedStr } from "../domain/query";
import { assertScopeAccessible, type LibraryScope } from "../domain/scope";
import type { InventoryFilter, VocabularyCardRow, VocabularyDataSource } from "./types";

/**
 * Projecao do inventario: a mesma do deck (CARD_SELECT) mais list_id e o
 * encadeamento que prova posse (lists e folders do proprio usuario).
 */
export const INVENTORY_CARD_SELECT =
  CARD_SELECT +
  ",list_id,lists!inner(id,system_kind,deleted_at,folders!inner(id,owner_id,system_kind,deleted_at,class_id,institution_id))";

interface AnyBuilder extends PromiseLike<{ data: unknown; error: unknown; count: number | null }> {
  eq(column: string, value: unknown): AnyBuilder;
  is(column: string, value: unknown): AnyBuilder;
  in(column: string, values: unknown[]): AnyBuilder;
  order(column: string, options?: Record<string, unknown>): AnyBuilder;
  range(from: number, to: number): AnyBuilder;
}

/**
 * O builder do PostgREST tem genericos profundos demais para inferencia estavel
 * quando os filtros sao compostos em helpers. O tipo estrutural local preserva
 * o comportamento que importa (eq/is/in/order/range + {data,error,count}).
 */
function asBuilder(value: unknown): AnyBuilder {
  return value as AnyBuilder;
}

/**
 * Aplica os filtros de posse/escopo exatamente como a Biblioteca do produto:
 * user_id do proprio token, nada de lixeira, nada de colecao de sistema, nada
 * de conteudo de turma, e escopo pessoal (institution_id is null) ou
 * institucional (institution_id = X).
 */
function scopedCards(
  base: AnyBuilder,
  db: UserScopedDb,
  scope: LibraryScope,
  filter: InventoryFilter,
): AnyBuilder {
  const owned = base
    .eq("user_id", db.userId)
    .is("deleted_at", null)
    .eq("lists.system_kind", "user")
    .is("lists.deleted_at", null)
    .eq("lists.folders.owner_id", db.userId)
    .eq("lists.folders.system_kind", "user")
    .is("lists.folders.deleted_at", null)
    .is("lists.folders.class_id", null);
  const scoped =
    scope.kind === "personal"
      ? owned.is("lists.folders.institution_id", null)
      : owned.eq("lists.folders.institution_id", scope.institutionId);
  const inFolders = filter.folderIds?.length ? scoped.in("lists.folders.id", filter.folderIds) : scoped;
  return filter.listIds?.length ? inFolders.in("lists.id", filter.listIds) : inFolders;
}

function scopedLists(base: AnyBuilder, db: UserScopedDb, scope: LibraryScope): AnyBuilder {
  const owned = base
    .eq("folders.owner_id", db.userId)
    .eq("folders.system_kind", "user")
    .is("folders.deleted_at", null)
    .is("folders.class_id", null)
    .eq("system_kind", "user")
    .is("deleted_at", null);
  return scope.kind === "personal"
    ? owned.is("folders.institution_id", null)
    : owned.eq("folders.institution_id", scope.institutionId);
}

function toCardRow(raw: unknown): VocabularyCardRow | null {
  const row = asRow(raw);
  const id = str(row, "id");
  const term = truncatedStr(row, "term", MAX_CARD_TEXT_LENGTH);
  if (!id || !term) return null;
  return {
    id,
    term,
    translation: truncatedStr(row, "translation", MAX_CARD_TEXT_LENGTH),
    hint: truncatedStr(row, "hint", MAX_CARD_TEXT_LENGTH),
    example_text: truncatedStr(row, "example_text", MAX_CARD_TEXT_LENGTH),
    context_tag: str(row, "context_tag"),
    list_id: str(row, "list_id"),
    layer_index: num(row, "layer_index"),
    parent_card_id: str(row, "parent_card_id"),
    created_at: str(row, "created_at"),
  };
}

/**
 * Implementacao real da interface do motor. A verificacao de escopo acontece
 * uma unica vez, na primeira consulta: a fonte nao pode ser usada sem provar
 * que a conta opera naquele escopo.
 */
export function createSupabaseVocabularySource(
  db: UserScopedDb,
  scope: LibraryScope,
): VocabularyDataSource {
  let queries = 0;
  let scopeChecked: Promise<void> | null = null;
  const ensureScope = () => {
    if (!scopeChecked) scopeChecked = assertScopeAccessible(db, scope);
    return scopeChecked;
  };

  return {
    async countLists(): Promise<number | null> {
      await ensureScope();
      queries += 1;
      const base = asBuilder(db.client.from("lists").select("id", { count: "exact", head: true }));
      const { count, error } = await scopedLists(base, db, scope);
      if (error) throw toMcpDomainError(error, "Não foi possível contar as listas desta biblioteca.");
      return typeof count === "number" ? count : null;
    },

    async resolveListIds(listIds: string[]): Promise<{ accessible: string[]; missing: string[] }> {
      await ensureScope();
      queries += 1;
      const base = asBuilder(db.client.from("lists").select("id,title"));
      const { data, error } = await scopedLists(base, db, scope).in("id", listIds);
      if (error) throw toMcpDomainError(error, "Não foi possível validar as listas informadas.");
      const accessible = asRows(data)
        .map((row) => str(asRow(row), "id"))
        .filter((value): value is string => Boolean(value));
      const known = new Set(accessible.map((value) => value.toLowerCase()));
      return {
        accessible,
        missing: listIds.filter((value) => !known.has(value.toLowerCase())),
      };
    },

    async countCards(filter: InventoryFilter): Promise<number | null> {
      await ensureScope();
      queries += 1;
      const base = asBuilder(db.client.from("flashcards").select("id", { count: "exact", head: true }));
      const { count, error } = await scopedCards(base, db, scope, filter);
      if (error) throw toMcpDomainError(error, "Não foi possível contar os flashcards desta biblioteca.");
      return typeof count === "number" ? count : null;
    },

    async readCardPage(
      filter: InventoryFilter,
      page: { limit: number; offset: number },
    ): Promise<VocabularyCardRow[]> {
      await ensureScope();
      queries += 1;
      const base = asBuilder(db.client.from("flashcards").select(INVENTORY_CARD_SELECT, { count: "exact" }));
      const { data, error } = await scopedCards(base, db, scope, filter)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(page.offset, page.offset + page.limit - 1);
      if (error) throw toMcpDomainError(error, "Não foi possível ler os flashcards desta biblioteca.");
      return asRows(data)
        .map((row) => toCardRow(row))
        .filter((row): row is VocabularyCardRow => row !== null);
    },

    queryCount(): number {
      return queries;
    },
  };
}
