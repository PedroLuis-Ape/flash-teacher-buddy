import { describe, expect, it, vi } from "vitest";
import {
  createStudyProgressOperationId,
  recordStudyProgressAttempt,
  type StudyProgressClient,
} from "./studyProgressRepository";

function createClient(options: {
  rpc?: { data: unknown; error: { code?: string; message?: string } | null };
  responses?: Array<{ data: unknown; error: { code?: string; message?: string } | null }>;
}) {
  const responses = [...(options.responses ?? [])];
  const queries: Array<{
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  }> = [];
  const client: StudyProgressClient = {
    rpc: vi.fn(() => Promise.resolve(options.rpc ?? { data: null, error: null })),
    from: vi.fn(() => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        insert: vi.fn(() => query),
        update: vi.fn(() => query),
        maybeSingle: vi.fn(() => Promise.resolve(responses.shift() ?? { data: null, error: null })),
      };
      queries.push(query);
      return query;
    }),
  };
  return { client, queries };
}

const baseAttempt = {
  userId: "user-1",
  flashcardId: "card-1",
  listId: "list-1",
  correct: true,
};

describe("studyProgressRepository", () => {
  it("generates UUID operation ids for retry-safe writes", () => {
    expect(createStudyProgressOperationId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("uses the atomic RPC and forwards the operation id", async () => {
    const { client } = createClient({
      rpc: { data: { applied: true, duplicate: false }, error: null },
    });

    const result = await recordStudyProgressAttempt({
      ...baseAttempt,
      operationId: "00000000-0000-4000-8000-000000000001",
    }, client);

    expect(result).toEqual({
      operationId: "00000000-0000-4000-8000-000000000001",
      applied: true,
      duplicate: false,
      usedRpc: true,
    });
    expect(client.rpc).toHaveBeenCalledWith("record_flashcard_progress_v1", {
      p_flashcard_id: "card-1",
      p_list_id: "list-1",
      p_correct: true,
      p_operation_id: "00000000-0000-4000-8000-000000000001",
    });
  });

  it("accepts an idempotent duplicate response without falling back", async () => {
    const { client } = createClient({
      rpc: { data: { applied: false, duplicate: true }, error: null },
    });

    await expect(recordStudyProgressAttempt({
      ...baseAttempt,
      operationId: "00000000-0000-4000-8000-000000000002",
    }, client)).resolves.toMatchObject({
      applied: false,
      duplicate: true,
      usedRpc: true,
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("uses the confirmed compatibility update when the RPC is absent", async () => {
    const { client, queries } = createClient({
      rpc: { data: null, error: { code: "PGRST202", message: "function does not exist" } },
      responses: [
        { data: { id: "progress-1", correct_count: 2, incorrect_count: 1 }, error: null },
        { data: { id: "progress-1" }, error: null },
      ],
    });

    const result = await recordStudyProgressAttempt({
      ...baseAttempt,
      correct: false,
      operationId: "00000000-0000-4000-8000-000000000003",
    }, client);

    expect(result).toMatchObject({ applied: true, usedRpc: false, duplicate: false });
    expect(queries[1]?.update).toHaveBeenCalledWith(expect.objectContaining({
      correct_count: 2,
      incorrect_count: 2,
      list_id: "list-1",
    }));
    expect(queries[0]?.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(queries[0]?.eq).toHaveBeenCalledWith("flashcard_id", "card-1");
  });

  it("recovers a unique insert race instead of dropping the attempt", async () => {
    const { client, queries } = createClient({
      rpc: { data: null, error: { code: "PGRST202", message: "record_flashcard_progress_v1 does not exist" } },
      responses: [
        { data: null, error: null },
        { data: null, error: { code: "23505", message: "duplicate key" } },
        { data: { id: "progress-2", correct_count: 4, incorrect_count: 0 }, error: null },
        { data: { id: "progress-2" }, error: null },
      ],
    });

    const result = await recordStudyProgressAttempt({
      ...baseAttempt,
      operationId: "00000000-0000-4000-8000-000000000004",
    }, client);

    expect(result).toMatchObject({ applied: true, usedRpc: false });
    expect(queries[3]?.update).toHaveBeenCalledWith(expect.objectContaining({
      correct_count: 5,
      incorrect_count: 0,
    }));
  });
});
