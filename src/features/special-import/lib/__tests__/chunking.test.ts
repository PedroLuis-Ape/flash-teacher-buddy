import { describe, it, expect } from "vitest";
import { chunk, runInBatches, yieldToMain } from "../chunking";

describe("chunking", () => {
  it("splits arrays into fixed-size groups", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("handles empty input", () => {
    expect(chunk([], 10)).toEqual([]);
  });
  it("rejects invalid size", () => {
    expect(() => chunk([1], 0)).toThrow();
  });
  it("yieldToMain resolves", async () => {
    await expect(yieldToMain()).resolves.toBeUndefined();
  });
  it("runs batches in order and reports progress", async () => {
    const items = Array.from({ length: 250 }, (_, i) => i);
    const seenBatches: number[] = [];
    const progress: number[] = [];
    const results = await runInBatches(
      items,
      50,
      async (batch, info) => {
        seenBatches.push(batch.length);
        return info.batchIndex;
      },
      { onProgress: (p) => progress.push(p.processed) }
    );
    expect(seenBatches).toEqual([50, 50, 50, 50, 50]);
    expect(results).toEqual([0, 1, 2, 3, 4]);
    expect(progress[progress.length - 1]).toBe(250);
  });
  it("cancels between batches via AbortSignal", async () => {
    const items = Array.from({ length: 200 }, (_, i) => i);
    const ctrl = new AbortController();
    let calls = 0;
    await runInBatches(
      items,
      50,
      async () => {
        calls++;
        if (calls === 2) ctrl.abort();
        return calls;
      },
      { signal: ctrl.signal }
    );
    expect(calls).toBe(2);
  });
});