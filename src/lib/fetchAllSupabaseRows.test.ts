import { describe, expect, it } from "vitest";
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

  it("propagates query errors", async () => {
    const failure = new Error("database unavailable");
    await expect(fetchAllSupabaseRows(async () => ({ data: null, error: failure })))
      .rejects.toBe(failure);
  });
});
