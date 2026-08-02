import { describe, expect, it, vi } from "vitest";
import {
  loadStudyDeck,
  StudyDeckLoadError,
  type StudyDeckSource,
} from "./studyDeckLoader";

const card = (id: string) => ({
  id,
  term: `term-${id}`,
  translation: `translation-${id}`,
});

const confirmedZero = async () => ({
  status: "verified" as const,
  resourceExists: true,
  rawCount: 0,
  playableCount: 0,
});

describe("loadStudyDeck", () => {
  it("does not expose a transient empty response as an empty deck", async () => {
    let calls = 0;
    const verifyAvailability = vi.fn(confirmedZero);
    const result = await loadStudyDeck({
      requestId: "req-transient",
      resourceKind: "list",
      resourceId: "list-1",
      source: "private-rest",
      hasConfirmedSession: true,
      signal: new AbortController().signal,
      emptyRetryDelaysMs: [0],
      verifyAvailability,
      fetchPage: async () => {
        calls += 1;
        return { data: calls === 1 ? [] : [card("card-1")], error: null };
      },
    });

    expect(result.status).toBe("ready");
    expect(result.rawCards.map(({ id }) => id)).toEqual(["card-1"]);
    expect(result.playableCards.map(({ id }) => id)).toEqual(["card-1"]);
    expect(calls).toBe(2);
    expect(verifyAvailability).not.toHaveBeenCalled();
  });

  it("only reports confirmed empty after an authoritative zero", async () => {
    const result = await loadStudyDeck({
      requestId: "req-empty",
      resourceKind: "collection",
      resourceId: "collection-1",
      source: "private-rest",
      hasConfirmedSession: true,
      signal: new AbortController().signal,
      emptyRetryDelaysMs: [0, 0],
      verifyAvailability: confirmedZero,
      fetchPage: async () => ({ data: [], error: null }),
    });

    expect(result.status).toBe("confirmed-empty");
    expect(result.rawCards).toEqual([]);
    expect(result.playableCards).toEqual([]);
  });

  it("keeps repeated empty reads unconfirmed when no authority exists", async () => {
    const result = await loadStudyDeck({
      requestId: "req-no-authority",
      resourceKind: "list",
      resourceId: "list-1",
      source: "private-rest",
      hasConfirmedSession: true,
      signal: new AbortController().signal,
      emptyRetryDelaysMs: [0],
      fetchPage: async () => ({ data: [], error: null }),
    });

    expect(result).toMatchObject({
      status: "unconfirmed",
      reason: "verification-unavailable",
    });
  });

  it("keeps a missing public count RPC unconfirmed", async () => {
    const result = await loadStudyDeck({
      requestId: "req-missing-rpc",
      resourceKind: "list",
      resourceId: "list-1",
      source: "portal-list-rpc",
      hasConfirmedSession: false,
      signal: new AbortController().signal,
      emptyRetryDelaysMs: [],
      verifyAvailability: async () => ({
        status: "unconfirmed",
        reason: "verification-unavailable",
      }),
      fetchPage: async () => ({ data: [], error: null }),
    });

    expect(result).toMatchObject({
      status: "unconfirmed",
      reason: "verification-unavailable",
      source: "portal-list-rpc",
    });
  });

  it("performs one clean read when the authority reports cards", async () => {
    let calls = 0;
    const result = await loadStudyDeck({
      requestId: "req-authority-positive",
      resourceKind: "list",
      resourceId: "list-1",
      source: "private-rest",
      hasConfirmedSession: true,
      signal: new AbortController().signal,
      emptyRetryDelaysMs: [],
      verifyAvailability: async () => ({
        status: "verified",
        resourceExists: true,
        rawCount: 1,
      }),
      fetchPage: async () => {
        calls += 1;
        return { data: calls === 1 ? [] : [card("recovered")], error: null };
      },
    });

    expect(result.status).toBe("ready");
    expect(result.playableCards[0]?.id).toBe("recovered");
    expect(calls).toBe(2);
  });

  it("does not loop when the authority sees cards but the clean read remains empty", async () => {
    const fetchPage = vi.fn(async () => ({ data: [], error: null }));
    const result = await loadStudyDeck({
      requestId: "req-inconsistent",
      resourceKind: "list",
      resourceId: "list-1",
      source: "private-rest",
      hasConfirmedSession: true,
      signal: new AbortController().signal,
      emptyRetryDelaysMs: [],
      verifyAvailability: async () => ({
        status: "verified",
        resourceExists: true,
        rawCount: 3,
      }),
      fetchPage,
    });

    expect(result).toMatchObject({
      status: "unconfirmed",
      reason: "cards-present-but-unavailable",
    });
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("rejects private reads without a confirmed session", async () => {
    const promise = loadStudyDeck({
      requestId: "req-auth",
      resourceKind: "list",
      resourceId: "list-1",
      source: "private-rest",
      hasConfirmedSession: false,
      signal: new AbortController().signal,
      fetchPage: vi.fn(),
    });

    await expect(promise).rejects.toMatchObject({
      code: "auth-required",
      requestId: "req-auth",
    });
  });

  it.each([
    ["portal-list-rpc", "list"],
    ["portal-collection-rest", "collection"],
  ] as const)("allows %s without a private session", async (source, resourceKind) => {
    const result = await loadStudyDeck({
      requestId: `req-${source}`,
      resourceKind,
      resourceId: "public-resource",
      source,
      hasConfirmedSession: false,
      signal: new AbortController().signal,
      fetchPage: async () => ({ data: [card("portal-card")], error: null }),
    });

    expect(result.source).toBe(source);
    expect(result.status).toBe("ready");
  });

  it("does not turn rows that collapse to no playable cards into a business empty", async () => {
    const result = await loadStudyDeck({
      requestId: "req-invalid",
      resourceKind: "list",
      resourceId: "list-1",
      source: "private-rest",
      hasConfirmedSession: true,
      signal: new AbortController().signal,
      fetchPage: async () => ({ data: [card("parent")], error: null }),
      prepare: () => [],
    });

    expect(result).toMatchObject({
      status: "unconfirmed",
      reason: "invalid-deck",
      requestId: "req-invalid",
    });
  });

  it("stops immediately when the request is cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(loadStudyDeck({
      requestId: "req-abort",
      resourceKind: "list",
      resourceId: "list-1",
      source: "private-rest",
      hasConfirmedSession: true,
      signal: controller.signal,
      fetchPage: vi.fn(),
    })).rejects.toMatchObject({ name: "AbortError" });
  });

  it.each([
    ["private list", "private-rest", "list", true],
    ["private collection", "private-rest", "collection", true],
    ["public list anonymous", "portal-list-rpc", "list", false],
    ["public list authenticated browser", "portal-list-rpc", "list", true],
    ["public collection anonymous", "portal-collection-rest", "collection", false],
  ] as const)(
    "survives 20 repeated delayed first reads for %s",
    async (_label, source: StudyDeckSource, resourceKind, hasConfirmedSession) => {
      for (let run = 0; run < 20; run += 1) {
        let calls = 0;
        const result = await loadStudyDeck({
          requestId: `${source}-${run}`,
          resourceKind,
          resourceId: "list-repeat",
          source,
          hasConfirmedSession,
          signal: new AbortController().signal,
          emptyRetryDelaysMs: [0],
          verifyAvailability: confirmedZero,
          fetchPage: async () => {
            calls += 1;
            await Promise.resolve();
            return { data: calls === 1 ? [] : [card(`card-${run}`)], error: null };
          },
        });
        expect(result.status).toBe("ready");
        expect(result.playableCards[0]?.id).toBe(`card-${run}`);
      }
    },
  );

  it.each([
    ["network", new Error("Failed to fetch")],
    ["RLS", { code: "42501", message: "permission denied" }],
  ])("propagates %s read failures instead of returning confirmed empty", async (_label, error) => {
    await expect(loadStudyDeck({
      requestId: "req-read-error",
      resourceKind: "list",
      resourceId: "list-1",
      source: "private-rest",
      hasConfirmedSession: true,
      signal: new AbortController().signal,
      fetchPage: async () => ({ data: null, error }),
    })).rejects.toBe(error);
  });

  it("cancels while the authority verification is pending", async () => {
    const controller = new AbortController();
    const pending = loadStudyDeck({
      requestId: "req-abort-authority",
      resourceKind: "list",
      resourceId: "list-1",
      source: "private-rest",
      hasConfirmedSession: true,
      signal: controller.signal,
      emptyRetryDelaysMs: [],
      fetchPage: async () => ({ data: [], error: null }),
      verifyAvailability: () => new Promise((_resolve, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
      }),
    });

    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
