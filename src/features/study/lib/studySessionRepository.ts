import { supabase } from "@/integrations/supabase/client";
import {
  STUDY_REMOTE_RESTORE_TIMEOUT_MS,
  withStudyRuntimeTimeout,
} from "./studySessionRuntime";

interface StudySessionError {
  code?: string;
  message?: string;
}

interface StudySessionResponse<T = unknown> {
  data: T | null;
  error: StudySessionError | null;
}

interface StudySessionRequest<T = unknown> extends PromiseLike<StudySessionResponse<T>> {
  abortSignal(signal: AbortSignal): StudySessionRequest<T>;
}

interface StudySessionQuery extends StudySessionRequest {
  insert(values: Record<string, unknown>): StudySessionQuery;
  select(columns: string): StudySessionQuery;
  single(): StudySessionRequest;
}

export interface StudySessionClient {
  rpc(name: string, args: Record<string, unknown>): StudySessionRequest;
  from(table: string): StudySessionQuery;
}

export interface ClaimStudySessionInput {
  userId: string;
  listId: string;
  mode: string;
  sessionScopeKey: string;
  currentIndex: number;
  cardsOrder: unknown[];
  settingsSnapshot: unknown;
  sessionSnapshot: unknown;
  schemaVersion?: number;
  signal?: AbortSignal;
  stage?: string;
}

export interface StudySessionClaimResult {
  id: string;
  created: boolean;
  usedRpc: boolean;
}

const defaultClient = supabase as unknown as StudySessionClient;

interface AbortBinding {
  signal: AbortSignal;
  abort(): void;
  dispose(): void;
}

function bindAbortSignal(parentSignal?: AbortSignal): AbortBinding {
  const controller = new AbortController();
  if (!parentSignal) {
    return {
      signal: controller.signal,
      abort: () => controller.abort(),
      dispose: () => undefined,
    };
  }

  const forwardAbort = () => controller.abort(parentSignal.reason);
  if (parentSignal.aborted) {
    forwardAbort();
  } else {
    parentSignal.addEventListener("abort", forwardAbort, { once: true });
  }

  return {
    signal: controller.signal,
    abort: () => controller.abort(),
    dispose: () => parentSignal.removeEventListener("abort", forwardAbort),
  };
}

function isMissingClaimRpcError(error: StudySessionError | null): boolean {
  if (!error) return false;
  return error.code === "PGRST202"
    || /claim_study_session_v1|function .* does not exist/i.test(error.message ?? "");
}

async function runSessionRequest<T>(
  request: StudySessionRequest<T>,
  stage: string,
  onTimeout?: () => void,
): Promise<StudySessionResponse<T>> {
  return withStudyRuntimeTimeout(
    request,
    STUDY_REMOTE_RESTORE_TIMEOUT_MS,
    stage,
    onTimeout,
  );
}

function getClaimedSessionId(data: unknown): { id: string; created: boolean } | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const payload = data as {
    created?: unknown;
    session?: { id?: unknown };
  };
  const id = payload.session?.id;
  return typeof id === "string" && id.length > 0
    ? { id, created: payload.created === true }
    : null;
}

async function insertWithCompatibilityFallback(
  input: ClaimStudySessionInput,
  client: StudySessionClient,
): Promise<StudySessionClaimResult> {
  const stage = input.stage ?? "study-session-create-fallback";
  const abortBinding = bindAbortSignal(input.signal);
  try {
    const response = await runSessionRequest(
      client
        .from("study_sessions")
        .insert({
          user_id: input.userId,
          list_id: input.listId,
          mode: input.mode,
          current_index: input.currentIndex,
          cards_order: input.cardsOrder,
          session_scope_key: input.sessionScopeKey,
          settings_snapshot: input.settingsSnapshot,
          session_snapshot: input.sessionSnapshot,
          schema_version: input.schemaVersion ?? 1,
          completed: false,
        })
        .select("id")
        .abortSignal(abortBinding.signal)
        .single(),
      stage,
      abortBinding.abort,
    );
    if (response.error) throw response.error;
    const id = (response.data as { id?: unknown } | null)?.id;
    if (typeof id !== "string" || id.length === 0) {
      throw new Error(`${stage}-unconfirmed`);
    }
    return { id, created: true, usedRpc: false };
  } finally {
    abortBinding.dispose();
  }
}

/**
 * Claims one open session per user/list/mode/scope when the additive RPC is
 * installed. The direct insert is deliberately retained only for older
 * environments while they are waiting for the migration; it is not the
 * concurrency guarantee for the supported schema.
 */
export async function claimStudySession(
  input: ClaimStudySessionInput,
  client: StudySessionClient = defaultClient,
): Promise<StudySessionClaimResult> {
  const abortBinding = bindAbortSignal(input.signal);
  let response: StudySessionResponse;
  try {
    response = await runSessionRequest(
      client.rpc("claim_study_session_v1", {
        p_list_id: input.listId,
        p_mode: input.mode,
        p_session_scope_key: input.sessionScopeKey,
        p_current_index: input.currentIndex,
        p_cards_order: input.cardsOrder,
        p_settings_snapshot: input.settingsSnapshot,
        p_session_snapshot: input.sessionSnapshot,
        p_schema_version: input.schemaVersion ?? 1,
      }).abortSignal(abortBinding.signal),
      input.stage ?? "study-session-claim",
      abortBinding.abort,
    );
  } finally {
    abortBinding.dispose();
  }

  if (!response.error) {
    const claimed = getClaimedSessionId(response.data);
    if (!claimed) throw new Error(`${input.stage ?? "study-session-claim"}-unconfirmed`);
    return { ...claimed, usedRpc: true };
  }

  if (!isMissingClaimRpcError(response.error)) throw response.error;
  return insertWithCompatibilityFallback(input, client);
}
