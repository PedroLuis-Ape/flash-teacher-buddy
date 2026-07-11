export const SUPABASE_PAGE_SIZE = 1_000;
export const SUPABASE_PAGE_CONCURRENCY = 3;

interface SupabasePage<T> {
  data: T[] | null;
  error: unknown;
}

export interface FetchAllRowsOptions {
  pageSize?: number;
  concurrency?: number;
}

/**
 * Reads every row from a Supabase/PostgREST query without relying on the
 * project's server-side max-rows setting. Callers must provide a stable order.
 *
 * After the first page proves there is more data, subsequent ranges are loaded
 * in small bounded parallel windows. Results are appended in range order, so
 * callers receive the same deterministic array with fewer network round trips.
 */
export async function fetchAllSupabaseRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<SupabasePage<T>>,
  options: FetchAllRowsOptions = {},
): Promise<T[]> {
  const pageSize = Math.max(1, Math.floor(options.pageSize ?? SUPABASE_PAGE_SIZE));
  const concurrency = Math.max(
    1,
    Math.min(6, Math.floor(options.concurrency ?? SUPABASE_PAGE_CONCURRENCY)),
  );

  const firstResult = await fetchPage(0, pageSize - 1);
  if (firstResult.error) throw firstResult.error;

  const firstPage = firstResult.data ?? [];
  const rows: T[] = [...firstPage];
  if (firstPage.length < pageSize) return rows;

  let nextFrom = pageSize;
  while (true) {
    const requests = Array.from({ length: concurrency }, (_, index) => {
      const from = nextFrom + index * pageSize;
      return Promise.resolve(fetchPage(from, from + pageSize - 1));
    });
    const results = await Promise.all(requests);

    let reachedEnd = false;
    for (const result of results) {
      if (result.error) throw result.error;
      const page = result.data ?? [];
      rows.push(...page);
      if (page.length < pageSize) {
        reachedEnd = true;
        break;
      }
    }

    if (reachedEnd) return rows;
    nextFrom += concurrency * pageSize;
  }
}
