import { describe, expect, it, vi } from "vitest";
import { fetchAllSupabaseRows } from "./fetchAllSupabaseRows";

describe("fetchAllSupabaseRows", () => {
  it("keeps requesting pages until every row is returned", async () => {
    const source = Array.from({ length: 2_505 }, (_, index) => ({ id: index + 1 }));
    const calls: Array<[number, number]> = [];

    const rows = await fetchAllSupabaseRows(async (from, to) => {
      calls.push([from, to]);
      return { data: source.slice(from, to + 1), error: null };
    });

    expect(rows).toHaveLength(2_505);
    expect(rows[0]?.id).toBe(1);
    expect(rows.at(-1)?.id).toBe(2_505);
    expect(calls).toEqual([
      [0, 999],
      [1_000, 1_999],
      [2_000, 2_999],
      [3_000, 3_999],
    ]);
  });

  it("does not treat one thousand as a total limit", async () => {
    const source = Array.from({ length: 1_001 }, (_, index) => index);
    const rows = await fetchAllSupabaseRows(async (from, to) => ({
      data: source.slice(from, to + 1),
      error: null,
    }));

    expect(rows).toEqual(source);
  });

  it("stops immediately for an empty result", async () => {
    let calls = 0;
    const rows = await fetchAllSupabaseRows(async () => {
      calls += 1;
      return { data: [], error: null };
    });

    expect(rows).toEqual([]);
    expect(calls).toBe(1);
  });

  it("loads later ranges in bounded parallel windows and preserves order", async () => {
    const pages = new Map<number, number[]>([
      [0, [0, 1]],
      [2, [2, 3]],
      [4, [4, 5]],
      [6, [6]],
    ]);
    const fetchPage = vi.fn(async (from: number) => ({
      data: pages.get(from) ?? [],
      error: null,
    }));

    await expect(fetchAllSupabaseRows(fetchPage, { pageSize: 2, concurrency: 3 }))
      .resolves.toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(fetchPage.mock.calls.map(([from]) => from)).toEqual([0, 2, 4, 6]);
  });

  it("stops appending after the first short page in a window", async () => {
    const fetchPage = vi.fn(async (from: number) => ({
      data: from === 0 ? [0, 1] : from === 2 ? [2] : [999],
      error: null,
    }));

    await expect(fetchAllSupabaseRows(fetchPage, { pageSize: 2, concurrency: 3 }))
      .resolves.toEqual([0, 1, 2]);
  });

  it("propagates query errors", async () => {
    const failure = new Error("database unavailable");
    await expect(fetchAllSupabaseRows(async () => ({ data: null, error: failure })))
      .rejects.toBe(failure);
  });
});
