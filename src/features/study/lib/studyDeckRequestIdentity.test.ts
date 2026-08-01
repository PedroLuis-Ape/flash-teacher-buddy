import { describe, expect, it } from "vitest";
import {
  buildStudyDeckRequestContextKey,
  isStudyDeckRequestCurrent,
} from "./studyDeckRequestIdentity";

const context = (overrides: Partial<Parameters<typeof buildStudyDeckRequestContextKey>[0]> = {}) =>
  buildStudyDeckRequestContextKey({
    resourceId: "list-a",
    resourceKind: "list",
    source: "private-rest",
    userId: "user-a",
    ...overrides,
  });

describe("study deck request identity", () => {
  it("accepts only the active generation in the same complete context", () => {
    const key = context();
    expect(isStudyDeckRequestCurrent({
      activeGeneration: 3,
      generation: 3,
      activeContextKey: key,
      contextKey: key,
      signal: new AbortController().signal,
    })).toBe(true);
  });

  it.each([
    ["old generation", 4, 3, context(), context()],
    ["previous list", 3, 3, context({ resourceId: "list-b" }), context()],
    ["previous collection", 3, 3, context({ resourceKind: "collection" }), context()],
    ["previous user", 3, 3, context({ userId: "user-b" }), context()],
    ["previous access source", 3, 3, context({ source: "portal-list-rpc" }), context()],
  ])("rejects a response from the %s", (_label, activeGeneration, generation, activeContextKey, contextKey) => {
    expect(isStudyDeckRequestCurrent({
      activeGeneration,
      generation,
      activeContextKey,
      contextKey,
      signal: new AbortController().signal,
    })).toBe(false);
  });

  it("rejects an aborted request", () => {
    const controller = new AbortController();
    controller.abort();
    const key = context();
    expect(isStudyDeckRequestCurrent({
      activeGeneration: 1,
      generation: 1,
      activeContextKey: key,
      contextKey: key,
      signal: controller.signal,
    })).toBe(false);
  });
});
