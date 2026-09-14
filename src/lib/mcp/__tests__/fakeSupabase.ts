/**
 * Minimal PostgREST-shaped fake used by the MCP domain tests.
 *
 * It filters/orders/paginates rows the same way the domain expects the real
 * client to, records every query built (so a test can assert the ownership and
 * system_kind filters), and can simulate an RLS denial for one table.
 */

type Row = Record<string, unknown>;

export interface FakeFilter {
  op: "eq" | "is" | "in" | "ilike" | "or";
  column?: string;
  value?: unknown;
}

export interface FakeQueryCall {
  table: string;
  columns?: string;
  countRequested: boolean;
  head: boolean;
  filters: FakeFilter[];
  orders: Array<{ column: string; ascending: boolean }>;
  range?: [number, number];
  limit?: number;
}

export interface FakeClientOptions {
  /** Table -> provider error, used to simulate RLS/permission denial. */
  deny?: Record<string, { code: string; message: string }>;
}

export interface FakeClient {
  from(table: string): unknown;
  calls: FakeQueryCall[];
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

export function createFakeClient(
  tables: Record<string, Row[]>,
  options: FakeClientOptions = {},
  calls: FakeQueryCall[] = [],
): FakeClient {
  function from(table: string) {
    const call: FakeQueryCall = {
      table,
      countRequested: false,
      head: false,
      filters: [],
      orders: [],
    };
    calls.push(call);

    const run = () => {
      const denied = options.deny?.[table];
      if (denied) {
        return { data: null, error: { code: denied.code, message: denied.message, details: null, hint: null }, count: null };
      }
      const matched = (tables[table] ?? []).filter((row) => rowMatches(row, call.filters));
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
      return {
        data: call.head ? null : paged,
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

  return { from, calls };
}
