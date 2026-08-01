import { describe, expect, it, vi } from "vitest";
import {
  createStudyDeckCountReader,
  resolveStudyDeckEmptyState,
} from "./studyDeckEmptyVerification";
import type { StudyDeckLoadResult } from "./studyDeckLoader";

type Card = { id: string; term: string; translation: string };

const card = (id: string): Card => ({ id, term: `t-${id}`, translation: `x-${id}` });

const readyDeck = (ids: string[]): StudyDeckLoadResult<Card> => ({
  status: "ready",
  requestId: "req-reread",
  source: "private-rest",
  rawCards: ids.map(card),
  playableCards: ids.map(card),
});

const emptyDeck = (): StudyDeckLoadResult<Card> => ({
  status: "empty",
  requestId: "req-reread",
  source: "private-rest",
  rawCards: [],
  playableCards: [],
});

const base = (overrides: Partial<Parameters<typeof resolveStudyDeckEmptyState<Card>>[0]> = {}) => ({
  requestId: "req-1",
  resourceKind: "list" as const,
  source: "private-rest" as const,
  hasConfirmedSession: true,
  signal: new AbortController().signal,
  rereadDelayMs: 0,
  countCards: async () => ({ count: 0, error: null }),
  rereadDeck: async () => emptyDeck(),
  ...overrides,
});

describe("resolveStudyDeckEmptyState", () => {
  it("rereads with the current credential when the count proves cards exist", async () => {
    const rereadDeck = vi.fn(async () => readyDeck(["a", "b"]));
    const result = await resolveStudyDeckEmptyState<Card>(base({
      countCards: async () => ({ count: 2, error: null }),
      rereadDeck,
    }));

    expect(result.state).toBe("cards-present");
    expect(rereadDeck).toHaveBeenCalledTimes(1);
    if (result.state === "cards-present") {
      expect(result.deck.playableCards).toHaveLength(2);
    }
  });

  it("confirms empty only when the authoritative count is zero", async () => {
    const result = await resolveStudyDeckEmptyState<Card>(base());
    expect(result.state).toBe("confirmed-empty");
  });

  it("stays unconfirmed on auth/RLS/network errors", async () => {
    const result = await resolveStudyDeckEmptyState<Card>(base({
      countCards: async () => ({ count: null, error: { code: "42501" } }),
    }));
    expect(result.state).toBe("empty-unconfirmed");
    if (result.state === "empty-unconfirmed") {
      expect(result.reason).toBe("count-failed");
      expect(result.technicalId).toBe("ST-EMPTY/req-1/private-rest/list/count-failed");
    }
  });

  it("stays unconfirmed when the count throws (timeout/network)", async () => {
    const result = await resolveStudyDeckEmptyState<Card>(base({
      countCards: async () => { throw new Error("network"); },
    }));
    expect(result.state).toBe("empty-unconfirmed");
  });

  it("never confirms empty for a private resource without a session", async () => {
    const countCards = vi.fn();
    const result = await resolveStudyDeckEmptyState<Card>(base({
      hasConfirmedSession: false,
      countCards: countCards as never,
    }));
    expect(result.state).toBe("empty-unconfirmed");
    expect(countCards).not.toHaveBeenCalled();
  });

  it("allows the public portal RPC without a session", async () => {
    const result = await resolveStudyDeckEmptyState<Card>(base({
      source: "portal-rpc",
      hasConfirmedSession: false,
      countCards: async () => ({ count: 3, error: null }),
      rereadDeck: async () => readyDeck(["p1"]),
    }));
    expect(result.state).toBe("cards-present");
  });

  it("stays unconfirmed when the count and the reread disagree", async () => {
    const result = await resolveStudyDeckEmptyState<Card>(base({
      countCards: async () => ({ count: 5, error: null }),
      rereadDeck: async () => emptyDeck(),
    }));
    expect(result.state).toBe("empty-unconfirmed");
    if (result.state === "empty-unconfirmed") {
      expect(result.reason).toBe("count-mismatch");
    }
  });

  it("discards a stale generation result instead of showing empty", async () => {
    let current = true;
    const result = await resolveStudyDeckEmptyState<Card>(base({
      countCards: async () => {
        current = false;
        return { count: 0, error: null };
      },
      isCurrentGeneration: () => current,
    }));
    expect(result.state).toBe("cancelled");
  });

  it("reports cancellation when the request is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await resolveStudyDeckEmptyState<Card>(base({ signal: controller.signal }));
    expect(result.state).toBe("cancelled");
  });

  it("keeps layered decks playable after the reread", async () => {
    const layered: StudyDeckLoadResult<Card> = {
      ...readyDeck(["parent"]),
      playableCards: [{ ...card("layer-1") }],
    };
    const result = await resolveStudyDeckEmptyState<Card>(base({
      countCards: async () => ({ count: 4, error: null }),
      rereadDeck: async () => layered,
    }));
    expect(result.state).toBe("cards-present");
  });
});

describe("createStudyDeckCountReader", () => {
  it("counts a private resource through the REST scope", async () => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      is: vi.fn(() => chain),
      abortSignal: vi.fn(async () => ({ count: 7, error: null })),
    };
    const client = { from: vi.fn(() => chain), rpc: vi.fn() };
    const read = createStudyDeckCountReader({
      client: client as never,
      isPublicList: false,
      resourceId: "list-1",
      queryColumn: "list_id",
      signal: new AbortController().signal,
    });

    await expect(read()).resolves.toEqual({ count: 7, error: null });
    expect(client.from).toHaveBeenCalledWith("flashcards");
    expect(chain.eq).toHaveBeenCalledWith("list_id", "list-1");
  });

  it("counts a collection through the REST scope", async () => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      is: vi.fn(() => chain),
      abortSignal: vi.fn(async () => ({ count: 0, error: null })),
    };
    const client = { from: vi.fn(() => chain), rpc: vi.fn() };
    const read = createStudyDeckCountReader({
      client: client as never,
      isPublicList: false,
      resourceId: "col-1",
      queryColumn: "collection_id",
      signal: new AbortController().signal,
    });

    await expect(read()).resolves.toEqual({ count: 0, error: null });
    expect(chain.eq).toHaveBeenCalledWith("collection_id", "col-1");
  });

  it("counts a public list through the portal RPC (POST)", async () => {
    const chain: any = { abortSignal: vi.fn(async () => ({ data: [card("a"), card("b")], error: null })) };
    const client = { from: vi.fn(), rpc: vi.fn(() => chain) };
    const read = createStudyDeckCountReader({
      client: client as never,
      isPublicList: true,
      resourceId: "list-9",
      queryColumn: "list_id",
      signal: new AbortController().signal,
    });

    await expect(read()).resolves.toEqual({ count: 2, error: null });
    expect(client.rpc).toHaveBeenCalledWith("get_portal_flashcards", { _list_id: "list-9" });
  });

  it("surfaces a portal RPC error instead of a zero count", async () => {
    const chain: any = { abortSignal: vi.fn(async () => ({ data: null, error: { message: "rpc down" } })) };
    const client = { from: vi.fn(), rpc: vi.fn(() => chain) };
    const read = createStudyDeckCountReader({
      client: client as never,
      isPublicList: true,
      resourceId: "list-9",
      queryColumn: "list_id",
      signal: new AbortController().signal,
    });

    const result = await read();
    expect(result.count).toBeNull();
    expect(result.error).toBeTruthy();
  });
});