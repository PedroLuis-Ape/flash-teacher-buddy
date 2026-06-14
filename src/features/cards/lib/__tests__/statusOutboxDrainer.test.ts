/**
 * Phase 5 — statusDrainer + outbox idempotency.
 *
 * Verifies the contract that protects users from the bugs we are fixing:
 *   1. Replaying the same `operationId` MUST be a no-op on the server (the
 *      RPC enforces this; here we check the client never strips the id).
 *   2. A failing RPC call leaves the op in `failed` state, not silently
 *      discarded. The next drain retries it (idempotent on the server).
 *   3. `drainUser` is mutex-protected: concurrent calls do not double-push.
 *   4. A drain initiated without a session does nothing (skippedNoSession).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---- Mocks --------------------------------------------------------------

type RpcArgs = {
  p_status_group_uid: string;
  p_is_favorite: boolean;
  p_is_red_list: boolean;
  p_operation_id: string;
};

const rpcCalls: RpcArgs[] = [];
let nextRpcResult: { error: { message: string } | null } = { error: null };
let session: { user: { id: string } } | null = { user: { id: "u1" } };

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session } }),
    },
    rpc: async (_name: string, args: RpcArgs) => {
      rpcCalls.push(args);
      return nextRpcResult;
    },
  },
}));

// In-memory replacement for the IndexedDB-backed outbox.
import type { OutboxOp } from "../statusOutbox";
let store: OutboxOp[] = [];

vi.mock("../statusOutbox", () => ({
  listPendingForUser: async (userId: string) =>
    store.filter((o) => o.userId === userId && o.state !== "inflight"),
  markInflight: async (id: string) => {
    const o = store.find((x) => x.operationId === id);
    if (o) { o.state = "inflight"; o.attempts += 1; }
  },
  markSuccess: async (id: string) => {
    store = store.filter((x) => x.operationId !== id);
  },
  markFailed: async (id: string, err: string) => {
    const o = store.find((x) => x.operationId === id);
    if (o) { o.state = "failed"; o.lastError = err; }
  },
}));

import { drainUser } from "../statusDrainer";

function enqueueDirect(op: Partial<OutboxOp> & { operationId: string; userId: string; statusGroupUid: string }) {
  store.push({
    isFavorite: true,
    isRedList: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    state: "pending",
    attempts: 0,
    lastError: null,
    ...op,
  } as OutboxOp);
}

beforeEach(() => {
  rpcCalls.length = 0;
  store = [];
  nextRpcResult = { error: null };
  session = { user: { id: "u1" } };
});

describe("statusDrainer", () => {
  it("calls the RPC once per pending op and removes them on success", async () => {
    enqueueDirect({ operationId: "op-a", userId: "u1", statusGroupUid: "g-1", isFavorite: true });
    enqueueDirect({ operationId: "op-b", userId: "u1", statusGroupUid: "g-2", isFavorite: true, isRedList: true });

    const result = await drainUser("u1");

    expect(result).toMatchObject({ attempted: 2, succeeded: 2, failed: 0, skippedNoSession: false });
    expect(rpcCalls).toHaveLength(2);
    expect(rpcCalls.map((c) => c.p_operation_id).sort()).toEqual(["op-a", "op-b"]);
    expect(store).toHaveLength(0);
  });

  it("preserves the operation in the outbox when the RPC fails", async () => {
    nextRpcResult = { error: { message: "boom" } };
    enqueueDirect({ operationId: "op-x", userId: "u1", statusGroupUid: "g", isFavorite: true });

    const result = await drainUser("u1");

    expect(result.failed).toBe(1);
    expect(store).toHaveLength(1);
    expect(store[0].state).toBe("failed");
    expect(store[0].lastError).toBe("boom");
  });

  it("retries with the same operationId on a second drain (server-side idempotency contract)", async () => {
    nextRpcResult = { error: { message: "transient" } };
    enqueueDirect({ operationId: "op-r", userId: "u1", statusGroupUid: "g", isFavorite: true });
    await drainUser("u1");
    // Manually move it back to pending (statusOutbox.requeueFailed in real code).
    store[0].state = "pending";

    nextRpcResult = { error: null };
    await drainUser("u1");

    expect(rpcCalls).toHaveLength(2);
    expect(rpcCalls[0].p_operation_id).toBe("op-r");
    expect(rpcCalls[1].p_operation_id).toBe("op-r");
    expect(store).toHaveLength(0);
  });

  it("does nothing when there is no session for the requested user", async () => {
    session = null;
    enqueueDirect({ operationId: "op-z", userId: "u1", statusGroupUid: "g", isFavorite: true });

    const result = await drainUser("u1");

    expect(result.skippedNoSession).toBe(true);
    expect(rpcCalls).toHaveLength(0);
    expect(store).toHaveLength(1);
  });

  it("does not drain another user's pending ops", async () => {
    session = { user: { id: "u1" } };
    enqueueDirect({ operationId: "op-other", userId: "u2", statusGroupUid: "g", isFavorite: true });

    const result = await drainUser("u1");

    expect(result.attempted).toBe(0);
    expect(rpcCalls).toHaveLength(0);
    expect(store).toHaveLength(1);
  });

  it("a second concurrent drain returns immediately (mutex)", async () => {
    enqueueDirect({ operationId: "op-c", userId: "u1", statusGroupUid: "g", isFavorite: true });

    const [a, b] = await Promise.all([drainUser("u1"), drainUser("u1")]);

    expect(rpcCalls).toHaveLength(1);
    // exactly one of them did the work; the other was the mutex skip
    const totalAttempted = a.attempted + b.attempted;
    expect(totalAttempted).toBe(1);
  });
});