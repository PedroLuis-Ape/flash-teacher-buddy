import { describe, expect, it, vi } from "vitest";
import {
  loadStudyDeck,
  StudyDeckLoadError,
} from "./studyDeckLoader";

const card = (id: string) => ({
  id,
  term: `term-${id}`,
  translation: `translation-${id}`,
});

describe("loadStudyDeck", () => {
  it("does not expose a transient empty response as an empty deck", async () => {
    let calls = 0;
    const result = await loadStudyDeck({
      requestId: "req-transient",
      resourceKind: "list",
      resourceId: "list-1",
      isPublicList: false,
      hasConfirmedSession: true,
      signal: new AbortController().signal,
      emptyRetryDelaysMs: [0],
      fetchPage: async () => {
        calls += 1;
        return { data: calls === 1 ? [] : [card("card-1")], error: null };
      },
    });

    expect(result.status).toBe("ready");
    expect(result.rawCards.map(({ id }) => id)).toEqual(["card-1"]);
    expect(result.playableCards.map(({ id }) => id)).toEqual(["card-1"]);
    expect(calls).toBe(2);
  });

  it("only reports empty after all confirmations remain empty", async () => {
    const result = await loadStudyDeck({
      requestId: "req-empty",
      resourceKind: "collection",
      resourceId: "collection-1",
      isPublicList: false,
      hasConfirmedSession: true,
      signal: new AbortController().signal,
      emptyRetryDelaysMs: [0, 0],
      fetchPage: async () => ({ data: [], error: null }),
    });

    expect(result.status).toBe("empty");
    expect(result.rawCards).toEqual([]);
    expect(result.playableCards).toEqual([]);
  });

  it("rejects private reads without a confirmed session", async () => {
    const promise = loadStudyDeck({
      requestId: "req-auth",
      resourceKind: "list",
      resourceId: "list-1",
      isPublicList: false,
      hasConfirmedSession: false,
      signal: new AbortController().signal,
      fetchPage: vi.fn(),
    });

    await expect(promise).rejects.toMatchObject<Partial<StudyDeckLoadError>>({
      code: "auth-required",
      requestId: "req-auth",
    });
  });

  it("allows the public list RPC without a session", async () => {
    const result = await loadStudyDeck({
      requestId: "req-public",
      resourceKind: "list",
      resourceId: "list-1",
      isPublicList: true,
      hasConfirmedSession: false,
      signal: new AbortController().signal,
      fetchPage: async () => ({ data: [card("portal-card")], error: null }),
    });

    expect(result.source).toBe("portal-rpc");
    expect(result.status).toBe("ready");
  });

  it("does not turn rows that collapse to no playable cards into a business empty", async () => {
    const resultPromise = loadStudyDeck({
      requestId: "req-invalid",
      resourceKind: "list",
      resourceId: "list-1",
      isPublicList: false,
      hasConfirmedSession: true,
      signal: new AbortController().signal,
      fetchPage: async () => ({ data: [card("parent")], error: null }),
      prepare: () => [],
    });

    await expect(resultPromise).rejects.toMatchObject<Partial<StudyDeckLoadError>>({
      code: "invalid-deck",
      requestId: "req-invalid",
    });
  });
});
