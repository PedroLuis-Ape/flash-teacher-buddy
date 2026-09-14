import { beforeEach, describe, expect, it, vi } from "vitest";

const clients = vi.hoisted(() => ({
  publicRpc: vi.fn(),
  publicFrom: vi.fn(),
  privateRpc: vi.fn(),
  privateFrom: vi.fn(),
  resolveState: vi.fn(),
}));

vi.mock("@/integrations/supabase/publicClient", () => ({
  publicSupabase: { rpc: clients.publicRpc, from: clients.publicFrom },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: clients.privateRpc, from: clients.privateFrom },
}));

vi.mock("@/features/library/embeddedLists", () => ({
  resolveListEmbeddedState: clients.resolveState,
}));

import {
  fetchStudyDeckPage,
  probeStudyDeckAvailability,
} from "./studyDeckSupabaseGateway";

function builder(response: Record<string, unknown>) {
  const scopes: Array<[string, unknown]> = [];
  const api: any = {
    scopes,
    select: vi.fn(() => api),
    eq: vi.fn((column: string, value: unknown) => {
      scopes.push([column, value]);
      return api;
    }),
    is: vi.fn(() => api),
    order: vi.fn(() => api),
    abortSignal: vi.fn(() => api),
    range: vi.fn(async () => response),
    maybeSingle: vi.fn(async () => response),
  };
  return api;
}

const listContext = {
  resourceId: "embedded-list",
  resourceKind: "list" as const,
  source: "private-rest" as const,
  signal: new AbortController().signal,
};

describe("study deck gateway — embedded lists", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the original flashcard rows for an embedded list", async () => {
    clients.resolveState.mockResolvedValue("embedded");
    const rpc = builder({ data: [{ id: "original-card" }], error: null });
    clients.privateRpc.mockReturnValue(rpc);

    const result = await fetchStudyDeckPage({ ...listContext, from: 0, to: 999 });

    expect(clients.privateRpc).toHaveBeenCalledWith("get_embedded_list_flashcards", {
      _list_id: "embedded-list",
    });
    expect(rpc.range).toHaveBeenCalledWith(0, 999);
    expect(result.data).toEqual([{ id: "original-card" }]);
    expect(clients.privateFrom).not.toHaveBeenCalled();
  });

  it("keeps the normal private path for a normal list", async () => {
    clients.resolveState.mockResolvedValue("normal");
    const flashcards = builder({ data: [{ id: "card" }], error: null });
    clients.privateFrom.mockReturnValue(flashcards);

    await fetchStudyDeckPage({ ...listContext, resourceId: "plain-list", from: 0, to: 999 });

    expect(clients.privateFrom).toHaveBeenCalledWith("flashcards");
    expect(flashcards.scopes).toContainEqual(["list_id", "plain-list"]);
    expect(clients.privateRpc).not.toHaveBeenCalled();
  });

  it("does not classify an embedded list with memberships as empty", async () => {
    clients.resolveState.mockResolvedValue("embedded");
    clients.privateRpc.mockReturnValue(builder({
      data: { resource_exists: true, raw_count: 100, playable_count: 100 },
      error: null,
    }));

    await expect(probeStudyDeckAvailability(listContext)).resolves.toEqual({
      status: "verified",
      resourceExists: true,
      rawCount: 100,
      playableCount: 100,
    });
    expect(clients.privateRpc).toHaveBeenCalledWith("get_embedded_list_card_count", {
      _list_id: "embedded-list",
    });
  });

  it("leaves portal reads untouched", async () => {
    const rpc = builder({ data: [{ id: "portal-card" }], error: null });
    clients.publicRpc.mockReturnValue(rpc);

    await fetchStudyDeckPage({
      ...listContext,
      source: "portal-list-rpc",
      from: 0,
      to: 999,
    });

    expect(clients.publicRpc).toHaveBeenCalledWith("get_portal_flashcards", {
      _list_id: "embedded-list",
    });
    expect(clients.resolveState).not.toHaveBeenCalled();
  });
});
