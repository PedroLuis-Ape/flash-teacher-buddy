/**
 * Consulta direta da sessão pedida ("Continuar").
 *
 * Antes o engine buscava as dez sessões abertas mais recentes e apenas
 * priorizava a sessionId pedida na ordenação — se ela estivesse fora do limite,
 * fosse filtrada pelo preset atual ou tivesse outro escopo, outra sessão era
 * aberta como substituta. Agora a sessão pedida é buscada por ID com filtros
 * obrigatórios: mesmo usuário, mesma lista, mesmo modo e não concluída.
 */
import {
  STUDY_REMOTE_RESTORE_TIMEOUT_MS,
  StudyRuntimeTimeoutError,
  withStudyRuntimeTimeout,
} from "./studySessionRuntime";

export interface RequestedStudySessionQuery {
  select(columns: string): RequestedStudySessionQuery;
  eq(column: string, value: unknown): RequestedStudySessionQuery;
  abortSignal(signal: AbortSignal): RequestedStudySessionQuery;
  maybeSingle(): PromiseLike<{ data: unknown; error: unknown }>;
}

export interface RequestedStudySessionClient {
  from(table: string): RequestedStudySessionQuery;
}

export interface FetchRequestedStudySessionInput {
  client: RequestedStudySessionClient;
  sessionId: string | null | undefined;
  userId: string | null | undefined;
  listId: string | null | undefined;
  mode: string;
  columns?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export type RequestedStudySessionResult<T> =
  | { status: "found"; session: T }
  | { status: "not-found" }
  | { status: "unavailable"; error: unknown }
  | { status: "cancelled" };

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export async function fetchRequestedStudySession<T = any>(
  input: FetchRequestedStudySessionInput,
): Promise<RequestedStudySessionResult<T>> {
  const { client, sessionId, userId, listId, mode } = input;
  if (!sessionId || !userId || !listId || !mode) return { status: "not-found" };
  if (input.signal?.aborted) return { status: "cancelled" };

  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  input.signal?.addEventListener("abort", forwardAbort, { once: true });

  let query = client
    .from("study_sessions")
    .select(input.columns ?? "*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("list_id", listId)
    .eq("mode", mode)
    .eq("completed", false);
  query = query.abortSignal(controller.signal);

  try {
    const { data, error } = await withStudyRuntimeTimeout(
      query.maybeSingle(),
      input.timeoutMs ?? STUDY_REMOTE_RESTORE_TIMEOUT_MS,
      "requested-session-lookup",
      () => controller.abort(),
    );
    if (error) return { status: "unavailable", error };
    if (!data) return { status: "not-found" };
    return { status: "found", session: data as T };
  } catch (error) {
    if (input.signal?.aborted || (isAbortError(error) && !(error instanceof StudyRuntimeTimeoutError))) {
      return { status: "cancelled" };
    }
    return { status: "unavailable", error };
  } finally {
    input.signal?.removeEventListener("abort", forwardAbort);
  }
}
