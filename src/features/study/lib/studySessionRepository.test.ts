import { describe, expect, it, vi } from "vitest";
import {
  claimStudySession,
  type StudySessionClient,
} from "./studySessionRepository";
import { StudyRuntimeTimeoutError } from "./studySessionRuntime";

function createRequest<T>(response: { data: T | null; error: { code?: string; message?: string } | null }) {
  const request = Promise.resolve(response) as unknown as PromiseLike<typeof response> & {
    abortSignal: ReturnType<typeof vi.fn>;
  };
  request.abortSignal = vi.fn(() => request);
  return request;
}

function createClient(options: {
  rpc: { data: unknown; error: { code?: string; message?: string } | null };
  insert?: { data: unknown; error: { code?: string; message?: string } | null };
}) {
  const query = {
    insert: vi.fn(() => query),
    select: vi.fn(() => query),
    abortSignal: vi.fn(() => query),
    single: vi.fn(() => createRequest(options.insert ?? { data: null, error: null })),
  };
  const client = {
    rpc: vi.fn(() => createRequest(options.rpc)),
    from: vi.fn(() => query),
  } as unknown as StudySessionClient;
  return { client, query };
}

const baseInput = {
  userId: "user-1",
  listId: "list-1",
  mode: "mixed-adaptive",
  sessionScopeKey: "study-session-v2:scope",
  currentIndex: 0,
  cardsOrder: ["card-1"],
  settingsSnapshot: { mode: "mixed" },
  sessionSnapshot: { currentIndex: 0 },
};

describe("studySessionRepository", () => {
  it("uses the atomic claim RPC and returns an existing session without inserting", async () => {
    const { client } = createClient({
      rpc: {
        data: { created: false, session: { id: "session-existing" } },
        error: null,
      },
    });

    await expect(claimStudySession(baseInput, client)).resolves.toEqual({
      id: "session-existing",
      created: false,
      usedRpc: true,
    });
    expect(client.rpc).toHaveBeenCalledWith("claim_study_session_v1", expect.objectContaining({
      p_list_id: "list-1",
      p_mode: "mixed-adaptive",
      p_session_scope_key: "study-session-v2:scope",
    }));
    expect(client.from).not.toHaveBeenCalled();
  });

  it("keeps the confirmed direct insert only when the additive RPC is missing", async () => {
    const { client, query } = createClient({
      rpc: { data: null, error: { code: "PGRST202", message: "function does not exist" } },
      insert: { data: { id: "session-created" }, error: null },
    });

    await expect(claimStudySession(baseInput, client)).resolves.toEqual({
      id: "session-created",
      created: true,
      usedRpc: false,
    });
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-1",
      list_id: "list-1",
      completed: false,
    }));
  });

  it("does not hide non-missing-RPC errors", async () => {
    const { client } = createClient({
      rpc: { data: null, error: { code: "42501", message: "study_access_denied" } },
    });

    await expect(claimStudySession(baseInput, client)).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("aborts the underlying request when the claim timeout fires", async () => {
    vi.useFakeTimers();
    try {
      let capturedSignal: AbortSignal | undefined;
      const pending = new Promise<never>(() => undefined) as unknown as PromiseLike<{
        data: unknown;
        error: null;
      }> & { abortSignal(signal: AbortSignal): typeof pending };
      pending.abortSignal = vi.fn((signal: AbortSignal) => {
        capturedSignal = signal;
        return pending;
      });
      const client: StudySessionClient = {
        rpc: vi.fn(() => pending),
        from: vi.fn(() => {
          throw new Error("fallback should not run after timeout");
        }),
      };

      const claim = claimStudySession(baseInput, client);
      const timeoutAssertion = expect(claim).rejects.toBeInstanceOf(StudyRuntimeTimeoutError);
      await vi.advanceTimersByTimeAsync(2_500);
      await timeoutAssertion;
      expect(capturedSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
