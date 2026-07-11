import { describe, expect, it, vi } from "vitest";
import { createDedupingFetch } from "./dedupFetch";

describe("createDedupingFetch", () => {
  it("coalesces concurrent GET requests", async () => {
    let resolveFetch!: (response: Response) => void;
    const baseFetch = vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })) as unknown as typeof fetch;
    const wrapped = createDedupingFetch(baseFetch, 1_000, () => 0);

    const first = wrapped("https://example.test/items");
    const second = wrapped("https://example.test/items");
    expect(baseFetch).toHaveBeenCalledTimes(1);

    resolveFetch(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    expect(await (await first).json()).toEqual({ ok: true });
    expect(await (await second).json()).toEqual({ ok: true });
  });

  it("does not coalesce mutation requests", async () => {
    const baseFetch = vi.fn(async () => new Response(null, { status: 204 })) as unknown as typeof fetch;
    const wrapped = createDedupingFetch(baseFetch);

    await Promise.all([
      wrapped("https://example.test/items", { method: "POST" }),
      wrapped("https://example.test/items", { method: "POST" }),
    ]);
    expect(baseFetch).toHaveBeenCalledTimes(2);
  });

  it("reuses a successful GET briefly", async () => {
    let clock = 0;
    const baseFetch = vi.fn(async () => new Response("cached", { status: 200 })) as unknown as typeof fetch;
    const wrapped = createDedupingFetch(baseFetch, 100, () => clock);

    expect(await (await wrapped("https://example.test/items")).text()).toBe("cached");
    clock = 50;
    expect(await (await wrapped("https://example.test/items")).text()).toBe("cached");
    expect(baseFetch).toHaveBeenCalledTimes(1);

    clock = 101;
    await wrapped("https://example.test/items");
    expect(baseFetch).toHaveBeenCalledTimes(2);
  });
});
