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

  it("invalidates cached GET responses when a mutation starts", async () => {
    let reads = 0;
    const baseFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET").toUpperCase() !== "GET") {
        return new Response(null, { status: 204 });
      }
      reads += 1;
      return new Response(reads === 1 ? "before" : "after", { status: 200 });
    }) as unknown as typeof fetch;
    const wrapped = createDedupingFetch(baseFetch, 1_000, () => 0);

    expect(await (await wrapped("https://example.test/items")).text()).toBe("before");
    await wrapped("https://example.test/items", { method: "PATCH" });
    expect(await (await wrapped("https://example.test/items")).text()).toBe("after");
    expect(baseFetch).toHaveBeenCalledTimes(3);
  });

  it("does not let an older in-flight GET repopulate cache after a mutation", async () => {
    let resolveOld!: (response: Response) => void;
    let call = 0;
    const baseFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      call += 1;
      if ((init?.method ?? "GET").toUpperCase() !== "GET") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (call === 1) {
        return new Promise<Response>((resolve) => { resolveOld = resolve; });
      }
      return Promise.resolve(new Response("fresh", { status: 200 }));
    }) as unknown as typeof fetch;
    const wrapped = createDedupingFetch(baseFetch, 1_000, () => 0);

    const oldRead = wrapped("https://example.test/items");
    await wrapped("https://example.test/items", { method: "POST" });
    expect(await (await wrapped("https://example.test/items")).text()).toBe("fresh");

    resolveOld(new Response("stale", { status: 200 }));
    expect(await (await oldRead).text()).toBe("stale");
    expect(await (await wrapped("https://example.test/items")).text()).toBe("fresh");
    expect(baseFetch).toHaveBeenCalledTimes(3);
  });
});
