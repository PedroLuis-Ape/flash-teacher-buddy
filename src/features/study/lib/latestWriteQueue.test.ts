import { describe, expect, it } from "vitest";
import { createLatestWriteQueue } from "./latestWriteQueue";

describe("createLatestWriteQueue", () => {
  it("serializa e deixa o snapshot mais novo por último", async () => {
    const writes: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstStarted = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const queue = createLatestWriteQueue<{ id: string }>(async (value) => {
      writes.push(value.id);
      if (value.id === "old") await firstStarted;
    });

    const first = queue.enqueue({ id: "old" });
    await Promise.resolve();
    const second = queue.enqueue({ id: "new" });
    releaseFirst?.();
    await Promise.all([first, second]);

    expect(writes).toEqual(["old", "new"]);
  });

  it("descarta uma gravação ainda não iniciada após invalidar a identidade", async () => {
    const writes: string[] = [];
    const queue = createLatestWriteQueue<{ id: string }>((value) => {
      writes.push(value.id);
    });

    const pending = queue.enqueue({ id: "stale" });
    queue.invalidate();
    await pending;

    expect(writes).toEqual([]);
  });

  it("continua processando depois de uma falha", async () => {
    const writes: string[] = [];
    const queue = createLatestWriteQueue<{ id: string }>((value) => {
      writes.push(value.id);
      if (value.id === "bad") throw new Error("network");
    });

    await expect(queue.enqueue({ id: "bad" })).rejects.toThrow("network");
    await queue.enqueue({ id: "good" });

    expect(writes).toEqual(["bad", "good"]);
  });
});
