import { afterEach, describe, expect, it, vi } from "vitest";
import { createDedupingFetch } from "./dedupFetch";

const jsonResponse = (value: unknown) => new Response(JSON.stringify(value), {
  status: 200,
  headers: { "content-type": "application/json; charset=utf-8" },
});

function requestFrom(input: RequestInfo | URL, init?: RequestInit): Request {
  return input instanceof Request ? input : new Request(input, init);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

  it("recovers automatically when the first flashcard read is transiently empty", async () => {
    let calls = 0;
    const baseFetch = vi.fn(async () => {
      calls += 1;
      return calls === 1 ? jsonResponse([]) : jsonResponse([{ id: "card-1" }]);
    }) as unknown as typeof fetch;
    const wrapped = createDedupingFetch(baseFetch, 1_000, () => 0, [0]);

    const response = await wrapped("https://project.supabase.co/rest/v1/flashcards?list_id=eq.list-1");

    expect(await response.json()).toEqual([{ id: "card-1" }]);
    expect(baseFetch).toHaveBeenCalledTimes(2);
  });

  it("recovers the real POST-based portal flashcard RPC and preserves its body", async () => {
    let calls = 0;
    const seenMethods: string[] = [];
    const seenBodies: string[] = [];
    const baseFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = requestFrom(input, init);
      seenMethods.push(request.method);
      seenBodies.push(await request.clone().text());
      calls += 1;
      return calls === 1 ? jsonResponse([]) : jsonResponse([{ id: "portal-card" }]);
    }) as unknown as typeof fetch;
    const wrapped = createDedupingFetch(baseFetch, 1_000, () => 0, [0]);

    const response = await wrapped(
      "https://project.supabase.co/rest/v1/rpc/get_portal_flashcards",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ _list_id: "list-1" }),
      },
    );

    expect(await response.json()).toEqual([{ id: "portal-card" }]);
    expect(baseFetch).toHaveBeenCalledTimes(2);
    expect(seenMethods).toEqual(["POST", "POST"]);
    expect(seenBodies).toEqual([
      JSON.stringify({ _list_id: "list-1" }),
      JSON.stringify({ _list_id: "list-1" }),
    ]);
  });

  it("rebuilds a retry with the newest persisted access token", async () => {
    const storage = new Map<string, string>();
    const storageApi = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
      key: (index: number) => Array.from(storage.keys())[index] ?? null,
      get length() { return storage.size; },
    };
    vi.stubGlobal("localStorage", storageApi);
    vi.spyOn(Date, "now").mockReturnValue(1_000);

    storage.set("sb-project-auth-token", JSON.stringify({
      access_token: "token-one",
      expires_at: 10_000,
    }));

    const seenAuthorization: Array<string | null> = [];
    let calls = 0;
    const baseFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = requestFrom(input, init);
      seenAuthorization.push(request.headers.get("authorization"));
      calls += 1;
      if (calls === 1) {
        storage.set("sb-project-auth-token", JSON.stringify({
          access_token: "token-two",
          expires_at: 10_000,
        }));
        return jsonResponse([]);
      }
      return jsonResponse([{ id: "card-after-refresh" }]);
    }) as unknown as typeof fetch;
    const wrapped = createDedupingFetch(baseFetch, 1_000, () => 0, [0]);

    const response = await wrapped(
      "https://project.supabase.co/rest/v1/flashcards?list_id=eq.list-1",
      { headers: { authorization: "Bearer token-one" } },
    );

    expect(await response.json()).toEqual([{ id: "card-after-refresh" }]);
    expect(seenAuthorization).toEqual(["Bearer token-one", "Bearer token-two"]);
  });

  it("does not share in-flight flashcard reads between separate study launches", async () => {
    const baseFetch = vi.fn(async () => jsonResponse([{ id: "card" }])) as unknown as typeof fetch;
    const wrapped = createDedupingFetch(baseFetch, 1_000, () => 0, []);
    const url = "https://project.supabase.co/rest/v1/flashcards?list_id=eq.list-1";

    await Promise.all([wrapped(url), wrapped(url)]);

    expect(baseFetch).toHaveBeenCalledTimes(2);
  });

  it("does not cache a confirmed empty flashcard response", async () => {
    const baseFetch = vi.fn(async () => jsonResponse([])) as unknown as typeof fetch;
    const wrapped = createDedupingFetch(baseFetch, 1_000, () => 0, []);
    const url = "https://project.supabase.co/rest/v1/flashcards?list_id=eq.empty-list";

    expect(await (await wrapped(url)).json()).toEqual([]);
    expect(await (await wrapped(url)).json()).toEqual([]);
    expect(baseFetch).toHaveBeenCalledTimes(2);
  });
});
