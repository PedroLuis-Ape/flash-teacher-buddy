import { supabase } from "@/integrations/supabase/client";
import {
  STUDY_REMOTE_RESTORE_TIMEOUT_MS,
  withStudyRuntimeTimeout,
} from "./studySessionRuntime";

export interface StudyProgressAttempt {
  userId: string;
  flashcardId: string;
  listId: string;
  correct: boolean;
  operationId?: string;
}

export interface StudyProgressWriteResult {
  operationId: string;
  applied: boolean;
  duplicate: boolean;
  usedRpc: boolean;
}

interface ProgressError {
  code?: string;
  message?: string;
}

interface ProgressResponse<T = unknown> {
  data: T | null;
  error: ProgressError | null;
}

interface ProgressRequest<T = unknown> extends PromiseLike<ProgressResponse<T>> {}

interface ProgressQuery extends PromiseLike<ProgressResponse<unknown>> {
  select(columns: string): ProgressQuery;
  eq(column: string, value: unknown): ProgressQuery;
  maybeSingle(): ProgressRequest;
  insert(values: Record<string, unknown>): ProgressQuery;
  update(values: Record<string, unknown>): ProgressQuery;
}

export interface StudyProgressClient {
  rpc(name: string, args: Record<string, unknown>): ProgressRequest;
  from(table: string): ProgressQuery;
}

const defaultClient = supabase as unknown as StudyProgressClient;
const fallbackCompletedOperations = new Map<string, number>();
const FALLBACK_OPERATION_TTL_MS = 10 * 60 * 1000;
const FALLBACK_OPERATION_LIMIT = 512;

function createUuid(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();

  const bytes = new Uint8Array(16);
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

export function createStudyProgressOperationId(): string {
  return createUuid();
}

function isMissingProgressRpcError(error: ProgressError | null): boolean {
  if (!error) return false;
  return error.code === "PGRST202"
    || /record_flashcard_progress_v1|function .* does not exist/i.test(error.message ?? "");
}

function pruneFallbackOperations(now = Date.now()): void {
  for (const [operationId, createdAt] of fallbackCompletedOperations) {
    if (now - createdAt > FALLBACK_OPERATION_TTL_MS) {
      fallbackCompletedOperations.delete(operationId);
    }
  }
  while (fallbackCompletedOperations.size > FALLBACK_OPERATION_LIMIT) {
    const oldest = fallbackCompletedOperations.keys().next().value;
    if (!oldest) break;
    fallbackCompletedOperations.delete(oldest);
  }
}

function rememberFallbackOperation(operationId: string): void {
  const now = Date.now();
  pruneFallbackOperations(now);
  fallbackCompletedOperations.set(operationId, now);
}

function hasRememberedFallbackOperation(operationId: string): boolean {
  pruneFallbackOperations();
  return fallbackCompletedOperations.has(operationId);
}

async function runProgressRequest<T>(
  request: ProgressRequest<T>,
  stage: string,
): Promise<ProgressResponse<T>> {
  return withStudyRuntimeTimeout(
    request,
    STUDY_REMOTE_RESTORE_TIMEOUT_MS,
    stage,
  );
}

async function recordWithCompatibilityFallback(
  attempt: Required<StudyProgressAttempt>,
  client: StudyProgressClient,
): Promise<StudyProgressWriteResult> {
  if (hasRememberedFallbackOperation(attempt.operationId)) {
    return {
      operationId: attempt.operationId,
      applied: false,
      duplicate: true,
      usedRpc: false,
    };
  }

  const readExisting = async () => {
    const response = await runProgressRequest(
      client
        .from("flashcard_progress")
        .select("id, correct_count, incorrect_count")
        .eq("user_id", attempt.userId)
        .eq("flashcard_id", attempt.flashcardId)
        .maybeSingle(),
      "study-progress-fallback-read",
    );
    if (response.error) throw response.error;
    return response.data as {
      id: string;
      correct_count: number;
      incorrect_count: number;
    } | null;
  };

  const updateExisting = async (existing: {
    id: string;
    correct_count: number;
    incorrect_count: number;
  }) => {
    const response = await runProgressRequest(
      client
        .from("flashcard_progress")
        .update({
          correct_count: (existing.correct_count ?? 0) + (attempt.correct ? 1 : 0),
          incorrect_count: (existing.incorrect_count ?? 0) + (attempt.correct ? 0 : 1),
          list_id: attempt.listId,
          last_reviewed: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("user_id", attempt.userId)
        .select("id")
        .maybeSingle(),
      "study-progress-fallback-update",
    );
    if (response.error) throw response.error;
    if (!(response.data as { id?: string } | null)?.id) {
      throw new Error("study-progress-fallback-update-unconfirmed");
    }
  };

  const existing = await readExisting();
  if (existing) {
    await updateExisting(existing);
    rememberFallbackOperation(attempt.operationId);
    return {
      operationId: attempt.operationId,
      applied: true,
      duplicate: false,
      usedRpc: false,
    };
  }

  const inserted = await runProgressRequest(
    client
      .from("flashcard_progress")
      .insert({
        user_id: attempt.userId,
        flashcard_id: attempt.flashcardId,
        list_id: attempt.listId,
        correct_count: attempt.correct ? 1 : 0,
        incorrect_count: attempt.correct ? 0 : 1,
        last_reviewed: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle(),
    "study-progress-fallback-insert",
  );
  if (!inserted.error && (inserted.data as { id?: string } | null)?.id) {
    rememberFallbackOperation(attempt.operationId);
    return {
      operationId: attempt.operationId,
      applied: true,
      duplicate: false,
      usedRpc: false,
    };
  }
  if (inserted.error?.code !== "23505") {
    throw inserted.error ?? new Error("study-progress-fallback-insert-unconfirmed");
  }

  // Another tab may have inserted the unique (user, flashcard) row. Re-read
  // and apply this attempt to that row instead of dropping it.
  const raced = await readExisting();
  if (!raced) throw new Error("study-progress-fallback-race-unconfirmed");
  await updateExisting(raced);
  rememberFallbackOperation(attempt.operationId);
  return {
    operationId: attempt.operationId,
    applied: true,
    duplicate: false,
    usedRpc: false,
  };
}

export async function recordStudyProgressAttempt(
  input: StudyProgressAttempt,
  client: StudyProgressClient = defaultClient,
): Promise<StudyProgressWriteResult> {
  const attempt: Required<StudyProgressAttempt> = {
    ...input,
    operationId: input.operationId ?? createStudyProgressOperationId(),
  };

  const rpcResponse = await runProgressRequest(
    client.rpc("record_flashcard_progress_v1", {
      p_flashcard_id: attempt.flashcardId,
      p_list_id: attempt.listId,
      p_correct: attempt.correct,
      p_operation_id: attempt.operationId,
    }),
    "study-progress-rpc",
  );

  if (!rpcResponse.error) {
    if (rpcResponse.data === null || rpcResponse.data === undefined) {
      throw new Error("study-progress-rpc-unconfirmed");
    }
    const payload = rpcResponse.data as { applied?: boolean; duplicate?: boolean };
    return {
      operationId: attempt.operationId,
      applied: payload.applied !== false,
      duplicate: payload.duplicate === true,
      usedRpc: true,
    };
  }

  if (!isMissingProgressRpcError(rpcResponse.error)) {
    throw rpcResponse.error;
  }

  return recordWithCompatibilityFallback(attempt, client);
}
