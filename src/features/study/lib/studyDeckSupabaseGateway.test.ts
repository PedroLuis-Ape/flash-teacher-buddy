import { beforeEach, describe, expect, it, vi } from "vitest";

const clients = vi.hoisted(() => ({
  publicRpc: vi.fn(),
  publicFrom: vi.fn(),
  privateFrom: vi.fn(),
}));

vi.mock("@/integrations/supabase/publicClient", () => ({
  publicSupabase: {
    rpc: clients.publicRpc,
    from: clients.publicFrom,
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: clients.privateFrom },
}));

import {
  fetchStudyDeckPage,
  probeStudyDeckAvailability,
} from "./studyDeckSupabaseGateway";

function queryBuilder(response: Record<string, unknown>) {
  const scopes: Array<[string, unknown]> = [];
  const builder: any = {
    scopes,
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      scopes.push([column, value]);
      return builder;
    }),
    is: vi.fn(() => builder),
    order: vi.fn(() => builder),
    abortSignal: vi.fn(() => builder),
    range: vi.fn(async () => response),
    maybeSingle: vi.fn(async () => response),
    then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) =>
      Promise.resolve(response).then(resolve, reject),
  };
  return builder;
}

describe("study deck Supabase gateway", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps public list reads on the public RPC contract", async () => {
    const rpc = queryBuilder({ data: [{ id: "card-1" }], error: null });
    clients.publicRpc.mockReturnValue(rpc);

    const result = await fetchStudyDeckPage<{ id: string }>({
      resourceId: "list-public",
      resourceKind: "list",
      source: "portal-list-rpc",
      signal: new AbortController().signal,
      from: 0,
      to: 999,
    });

    expect(clients.publicRpc).toHaveBeenCalledWith("get_portal_flashcards", {
      _list_id: "list-public",
    });
    expect(rpc.range).toHaveBeenCalledWith(0, 999);
    expect(result.data).toEqual([{ id: "card-1" }]);
    expect(clients.privateFrom).not.toHaveBeenCalled();
  });

  it("uses collection_id rather than list_id for collection reads", async () => {
    const flashcards = queryBuilder({ data: [{ id: "collection-card" }], error: null });
    clients.privateFrom.mockReturnValue(flashcards);

    await fetchStudyDeckPage({
      resourceId: "collection-a",
      resourceKind: "collection",
      source: "private-rest",
      signal: new AbortController().signal,
      from: 0,
      to: 999,
    });

    expect(clients.privateFrom).toHaveBeenCalledWith("flashcards");
    expect(flashcards.scopes).toContainEqual(["collection_id", "collection-a"]);
    expect(flashcards.scopes.some(([column]) => column === "list_id")).toBe(false);
  });

  it("does not turn a missing public count RPC into zero", async () => {
    clients.publicRpc.mockReturnValue(queryBuilder({
      data: null,
      error: { code: "PGRST202", message: "function not found" },
    }));

    await expect(probeStudyDeckAvailability({
      resourceId: "list-public",
      resourceKind: "list",
      source: "portal-list-rpc",
      signal: new AbortController().signal,
    })).resolves.toEqual({
      status: "unconfirmed",
      reason: "verification-unavailable",
    });
  });

  it("does not turn a private RLS denial into zero", async () => {
    clients.privateFrom.mockReturnValue(queryBuilder({
      data: null,
      error: { code: "42501", message: "permission denied" },
    }));

    await expect(probeStudyDeckAvailability({
      resourceId: "list-private",
      resourceKind: "list",
      source: "private-rest",
      signal: new AbortController().signal,
    })).resolves.toEqual({
      status: "unconfirmed",
      reason: "auth-or-access",
    });
  });
});
