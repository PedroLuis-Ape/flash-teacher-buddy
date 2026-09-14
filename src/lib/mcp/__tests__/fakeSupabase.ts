/**
 * PostgREST-shaped fake used by the MCP domain tests.
 *
 * It filters/orders/paginates reads and also performs inserts, updates and the
 * product's trash RPCs over the same in-memory tables, so a test can exercise a
 * full tool -> domain -> backend round trip. Every query built is recorded
 * (filters included), which is how the ownership/scope assertions are proven.
 */

type Row = Record<string, unknown>;

export interface FakeFilter {
  op: "eq" | "is" | "in" | "ilike" | "or" | "not_null";
  column?: string;
  value?: unknown;
}

export interface FakeQueryCall {
  table: string;
  operation: "select" | "insert" | "update" | "upsert";
  columns?: string;
  countRequested: boolean;
  head: boolean;
  filters: FakeFilter[];
  orders: Array<{ column: string; ascending: boolean }>;
  range?: [number, number];
  limit?: number;
}

export interface FakeRpcCall {
  operation: "rpc";
  table: string;
  rpcName: string;
  rpcParams: Record<string, unknown>;
}

export type RecordedCall = FakeQueryCall | FakeRpcCall;

export interface FakeClientOptions {
  /** Table -> provider error, used to simulate RLS/permission denial. */
  deny?: Record<string, { code: string; message: string }>;
  /** Provider error returned before any row mutation for one UPDATE statement. */
  failUpdate?: { code: string; message: string };
  /** Overrides/replacements for the product RPCs (e.g. a NOT_FOUND answer). */
  rpc?: Record<string, (params: Record<string, unknown>, tables: Record<string, Row[]>) => { data: unknown; error: unknown }>;
}

export interface FakeClient {
  from(table: string): unknown;
  rpc(name: string, params?: Record<string, unknown>): Promise<{ data: unknown; error: unknown; count?: number | null }>;
  calls: RecordedCall[];
  tables: Record<string, Row[]>;
}

function resolvePath(row: Row | null | undefined, path: string): { found: boolean; value: unknown } {
  const segments = path.split(".");
  let current: unknown = row;
  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== "object") {
      return { found: false, value: undefined };
    }
    const record = current as Row;
    if (!(segment in record)) return { found: false, value: undefined };
    current = record[segment];
  }
  return { found: true, value: current };
}

function matchesIlike(value: unknown, pattern: string): boolean {
  if (typeof value !== "string") return false;
  const needle = pattern.replace(/%/g, "").toLowerCase();
  return value.toLowerCase().includes(needle);
}

function matchesOrExpression(row: Row, expression: string): boolean {
  return expression
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .some((term) => {
      const match = /^(.+?)\.ilike\.(.*)$/.exec(term);
      if (!match) return false;
      return matchesIlike(resolvePath(row, match[1]).value, match[2]);
    });
}

