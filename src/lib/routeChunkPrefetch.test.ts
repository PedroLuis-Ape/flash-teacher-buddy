import { describe, expect, it, vi } from "vitest";
import { createOneShotPrefetch } from "./routeChunkPrefetch";

describe("createOneShotPrefetch", () => {
  it("runs a successful loader only once", async () => {
    const loader = vi.fn(async () => undefined);
    const prefetch = createOneShotPrefetch(loader);

    prefetch();
    prefetch();
    await Promise.resolve();

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("allows retry after a failed loader", async () => {
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(undefined);
    const prefetch = createOneShotPrefetch(loader);

    prefetch();
    await Promise.resolve();
    await Promise.resolve();
    prefetch();
    await Promise.resolve();

    expect(loader).toHaveBeenCalledTimes(2);
  });
});
