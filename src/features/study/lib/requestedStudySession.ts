/**
 * Consulta direta da sessão pedida ("Continuar").
 *
 * Antes o engine buscava as dez sessões abertas mais recentes e apenas
 * priorizava a sessionId pedida na ordenação — se ela estivesse fora do limite,
 * fosse filtrada pelo preset atual ou tivesse outro escopo, outra sessão era
 * aberta como substituta. Agora a sessão pedida é buscada por ID com filtros
 * obrigatórios: mesmo usuário, mesma lista, mesmo modo e não concluída.
 */
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
}

export async function fetchRequestedStudySession<T = any>(
  input: FetchRequestedStudySessionInput,
): Promise<T | null> {
  const { client, sessionId, userId, listId, mode } = input;
  if (!sessionId || !userId || !listId || !mode) return null;

  let query = client
    .from("study_sessions")
    .select(input.columns ?? "*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("list_id", listId)
    .eq("mode", mode)
    .eq("completed", false);
  if (input.signal) query = query.abortSignal(input.signal);

  try {
    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return data as T;
  } catch {
    return null;
  }
}