function rowMatches(row: Row, filters: FakeFilter[]): boolean {
  return filters.every((filter) => {
    if (filter.op === "or") return matchesOrExpression(row, String(filter.value));
    if (!filter.column) return true;
    const resolved = resolvePath(row, filter.column);
    // A missing embed behaves like an inner join: the row is not part of the result.
    if (!resolved.found) return false;
    switch (filter.op) {
      case "eq":
        return resolved.value === filter.value;
      case "is":
        return filter.value === null ? resolved.value === null : resolved.value === filter.value;
      case "in":
        return Array.isArray(filter.value) && filter.value.includes(resolved.value);
      case "ilike":
        return matchesIlike(resolved.value, String(filter.value));
      case "not_null":
        return resolved.value !== null && resolved.value !== undefined;
      default:
        return true;
    }
  });
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

const NOW_ISO = "2026-09-13T12:00:00.000Z";

/** Column defaults the database would apply on insert. */
const TABLE_DEFAULTS: Record<string, Row> = {
  folders: { system_kind: "user", visibility: "private", class_id: null, institution_id: null, deleted_at: null },
  lists: {
    system_kind: "user",
    visibility: "private",
    primary_side: "a",
    order_index: 0,
    class_id: null,
    institution_id: null,
    deleted_at: null,
  },
  flashcards: { deleted_at: null },
};

/**
 * Keeps the embedded relationships a real PostgREST select would return in
 * sync after inserts/updates, so re-reads filter embeds like production does.
 */
function syncEmbeds(table: string, row: Row, tables: Record<string, Row[]>): void {
  if (table === "lists") {
    const folder = (tables.folders ?? []).find((candidate) => candidate.id === row.folder_id);
    if (folder) row.folders = folder;
    return;
  }
  if (table === "flashcards") {
    const list = (tables.lists ?? []).find((candidate) => candidate.id === row.list_id);
    if (list) row.lists = list;
    return;
  }
  if (table === "folders") {
    row.lists = (tables.lists ?? [])
      .filter((candidate) => candidate.folder_id === row.id)
      .map((candidate) => ({ id: candidate.id, deleted_at: candidate.deleted_at, system_kind: candidate.system_kind }));
  }
}

/** Product trash RPCs, implemented over the same tables. */
function defaultRpc(
  name: string,
  params: Record<string, unknown>,
  tables: Record<string, Row[]>,
): { data: unknown; error: unknown } {
  const flashcards = tables.flashcards ?? [];
  const lists = tables.lists ?? [];
  const folders = tables.folders ?? [];

  if (name === "soft_delete_list") {
    const listId = params.p_list_id;
    for (const card of flashcards) {
      if (card.list_id === listId && card.deleted_at == null) card.deleted_at = NOW_ISO;
    }
    for (const list of lists) {
      if (list.id === listId) list.deleted_at = NOW_ISO;
    }
    return { data: { success: true }, error: null };
  }

  if (name === "soft_delete_folder") {
    const folderId = params.p_folder_id;
    const listIds = lists.filter((list) => list.folder_id === folderId).map((list) => list.id);
    for (const card of flashcards) {
      if (listIds.includes(card.list_id) && card.deleted_at == null) card.deleted_at = NOW_ISO;
    }
    for (const list of lists) {
      if (list.folder_id === folderId && list.deleted_at == null) list.deleted_at = NOW_ISO;
    }
    for (const folder of folders) {
      if (folder.id === folderId) folder.deleted_at = NOW_ISO;
    }
    return { data: { success: true }, error: null };
  }

  if (name === "restore_list") {
    const listId = params.p_list_id;
    for (const list of lists) {
      if (list.id === listId) list.deleted_at = null;
    }
    for (const card of flashcards) {
      if (card.list_id === listId && card.deleted_at != null) card.deleted_at = null;
    }
    return { data: { success: true }, error: null };
  }

  if (name === "restore_folder") {
    const folderId = params.p_folder_id;
    const listIds = lists.filter((list) => list.folder_id === folderId).map((list) => list.id);
    for (const folder of folders) {
      if (folder.id === folderId) folder.deleted_at = null;
    }
    for (const list of lists) {
      if (list.folder_id === folderId) list.deleted_at = null;
    }
    for (const card of flashcards) {
      if (listIds.includes(card.list_id)) card.deleted_at = null;
    }
    return { data: { success: true }, error: null };
  }

  return { data: { success: false, error: "UNSUPPORTED_RPC" }, error: null };
}

/** Global counter: generated ids must never collide across fake clients. */
let globalSequence = 0;

function nextGeneratedId(): string {
  globalSequence += 1;
  return "00000000-0000-4000-8000-" + String(globalSequence).padStart(12, "0");
}

export function createFakeClient(
  tables: Record<string, Row[]>,
  options: FakeClientOptions = {},
  calls: RecordedCall[] = [],
): FakeClient {
  function rpc(name: string, params: Record<string, unknown> = {}) {
    calls.push({ operation: "rpc", table: "rpc:" + name, rpcName: name, rpcParams: params });
    const override = options.rpc?.[name];
    if (override) return Promise.resolve(override(params, tables));
    return Promise.resolve(defaultRpc(name, params, tables));
  }

  function from(table: string) {
    const call: FakeQueryCall = {
      table,
      operation: "select",
      countRequested: false,
      head: false,
      filters: [],
      orders: [],
    };
    calls.push(call);
    let insertRows: Row[] = [];
    let upsertRows: Row[] = [];
    let patch: Row | null = null;

    const run = () => {
      const denied = options.deny?.[table];
      if (denied) {
        return { data: null, error: { code: denied.code, message: denied.message, details: null, hint: null }, count: null };
      }

      if (call.operation === "insert") {
        const created = insertRows.map((row) => ({
          ...(TABLE_DEFAULTS[table] ?? {}),
          id: nextGeneratedId(),
          created_at: NOW_ISO,
          updated_at: NOW_ISO,
          deleted_at: null,
          ...row,
        }));
        tables[table] = [...(tables[table] ?? []), ...created];
        for (const row of created) syncEmbeds(table, row, tables);
        return { data: created, error: null, count: created.length };
      }

      if (call.operation === "upsert") {
        const returned: Row[] = [];
        for (const row of upsertRows) {
          const existing = (tables[table] ?? []).find((candidate) => candidate.id === row.id);
          if (existing) {
            Object.assign(existing, row);
            syncEmbeds(table, existing, tables);
            returned.push({ ...existing });
          } else {
            const created = {
              ...(TABLE_DEFAULTS[table] ?? {}),
              id: nextGeneratedId(),
              created_at: NOW_ISO,
              updated_at: NOW_ISO,
              deleted_at: null,
              ...row,
            };
            tables[table] = [...(tables[table] ?? []), created];
            syncEmbeds(table, created, tables);
            returned.push({ ...created });
          }
        }
        return { data: returned, error: null, count: returned.length };
      }

      const matched = (tables[table] ?? []).filter((row) => rowMatches(row, call.filters));
      if (call.operation === "update") {
        if (options.failUpdate) {
          return {
            data: null,
            error: { code: options.failUpdate.code, message: options.failUpdate.message, details: null, hint: null },
            count: null,
          };
        }
        for (const row of matched) {
          Object.assign(row, patch ?? {});
          syncEmbeds(table, row, tables);
        }
        return { data: matched, error: null, count: matched.length };
      }

      const ordered = call.orders.length
        ? [...matched].sort((left, right) => {
            for (const order of call.orders) {
              const comparison = compareValues(
                resolvePath(left, order.column).value,
                resolvePath(right, order.column).value,
              );
              if (comparison !== 0) return order.ascending ? comparison : -comparison;
            }
            return 0;
          })
        : matched;
      const paged = call.range
        ? ordered.slice(call.range[0], call.range[1] + 1)
        : call.limit !== undefined
          ? ordered.slice(0, call.limit)
          : ordered;
      // Reads return copies, like a real HTTP response would, so callers can
      // never mutate the table by holding a previous result.
      return {
        data: call.head ? null : paged.map((row) => ({ ...row })),
        error: null,
        count: call.countRequested || call.head ? matched.length : null,
      };
    };

    const builder = {
      select(columns?: string, opts?: { count?: string; head?: boolean }) {
        call.columns = columns;
        call.countRequested = opts?.count === "exact";
        call.head = opts?.head === true;
        return builder;
      },
      insert(payload: Row | Row[]) {
        call.operation = "insert";
        insertRows = Array.isArray(payload) ? payload : [payload];
        return builder;
      },
      update(values: Row) {
        call.operation = "update";
        patch = values;
        return builder;
      },
      upsert(payload: Row | Row[], _options?: Record<string, unknown>) {
        call.operation = "upsert";
        upsertRows = Array.isArray(payload) ? payload : [payload];
        return builder;
      },
      eq(column: string, value: unknown) {
        call.filters.push({ op: "eq", column, value });
        return builder;
      },
      is(column: string, value: unknown) {
        call.filters.push({ op: "is", column, value });
        return builder;
      },
      in(column: string, value: unknown[]) {
        call.filters.push({ op: "in", column, value });
        return builder;
      },
      ilike(column: string, pattern: string) {
        call.filters.push({ op: "ilike", column, value: pattern });
        return builder;
      },
      not(column: string, operator: string, value: unknown) {
        if (operator === "is" && value === null) {
          call.filters.push({ op: "not_null", column });
        }
        return builder;
      },
      or(expression: string) {
        call.filters.push({ op: "or", value: expression });
        return builder;
      },
      order(column: string, opts?: { ascending?: boolean }) {
        call.orders.push({ column, ascending: opts?.ascending !== false });
        return builder;
      },
      range(from: number, to: number) {
        call.range = [from, to];
        return builder;
      },
      limit(value: number) {
        call.limit = value;
        return builder;
      },
      maybeSingle() {
        const result = run();
        const rows = Array.isArray(result.data) ? result.data : [];
        return Promise.resolve({ data: rows[0] ?? null, error: result.error, count: result.count });
      },
      single() {
        const result = run();
        const rows = Array.isArray(result.data) ? result.data : [];
        return Promise.resolve({ data: rows[0] ?? null, error: result.error, count: result.count });
      },
      then(onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(run()).then(onFulfilled, onRejected);
      },
    };

    return builder;
  }

  return { from, rpc, calls, tables };
}
