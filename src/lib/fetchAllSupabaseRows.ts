export const SUPABASE_PAGE_SIZE = 1_000;

interface SupabasePage<T> {
  data: T[] | null;
  error: unknown;
}

export interface FetchAllRowsOptions {
  pageSize?: number;
}

/**
 * Reads every row from a Supabase/PostgREST query without relying on the
 * project's server-side max-rows setting. Callers must provide a stable order.
 */
export async function fetchAllSupabaseRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<SupabasePage<T>>,
  options: FetchAllRowsOptions = {},
): Promise<T[]> {
  const pageSize = Math.max(1, Math.floor(options.pageSize ?? SUPABASE_PAGE_SIZE));
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);

    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}
